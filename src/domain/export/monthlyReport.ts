/**
 * src/domain/export/monthlyReport.ts
 *
 * Le rapport d'un mois : sa FORME, et sa mise en classeur Excel.
 *
 * Ce fichier ne lit pas la base. Il reçoit un rapport déjà constitué (c'est le
 * travail de src/db/monthlyReport.ts) et le transforme en feuilles de calcul.
 * Cette séparation a une raison précise : le même rapport servira aussi à
 * produire le PDF. Il n'y a donc qu'UN endroit qui décide de ce que contient
 * un mois, et deux façons de l'afficher.
 *
 * Les montants circulent en CENTIMES, comme partout ailleurs dans
 * l'application. La conversion en euros n'a lieu qu'au dernier moment, ici,
 * juste avant d'écrire la cellule.
 */

import type { Cents, IsoDate, IsoMonth } from '../../db/types'
import { fromCents } from '../../utils/money'
import { buildWorkbook, type SheetSpec } from './xlsx'

export interface ReportLine {
  categoryId: string
  category: string
  group: string
  budget: Cents
  spent: Cents
  remaining: Cents
}

export interface ReportOperation {
  date: IsoDate
  type: string
  category: string
  group: string
  account: string
  toAccount: string
  label: string
  /** Signé : ce que l'opération fait au compte de la colonne « Compte ». */
  signedAmount: Cents
  isMicro: boolean
}

export interface ReportAccount {
  name: string
  kind: string
  balance: Cents
  /** Date du dernier relevé manuel servant de point de départ, s'il y en a un. */
  since?: IsoDate
}

export interface ReportInvoice {
  number: string
  client: string
  issueDate: IsoDate
  dueDate: IsoDate
  amount: Cents
  status: string
  paymentDate?: IsoDate
  collected: Cents
}

export interface MonthlyReport {
  month: IsoMonth
  monthLabel: string
  /** Un mois révolu ne bouge plus : le rapport le dit, pour lever le doute. */
  frozen: boolean
  generatedAt: IsoDate

  income: Cents
  expenses: Cents
  savings: Cents
  leisureRemaining: Cents

  groups: { title: string; budget: Cents; spent: Cents; remaining: Cents }[]
  lines: ReportLine[]
  operations: ReportOperation[]
  accounts: ReportAccount[]
  patrimony: Cents

  micro?: {
    collected: Cents
    awaiting: Cents
    urssafProvisioned: Cents
    urssafPaid: Cents
    urssafRemaining: Cents
    expenses: Cents
    available: Cents
    invoices: ReportInvoice[]
  }
}

/** '2026-09-30' → '30/09/2026'. Une date lue par un humain, pas par une machine. */
const frenchDate = (iso: string): string => iso.split('-').reverse().join('/')

/** Centimes → euros, ou cellule vide. Un zéro et un « rien » ne sont pas pareils. */
const euros = (cents: Cents | undefined): number | null =>
  cents === undefined ? null : fromCents(cents)

function summarySheet(report: MonthlyReport): SheetSpec {
  const rows: (string | number | null)[][] = [
    ['Mois', report.monthLabel],
    ['Budget', report.frozen ? 'figé (mois révolu)' : 'en cours, peut encore bouger'],
    ['Édité le', frenchDate(report.generatedAt)],
    [],
    ['Entrées du mois', euros(report.income)],
    ['Sorties du mois', euros(report.expenses)],
    ['Épargne du mois', euros(report.savings)],
    ['Loisirs restants', euros(report.leisureRemaining)],
    [],
    ['Patrimoine à la fin du mois', euros(report.patrimony)],
    [],
    ['Groupe', 'Budget', 'Dépensé', 'Reste'],
  ]

  // Les trois colonnes de droite ne servent qu'au tableau des groupes, plus
  // bas : les lignes du haut n'en utilisent que deux.
  for (const group of report.groups) {
    rows.push([group.title, euros(group.budget), euros(group.spent), euros(group.remaining)])
  }

  if (report.micro !== undefined) {
    const micro = report.micro
    rows.push(
      [],
      ['Micro-entreprise', '', '', ''],
      ['CA encaissé', euros(micro.collected)],
      ['Facturé, en attente de paiement', euros(micro.awaiting)],
      ['URSSAF provisionnée', euros(micro.urssafProvisioned)],
      ['URSSAF déjà versée', euros(micro.urssafPaid)],
      ['URSSAF restant à verser', euros(micro.urssafRemaining)],
      ['Dépenses professionnelles', euros(micro.expenses)],
      ['Disponible estimé', euros(micro.available)],
    )
  }

  return {
    name: 'Résumé',
    columns: [
      { header: 'Poste', width: 34 },
      { header: 'Montant', width: 16, format: 'euro' },
      { header: 'Dépensé', width: 14, format: 'euro' },
      { header: 'Reste', width: 14, format: 'euro' },
    ],
    rows,
  }
}

function operationsSheet(report: MonthlyReport): SheetSpec {
  return {
    name: 'Opérations',
    columns: [
      { header: 'Date', width: 12, format: 'date' },
      { header: 'Type', width: 11 },
      { header: 'Montant', width: 14, format: 'euro' },
      { header: 'Catégorie', width: 22 },
      { header: 'Groupe', width: 20 },
      { header: 'Compte', width: 16 },
      { header: 'Vers', width: 16 },
      { header: 'Libellé', width: 28 },
      { header: 'Micro', width: 8 },
    ],
    rows: report.operations.map((operation) => [
      operation.date,
      operation.type,
      euros(operation.signedAmount),
      operation.category,
      operation.group,
      operation.account,
      operation.toAccount,
      operation.label,
      operation.isMicro ? 'oui' : '',
    ]),
  }
}

function budgetSheet(report: MonthlyReport): SheetSpec {
  return {
    name: 'Budget',
    columns: [
      { header: 'Groupe', width: 22 },
      { header: 'Catégorie', width: 24 },
      { header: 'Budget', width: 14, format: 'euro' },
      { header: 'Dépensé', width: 14, format: 'euro' },
      { header: 'Reste', width: 14, format: 'euro' },
    ],
    rows: report.lines.map((line) => [
      line.group,
      line.category,
      euros(line.budget),
      euros(line.spent),
      euros(line.remaining),
    ]),
  }
}

function accountsSheet(report: MonthlyReport): SheetSpec {
  return {
    name: 'Comptes',
    columns: [
      { header: 'Compte', width: 22 },
      { header: 'Nature', width: 18 },
      { header: 'Solde fin de mois', width: 18, format: 'euro' },
      { header: 'Dernier relevé saisi', width: 20, format: 'date' },
    ],
    rows: report.accounts.map((account) => [
      account.name,
      account.kind,
      euros(account.balance),
      account.since ?? null,
    ]),
  }
}

function invoicesSheet(report: MonthlyReport): SheetSpec | undefined {
  const invoices = report.micro?.invoices ?? []
  if (invoices.length === 0) return undefined

  return {
    name: 'Factures',
    columns: [
      { header: 'Numéro', width: 16 },
      { header: 'Client', width: 24 },
      { header: 'Émise le', width: 12, format: 'date' },
      { header: 'Échéance', width: 12, format: 'date' },
      { header: 'Montant', width: 14, format: 'euro' },
      { header: 'Statut', width: 14 },
      { header: 'Payée le', width: 12, format: 'date' },
      { header: 'Encaissé', width: 14, format: 'euro' },
    ],
    rows: invoices.map((invoice) => [
      invoice.number,
      invoice.client,
      invoice.issueDate,
      invoice.dueDate,
      euros(invoice.amount),
      invoice.status,
      invoice.paymentDate ?? null,
      invoice.collected === 0 ? null : euros(invoice.collected),
    ]),
  }
}

export function buildMonthlyWorkbook(report: MonthlyReport, now = new Date()): Uint8Array {
  const sheets = [
    summarySheet(report),
    operationsSheet(report),
    budgetSheet(report),
    accountsSheet(report),
    invoicesSheet(report),
  ].filter((sheet): sheet is SheetSpec => sheet !== undefined)

  return buildWorkbook(sheets, now)
}

/** « budget-2026-09.xlsx » : un nom qui se classe tout seul par ordre chronologique. */
export function workbookFileName(month: IsoMonth): string {
  return `budget-${month}.xlsx`
}
