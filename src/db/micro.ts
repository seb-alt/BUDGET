/**
 * src/db/micro.ts
 *
 * Écriture des clients, factures et prévisionnel (§9).
 *
 * Deux garde-fous, dans le même esprit que l'écran Paramètres :
 *  - un client facturé ne se supprime pas, sinon ses factures perdraient leur
 *    nom et n'afficheraient plus qu'un identifiant ;
 *  - un numéro de facture ne se réutilise pas : il repart du plus grand numéro
 *    déjà émis cette année, pas d'un compteur qui pourrait reculer après une
 *    suppression.
 */

import { db } from './db'
import { computeDueDate, formatInvoiceNumber } from '../domain/micro/invoices'
import type {
  Cents,
  IsoDate,
  IsoMonth,
  InvoiceStatus,
  MicroClient,
  MicroForecast,
  MicroInvoice,
} from './types'

const now = () => new Date().toISOString()

/* ------------------------------------------------------------------ */
/* Clients                                                             */
/* ------------------------------------------------------------------ */

export interface ClientInput {
  name: string
  hourlyRate?: Cents
  paymentTermDays?: number
  notes?: string
}

export async function saveClient(input: ClientInput, id?: string): Promise<string> {
  const name = input.name.trim()
  if (name === '') throw new Error('Donne un nom au client.')

  if (id !== undefined) {
    await db.microClients.update(id, { ...input, name, updatedAt: now() })
    return id
  }

  const client: MicroClient = {
    id: `cli-${crypto.randomUUID()}`,
    name,
    hourlyRate: input.hourlyRate,
    paymentTermDays: input.paymentTermDays,
    notes: input.notes,
    active: true,
    createdAt: now(),
    updatedAt: now(),
  }
  await db.microClients.add(client)
  return client.id
}

export async function deleteClient(id: string): Promise<void> {
  const used = await db.microInvoices.where('clientId').equals(id).count()
  if (used > 0) {
    throw new Error(
      `${used} facture${used > 1 ? 's sont rattachées' : ' est rattachée'} à ce client. ` +
        'Supprime-les d’abord, ou garde le client pour conserver ton historique.',
    )
  }
  await db.microClients.delete(id)
}

/* ------------------------------------------------------------------ */
/* Factures                                                            */
/* ------------------------------------------------------------------ */

/**
 * Le prochain numéro disponible pour l'année.
 *
 * On repart du plus grand numéro DÉJÀ ÉMIS plutôt que d'un compteur stocké :
 * un compteur reculerait après la suppression d'une facture, et deux factures
 * finiraient par porter le même numéro — ce qu'une comptabilité n'admet pas.
 */
export async function nextInvoiceNumber(year: number): Promise<string> {
  const settings = await db.microSettings.get(1)
  const prefix = settings?.invoiceNumberPrefix ?? 'F'
  const head = `${prefix}${year}-`

  const used = (await db.microInvoices.toArray())
    .filter((invoice) => invoice.number.startsWith(head))
    .map((invoice) => Number(invoice.number.slice(head.length)))
    .filter((value) => Number.isInteger(value))

  return formatInvoiceNumber(prefix, year, Math.max(0, ...used) + 1)
}

export interface InvoiceInput {
  number: string
  clientId: string
  issueDate: IsoDate
  amount: Cents
  dueDate: IsoDate
  status: InvoiceStatus
  paymentDate?: IsoDate
  paidAmount?: Cents
  hours?: number
  notes?: string
}

export function validateInvoice(input: InvoiceInput): string[] {
  const problems: string[] = []

  if (input.number.trim() === '') problems.push('Donne un numéro à la facture.')
  if (!input.clientId) problems.push('Choisis un client.')
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    problems.push('Le montant doit être supérieur à zéro.')
  }
  if (input.dueDate < input.issueDate) {
    problems.push("L'échéance ne peut pas précéder la date d'émission.")
  }
  if (input.status === 'paid' && input.paymentDate === undefined) {
    problems.push('Indique la date de paiement.')
  }
  // 'late' se DÉDUIT de la date du jour, il ne s'enregistre jamais : stocké,
  // il serait faux dès le lendemain.
  if (input.status === 'late') problems.push('Le retard est déduit automatiquement.')

  return problems
}

export async function saveInvoice(input: InvoiceInput, id?: string): Promise<string> {
  const problems = validateInvoice(input)
  if (problems.length > 0) throw new Error(problems.join(' '))

  const timestamp = now()
  if (id !== undefined) {
    const existing = await db.microInvoices.get(id)
    if (existing === undefined) throw new Error("Cette facture n'existe plus.")
    await db.microInvoices.put({ ...existing, ...input, id, updatedAt: timestamp })
    return id
  }

  const invoice: MicroInvoice = {
    ...input,
    id: `inv-${crypto.randomUUID()}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  await db.microInvoices.add(invoice)
  return invoice.id
}

export async function deleteInvoice(id: string): Promise<void> {
  await db.microInvoices.delete(id)
}

/** Raccourci le plus fréquent : encaisser une facture. */
export async function markInvoicePaid(
  id: string,
  paymentDate: IsoDate,
  paidAmount?: Cents,
): Promise<void> {
  const invoice = await db.microInvoices.get(id)
  if (invoice === undefined) throw new Error("Cette facture n'existe plus.")

  await db.microInvoices.update(id, {
    status: 'paid',
    paymentDate,
    paidAmount: paidAmount ?? invoice.amount,
    updatedAt: now(),
  })
}

/** Les valeurs pré-remplies d'une nouvelle facture pour ce client (§9). */
export async function draftInvoiceFor(
  clientId: string,
  issueDate: IsoDate,
): Promise<{ dueDate: IsoDate; hourlyRate?: Cents }> {
  const [client, settings] = await Promise.all([
    db.microClients.get(clientId),
    db.microSettings.get(1),
  ])

  const term = client?.paymentTermDays ?? settings?.defaultPaymentTermDays ?? 30
  return { dueDate: computeDueDate(issueDate, term), hourlyRate: client?.hourlyRate }
}

/* ------------------------------------------------------------------ */
/* Prévisionnel                                                        */
/* ------------------------------------------------------------------ */

/** Enregistre (ou efface) les heures prévues pour un client sur un mois. */
export async function setForecast(
  clientId: string,
  month: IsoMonth,
  plannedHours: number,
  hourlyRate: Cents,
): Promise<void> {
  // Sans client, la ligne serait inexploitable : impossible de savoir à quel
  // tarif la chiffrer ni à quelles factures la comparer.
  if (clientId === '') throw new Error("Choisis un client avant de saisir un planning.")

  const id = `${clientId}-${month}`

  if (plannedHours <= 0) {
    await db.microForecasts.delete(id)
    return
  }

  const forecast: MicroForecast = {
    id,
    clientId,
    month,
    plannedHours,
    hourlyRate,
    createdAt: now(),
    updatedAt: now(),
  }
  await db.microForecasts.put(forecast)
}
