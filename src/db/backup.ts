/**
 * src/db/backup.ts
 *
 * Export complet, restauration, et fichiers CSV (§12).
 *
 * Trois principes :
 *
 *  1. LA SAUVEGARDE EST COMPLÈTE. Elle contient toutes les tables, pas
 *     seulement les opérations : un rechargement doit rendre l'application
 *     exactement dans l'état où tu l'as laissée, réglages et budgets figés
 *     compris.
 *
 *  2. LA RESTAURATION EST ATOMIQUE. Tout est remplacé dans une seule
 *     transaction : si quoi que ce soit échoue en cours de route, la base
 *     revient à son état d'avant. On ne peut pas se retrouver à moitié
 *     restauré.
 *
 *  3. LE CSV EST UN FORMAT DE LECTURE. Il sert à consulter et à archiver,
 *     jamais à restaurer — il perdrait les réglages et les liens entre
 *     tables. C'est `backup.json` qui restaure.
 */

import {
  BACKUP_FORMAT,
  BACKUP_TABLES,
  type BackupFile,
  type BackupTable,
} from '../domain/backup/backupFile'
import { csvAmount, toCsv, type CsvColumn } from '../domain/backup/csv'
import { V5_RENAMES, renameInBackupData } from '../domain/migration/renameIds'
import { db } from './db'
import type { MicroInvoice, PatrimonySnapshot, Settings, Transaction } from './types'

/** Version du schéma de la base. Doit suivre le dernier `.version(n)` de db.ts. */
export const SCHEMA_VERSION = 5

/* ------------------------------------------------------------------ */
/* Export complet                                                      */
/* ------------------------------------------------------------------ */

export async function exportBackup(): Promise<BackupFile> {
  const exportedAt = new Date().toISOString()
  const tables = await Promise.all(BACKUP_TABLES.map((name) => db.table(name).toArray()))

  const data = Object.fromEntries(
    BACKUP_TABLES.map((name, index) => [name, tables[index]]),
  ) as Record<BackupTable, unknown[]>

  // La sauvegarde se date ELLE-MÊME. Sans ça, restaurer un fichier ferait
  // réapparaître aussitôt le rappel « aucune sauvegarde » — alors que les
  // données restaurées SONT exactement celles de la sauvegarde qu'on a en main.
  data.settings = (data.settings as Settings[]).map((row) => ({
    ...row,
    lastBackupAt: exportedAt,
  }))

  return { format: BACKUP_FORMAT, version: SCHEMA_VERSION, exportedAt, data }
}

/** Enregistre la date de la dernière sauvegarde, pour le rappel discret (§12). */
export async function markBackupDone(): Promise<void> {
  await db.settings.update(1, { lastBackupAt: new Date().toISOString() })
}

/* ------------------------------------------------------------------ */
/* Restauration                                                        */
/* ------------------------------------------------------------------ */

export interface RestoreReport {
  restored: Record<string, number>
}

/**
 * Remplace TOUTE la base par le contenu d'une sauvegarde.
 * Le fichier doit avoir été validé au préalable (validateBackup).
 */
/**
 * Met le contenu d'une sauvegarde au format d'aujourd'hui.
 *
 * LE PIÈGE : restaurer n'écrit que des lignes. Cela ne rejoue AUCUNE migration
 * — Dexie ne les exécute qu'au changement de version de la base, pas à chaque
 * écriture. Sans ce passage, une sauvegarde de septembre réintroduirait les
 * anciens identifiants dans une base déjà migrée, et l'application se
 * retrouverait avec des catégories en double.
 *
 * La transformation est la même que celle de la migration, et elle vient du
 * même fichier : impossible que les deux chemins divergent.
 */
function upgradeBackupData(backup: BackupFile): Record<string, unknown[]> {
  if (backup.version >= 5) return backup.data
  return renameInBackupData(backup.data, V5_RENAMES)
}

export async function restoreBackup(backup: BackupFile): Promise<RestoreReport> {
  const tables = BACKUP_TABLES.map((name) => db.table(name))
  const data = upgradeBackupData(backup)

  return db.transaction('rw', tables, async () => {
    const restored: Record<string, number> = {}

    for (const name of BACKUP_TABLES) {
      const table = db.table(name)
      // On vide avant d'écrire : sans ça, une ligne supprimée depuis la
      // sauvegarde survivrait à la restauration.
      await table.clear()
      const rows = data[name] ?? []
      if (rows.length > 0) await table.bulkAdd(rows)
      restored[name] = rows.length
    }

    return { restored }
  })
}

/* ------------------------------------------------------------------ */
/* Fichiers CSV                                                        */
/* ------------------------------------------------------------------ */

export interface CsvFile {
  name: string
  content: string
}

const TYPE_LABELS: Record<Transaction['type'], string> = {
  expense: 'Dépense',
  income: 'Entrée',
  transfer: 'Transfert',
}

const INVOICE_STATUS_LABELS: Record<MicroInvoice['status'], string> = {
  draft: 'Brouillon',
  issued: 'Émise',
  awaiting: 'À recevoir',
  paid: 'Payée',
  late: 'En retard',
  cancelled: 'Annulée',
}

export async function buildCsvFiles(): Promise<CsvFile[]> {
  const [transactions, categories, accounts, monthlyBudgets, snapshots, invoices, clients] =
    await Promise.all([
      db.transactions.orderBy('date').toArray(),
      db.categories.toArray(),
      db.accounts.toArray(),
      db.monthlyBudgets.orderBy('month').toArray(),
      db.patrimonySnapshots.orderBy('date').toArray(),
      db.microInvoices.toArray(),
      db.microClients.toArray(),
    ])

  // Les fichiers portent des NOMS, pas des identifiants : un CSV se lit à
  // l'œil, « cat-shopping » n'y apprendrait rien à personne.
  const nameOf = new Map<string, string>()
  for (const category of categories) nameOf.set(category.id, category.name)
  for (const account of accounts) nameOf.set(account.id, account.name)
  for (const client of clients) nameOf.set(client.id, client.name)
  const label = (id?: string) => (id === undefined ? '' : (nameOf.get(id) ?? id))

  const transactionColumns: CsvColumn<Transaction>[] = [
    { header: 'Date', value: (t) => t.date },
    { header: 'Type', value: (t) => TYPE_LABELS[t.type] },
    { header: 'Montant', value: (t) => csvAmount(t.amount) },
    { header: 'Catégorie', value: (t) => label(t.categoryId) },
    { header: 'Compte', value: (t) => label(t.accountId) },
    { header: 'Depuis', value: (t) => label(t.fromAccountId) },
    { header: 'Vers', value: (t) => label(t.toAccountId) },
    { header: 'Libellé', value: (t) => t.label ?? '' },
    { header: 'Micro', value: (t) => (t.isMicro === true ? 'oui' : '') },
  ]

  /** Une ligne par couple mois + catégorie : le format qu'un tableur sait pivoter. */
  const budgetRows = monthlyBudgets.flatMap((budget) =>
    budget.lines.map((line) => ({ month: budget.month, ...line })),
  )

  /** Une ligne par couple relevé + compte, pour la même raison. */
  const patrimonyRows = snapshots.flatMap((snapshot: PatrimonySnapshot) =>
    snapshot.balances.map((balance) => ({ date: snapshot.date, ...balance })),
  )

  const microExpenses = transactions.filter(
    (transaction) => transaction.isMicro === true && transaction.type === 'expense',
  )

  return [
    { name: 'transactions.csv', content: toCsv(transactions, transactionColumns) },
    {
      name: 'budgets.csv',
      content: toCsv(budgetRows, [
        { header: 'Mois', value: (row) => row.month },
        { header: 'Catégorie', value: (row) => label(row.categoryId) },
        { header: 'Budget', value: (row) => csvAmount(row.amount) },
      ]),
    },
    {
      name: 'patrimoine.csv',
      content: toCsv(patrimonyRows, [
        { header: 'Date', value: (row) => row.date },
        { header: 'Compte', value: (row) => label(row.accountId) },
        { header: 'Solde', value: (row) => csvAmount(row.balance) },
      ]),
    },
    {
      name: 'micro_factures.csv',
      content: toCsv(invoices, [
        { header: 'Numéro', value: (invoice) => invoice.number },
        { header: 'Client', value: (invoice) => label(invoice.clientId) },
        { header: 'Émission', value: (invoice) => invoice.issueDate },
        { header: 'Montant HT', value: (invoice) => csvAmount(invoice.amount) },
        { header: 'Échéance', value: (invoice) => invoice.dueDate },
        { header: 'Statut', value: (invoice) => INVOICE_STATUS_LABELS[invoice.status] },
        { header: 'Payée le', value: (invoice) => invoice.paymentDate ?? '' },
        {
          header: 'Encaissé',
          value: (invoice) =>
            invoice.paidAmount === undefined ? '' : csvAmount(invoice.paidAmount),
        },
      ]),
    },
    {
      name: 'micro_depenses.csv',
      content: toCsv(microExpenses, transactionColumns),
    },
  ]
}
