/**
 * src/domain/micro/invoices.ts
 *
 * LOGIQUE MÉTIER PURE — le cycle de vie d'une facture (§9).
 *
 * ---------------------------------------------------------------------------
 * « EN RETARD » NE SE STOCKE PAS
 * ---------------------------------------------------------------------------
 * Une facture devient en retard toute seule, le jour où son échéance passe.
 * Si on enregistrait ce statut en base, il serait faux dès le lendemain : il
 * faudrait balayer toutes les factures chaque matin pour le tenir à jour, et
 * une application fermée pendant une semaine afficherait des retards absents.
 *
 * Le statut ENREGISTRÉ dit donc où tu en es de ton travail (brouillon, émise,
 * payée, annulée) ; le retard, lui, se DÉDUIT de la date du jour.
 */

import type { IsoDate, MicroInvoice } from '../../db/types'

/** Au-delà de ce délai, l'application prévient qu'un paiement approche. */
export const ALERT_WINDOW_DAYS = 7

/** Nombre de jours entiers entre deux dates ('2026-09-30' -> '2026-10-05' = 5). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const parse = (date: IsoDate) => {
    const [year, month, day] = date.split('-').map(Number)
    return new Date(year, month - 1, day).getTime()
  }
  return Math.round((parse(to) - parse(from)) / 86_400_000)
}

/** Échéance = date d'émission + délai de paiement convenu. */
export function computeDueDate(issueDate: IsoDate, termDays: number): IsoDate {
  const [year, month, day] = issueDate.split('-').map(Number)
  const due = new Date(year, month - 1, day + termDays)
  return `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(
    due.getDate(),
  ).padStart(2, '0')}`
}

/**
 * Le statut réellement affiché, retard compris.
 * Seules les factures en attente de paiement peuvent basculer en retard :
 * un brouillon, une facture payée ou annulée n'attendent rien.
 */
export function effectiveStatus(invoice: MicroInvoice, today: IsoDate): MicroInvoice['status'] {
  const isPending = invoice.status === 'issued' || invoice.status === 'awaiting'
  if (isPending && invoice.dueDate < today) return 'late'
  return invoice.status
}

export type AlertKind = 'soon' | 'late'

export interface InvoiceAlert {
  invoice: MicroInvoice
  kind: AlertKind
  /** Nombre de jours, toujours positif : « dans 5 jours » ou « depuis 6 jours ». */
  days: number
}

/**
 * Les factures qui réclament ton attention, la plus urgente en premier.
 * Les retards passent avant les échéances proches, et à situation égale, la
 * plus ancienne d'abord.
 */
export function invoiceAlerts(
  invoices: MicroInvoice[],
  today: IsoDate,
  windowDays: number = ALERT_WINDOW_DAYS,
): InvoiceAlert[] {
  const alerts: InvoiceAlert[] = []

  for (const invoice of invoices) {
    if (invoice.status !== 'issued' && invoice.status !== 'awaiting') continue

    const days = daysBetween(today, invoice.dueDate)
    if (days < 0) alerts.push({ invoice, kind: 'late', days: -days })
    else if (days <= windowDays) alerts.push({ invoice, kind: 'soon', days })
  }

  return alerts.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'late' ? -1 : 1
    // Retards : le plus ancien d'abord. Échéances : la plus proche d'abord.
    return a.kind === 'late' ? b.days - a.days : a.days - b.days
  })
}

/** Le prochain numéro de facture : 'F' + 2026 + un compteur sur trois chiffres. */
export function formatInvoiceNumber(prefix: string, year: number, sequence: number): string {
  return `${prefix}${year}-${String(sequence).padStart(3, '0')}`
}
