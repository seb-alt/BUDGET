/**
 * src/db/monthlyReport.ts
 *
 * Rassembler tout ce qu'il faut savoir sur un mois, en une seule structure.
 *
 * C'est le seul endroit qui décide de ce que contient un rapport mensuel. Le
 * classeur Excel et le PDF partent tous les deux d'ici : impossible qu'ils
 * racontent deux choses différentes du même mois.
 *
 * Les chiffres ne sont pas recalculés ici. On appelle les mêmes fonctions que
 * le Dashboard — `computeMonthSummary`, `applyFlexibleEnvelope`,
 * `computeAccountBalances`, `computeMicroSummary` — pour que le rapport dise
 * exactement ce que l'écran affiche. Un export qui diverge de l'écran est pire
 * que pas d'export du tout.
 */

import { resolveMonthBudget } from './budgets'
import { db } from './db'
import type { Account, IsoMonth, MicroInvoice, Transaction } from './types'
import { applyFlexibleEnvelope } from '../domain/budget/budgetEngine'
import { computeMonthSummary } from '../domain/budget/monthSummary'
import { computeMicroSummary } from '../domain/micro/microSummary'
import { computeAccountBalances } from '../domain/patrimony/accountBalance'
import { lastDayOfMonth } from '../domain/patrimony/patrimonySeries'
import type {
  MonthlyReport,
  ReportInvoice,
  ReportOperation,
} from '../domain/export/monthlyReport'
import { today, formatMonthLabel } from '../utils/date'

const TYPE_LABELS: Record<Transaction['type'], string> = {
  expense: 'Dépense',
  income: 'Entrée',
  transfer: 'Transfert',
}

const GROUP_LABELS: Record<string, string> = {
  chargesFixes: 'Charges fixes',
  epargne: 'Épargne & investissement',
  loisirs: 'Loisirs',
  divers: 'Divers',
  revenuPerso: 'Revenus',
  micro: 'Micro-entreprise',
}

const ACCOUNT_KINDS: Record<Account['kind'], string> = {
  checking: 'Compte courant',
  savings: 'Épargne',
  investment: 'Placement',
  micro: 'Micro-entreprise',
}

const INVOICE_STATUS: Record<MicroInvoice['status'], string> = {
  draft: 'Brouillon',
  issued: 'Émise',
  awaiting: 'À recevoir',
  paid: 'Payée',
  late: 'En retard',
  cancelled: 'Annulée',
}

/**
 * Le montant signé du point de vue du compte de la colonne « Compte ».
 *
 * Une entrée l'augmente, une dépense le diminue, un virement le quitte. C'est
 * ce qui permet d'additionner une colonne dans le tableur et d'obtenir quelque
 * chose de vrai. Attention : additionner TOUTES les lignes mélangerait les
 * comptes — le résumé, lui, applique les règles du budget.
 */
function signedAmount(transaction: Transaction): number {
  if (transaction.type === 'income') return transaction.amount
  return -transaction.amount
}

export async function buildMonthlyReport(month: IsoMonth): Promise<MonthlyReport> {
  const [accounts, categories, allTransactions, snapshots, settings, budget, loans] =
    await Promise.all([
      db.accounts.toArray(),
      db.categories.orderBy('[group+order]').toArray(),
      db.transactions.toArray(),
      db.patrimonySnapshots.toArray(),
      db.settings.get(1),
      resolveMonthBudget(month),
      db.loans.orderBy('order').toArray(),
    ])

  if (settings === undefined) throw new Error('Les réglages sont introuvables.')

  const monthTransactions = allTransactions
    .filter((transaction) => transaction.date.slice(0, 7) === month)
    .sort((a, b) => a.date.localeCompare(b.date))

  const actualIncome = monthTransactions
    .filter((transaction) => transaction.type === 'income' && !transaction.isMicro)
    .reduce((total, transaction) => total + transaction.amount, 0)

  // Le même passage par le moteur que sur l'accueil : sans lui, la ligne de
  // l'enveloppe flexible serait celle du budget fixe et non celle du mois.
  const planned = applyFlexibleEnvelope({
    budget: budget.lines,
    categories,
    actualIncome,
    flexibleCategoryId: settings.flexibleSavingsCategoryId,
    assuranceVieMonthly: budget.assuranceVieMonthly,
  })

  const savingCategoryAccounts = Object.fromEntries(
    categories
      .filter((category) => category.savingAccountIds !== undefined)
      .map((category) => [category.id, category.savingAccountIds ?? []]),
  )

  const summary = computeMonthSummary({
    month,
    transactions: allTransactions,
    accounts,
    categories,
    budget: planned.budget,
    savingCategoryAccounts,
  })

  const nameOf = new Map<string, string>()
  for (const account of accounts) nameOf.set(account.id, account.name)
  for (const category of categories) nameOf.set(category.id, category.name)
  const named = (id?: string) => (id === undefined ? '' : (nameOf.get(id) ?? ''))

  const groupOf = new Map(categories.map((category) => [category.id, category.group]))

  const operations: ReportOperation[] = monthTransactions.map((transaction) => ({
    date: transaction.date,
    type: TYPE_LABELS[transaction.type],
    category: named(transaction.categoryId),
    group: GROUP_LABELS[groupOf.get(transaction.categoryId ?? '') ?? ''] ?? '',
    account: named(transaction.accountId ?? transaction.fromAccountId),
    toAccount: named(transaction.toAccountId),
    label: transaction.label ?? '',
    signedAmount: signedAmount(transaction),
    isMicro: transaction.isMicro === true,
  }))

  // Une ligne par catégorie qui a un budget OU une dépense : une catégorie
  // inactive et vide n'apprendrait rien, mais une catégorie inactive sur
  // laquelle on a dépensé doit apparaître, sinon la somme ne tombe pas juste.
  const lines = categories
    .filter((category) => category.group !== 'revenuPerso' && category.group !== 'micro')
    .map((category) => {
      const progress = summary.byCategory[category.id]
      return {
        categoryId: category.id,
        category: category.name,
        group: GROUP_LABELS[category.group] ?? category.group,
        budget: progress?.budget ?? 0,
        spent: progress?.spent ?? 0,
        remaining: progress?.remaining ?? 0,
      }
    })
    .filter((line) => line.budget !== 0 || line.spent !== 0)

  const endOfMonth = lastDayOfMonth(month)
  const balances = computeAccountBalances(
    accounts.map((account) => account.id),
    allTransactions,
    snapshots,
    endOfMonth,
  )

  const reportAccounts = accounts
    .filter((account) => account.active)
    .map((account) => {
      const balance = balances.get(account.id)
      return {
        name: account.name,
        kind: ACCOUNT_KINDS[account.kind],
        balance: balance?.balance ?? 0,
        since: balance?.since,
      }
    })

  const patrimony = reportAccounts.reduce((total, account) => total + account.balance, 0)
  const debt = loans.reduce((total, loan) => total + loan.remainingCapital, 0)

  const report: MonthlyReport = {
    month,
    monthLabel: formatMonthLabel(month),
    frozen: budget.frozen,
    generatedAt: today(),
    income: summary.income,
    expenses: summary.expenses,
    savings: summary.savings,
    leisureRemaining: summary.leisureRemaining,
    groups: (['chargesFixes', 'epargne', 'loisirs'] as const).map((group) => ({
      title: GROUP_LABELS[group],
      budget: summary.byGroup[group].budget,
      spent: summary.byGroup[group].spent,
      remaining: summary.byGroup[group].remaining,
    })),
    lines,
    operations,
    accounts: reportAccounts,
    patrimony,
    loans: loans.map((loan) => ({
      name: loan.name,
      initialAmount: loan.initialAmount,
      monthlyPayment: loan.monthlyPayment,
      remainingCapital: loan.remainingCapital,
      lastUpdated: loan.lastUpdated,
    })),
    debt,
    netWorth: patrimony - debt,
  }

  const microSettings = await db.microSettings.get(1)
  if (microSettings !== undefined) {
    const [invoices, clients] = await Promise.all([
      db.microInvoices.toArray(),
      db.microClients.toArray(),
    ])
    const monthInvoices = invoices.filter((invoice) => invoice.issueDate.slice(0, 7) === month)
    const microExpenses = monthTransactions.filter(
      (transaction) => transaction.isMicro === true && transaction.type === 'expense',
    )

    // Rien sur la micro ce mois-ci : on n'ajoute pas des lignes de zéros.
    if (monthInvoices.length > 0 || microExpenses.length > 0) {
      const clientName = new Map(clients.map((client) => [client.id, client.name]))
      const micro = computeMicroSummary({
        invoices: monthInvoices,
        expenses: microExpenses,
        urssafCategoryId: microSettings.urssafCategoryId,
        urssafRate: microSettings.urssafRate,
      })

      const reportInvoices: ReportInvoice[] = monthInvoices
        .sort((a, b) => a.number.localeCompare(b.number))
        .map((invoice) => ({
          number: invoice.number,
          client: clientName.get(invoice.clientId) ?? '',
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          amount: invoice.amount,
          status: INVOICE_STATUS[invoice.status],
          paymentDate: invoice.paymentDate,
          collected: invoice.status === 'paid' ? (invoice.paidAmount ?? invoice.amount) : 0,
        }))

      report.micro = { ...micro, invoices: reportInvoices }
    }
  }

  return report
}
