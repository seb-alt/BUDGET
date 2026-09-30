/**
 * src/domain/budget/monthSummary.ts
 *
 * LOGIQUE MÉTIER PURE — aucun import de React, aucun import de Dexie.
 * Ce fichier reçoit des tableaux de données et renvoie des chiffres. C'est ce
 * qui permet de le tester tout seul (voir monthSummary.test.ts) et d'être sûr
 * que les totaux affichés sont justes.
 *
 * ---------------------------------------------------------------------------
 * LES TROIS RÈGLES APPLIQUÉES ICI
 * ---------------------------------------------------------------------------
 * 1. Un TRANSFERT n'est JAMAIS une dépense. Déplacer 300 € du compte courant vers le LEP
 *    ne t'appauvrit pas : ça ne doit pas apparaître dans « Sorties du mois ».
 *
 * 2. L'ÉPARGNE du mois, c'est l'argent qui ENTRE dans la poche épargne, pas
 *    l'argent qui s'y déplace. Un virement LEP -> PEA ne crée pas d'épargne
 *    nouvelle, il la réorganise : il est donc exclu du total.
 *
 * 3. La MICRO-ENTREPRISE ne se mélange jamais au budget personnel. Toute
 *    opération marquée `isMicro` est écartée de ces calculs ; elle sera
 *    traitée par l'onglet Micro, qui a ses propres indicateurs.
 */

import type {
  Account,
  BudgetLine,
  Category,
  CategoryGroup,
  Cents,
  IsoMonth,
  Transaction,
} from '../../db/types'

/** Avancement d'une sous-catégorie : « Shopping : 24,50 € / 200 € — reste 175,50 € ». */
export interface CategoryProgress {
  categoryId: string
  budget: Cents
  spent: Cents
  /** Peut être négatif : c'est un dépassement, et on veut le voir. */
  remaining: Cents
}

/** Même chose, agrégé au niveau d'une carte du Dashboard (Charges fixes, Loisirs…). */
export interface GroupProgress {
  budget: Cents
  spent: Cents
  remaining: Cents
}

export interface MonthSummaryInput {
  month: IsoMonth
  /** Toutes les opérations : le filtrage sur le mois est fait ici. */
  transactions: Transaction[]
  accounts: Account[]
  categories: Category[]
  /** Budget applicable à ce mois (figé s'il existe, sinon budget courant). */
  budget: BudgetLine[]
  /**
   * Quelles enveloppes d'épargne sont alimentées par quels comptes.
   * Ex. { 'cat-assurance-vie': ['acc-assurance-vie'],
   *       'cat-epargne-flexible': ['acc-lep', 'acc-pea'] }
   *
   * Les catégories d'épargne ne sont pas remplies par des dépenses mais par
   * des VIREMENTS. Cette correspondance vient des paramètres, jamais du code.
   */
  savingCategoryAccounts?: Record<string, string[]>
}

export interface MonthSummary {
  month: IsoMonth
  /** Les 4 indicateurs du haut du Dashboard. */
  income: Cents
  expenses: Cents
  savings: Cents
  leisureRemaining: Cents
  /** Détail par sous-catégorie, indexé par identifiant de catégorie. */
  byCategory: Record<string, CategoryProgress>
  /** Détail par carte du Dashboard. */
  byGroup: Record<CategoryGroup, GroupProgress>
}

const ALL_GROUPS: CategoryGroup[] = [
  'chargesFixes',
  'epargne',
  'loisirs',
  'divers',
  'revenuPerso',
  'micro',
]

/** Les opérations d'un mois donné. '2026-09-16' appartient à '2026-09'. */
export function transactionsOfMonth(
  transactions: Transaction[],
  month: IsoMonth,
): Transaction[] {
  return transactions.filter((transaction) => transaction.date.slice(0, 7) === month)
}

const total = (transactions: Transaction[]): Cents =>
  transactions.reduce((sum, transaction) => sum + transaction.amount, 0)

export function computeMonthSummary(input: MonthSummaryInput): MonthSummary {
  const { month, accounts, categories, budget, savingCategoryAccounts = {} } = input

  // Règle 3 : le budget personnel ignore la micro-entreprise.
  const monthTransactions = transactionsOfMonth(input.transactions, month).filter(
    (transaction) => !transaction.isMicro,
  )

  const savingsAccountIds = new Set(
    accounts.filter((account) => account.countsAsSavings).map((account) => account.id),
  )

  const incomes = monthTransactions.filter((transaction) => transaction.type === 'income')
  const expenses = monthTransactions.filter((transaction) => transaction.type === 'expense')
  const transfers = monthTransactions.filter((transaction) => transaction.type === 'transfer')

  // Règles 1 et 2 : seuls les virements qui ENTRENT dans la poche épargne comptent.
  const savingTransfers = transfers.filter(
    (transaction) =>
      transaction.toAccountId !== undefined &&
      savingsAccountIds.has(transaction.toAccountId) &&
      !(transaction.fromAccountId !== undefined && savingsAccountIds.has(transaction.fromAccountId)),
  )

  const budgetByCategory = new Map(budget.map((line) => [line.categoryId, line.amount]))

  const byCategory: Record<string, CategoryProgress> = {}
  const byGroup = Object.fromEntries(
    ALL_GROUPS.map((group) => [group, { budget: 0, spent: 0, remaining: 0 }]),
  ) as Record<CategoryGroup, GroupProgress>

  for (const category of categories) {
    // Une catégorie DÉSACTIVÉE ne consomme plus de budget : sinon la carte
    // afficherait un total que les lignes visibles ne justifient pas.
    // Ses dépenses passées, elles, continuent de compter — l'argent a bien
    // été dépensé, et le masquer fausserait les totaux du mois.
    const categoryBudget = category.active ? (budgetByCategory.get(category.id) ?? 0) : 0

    let spent: Cents
    if (category.kind === 'saving') {
      // Une enveloppe d'épargne se remplit par virement vers ses comptes.
      const fedAccounts = new Set(savingCategoryAccounts[category.id] ?? [])
      spent = total(
        savingTransfers.filter(
          (transaction) =>
            transaction.toAccountId !== undefined && fedAccounts.has(transaction.toAccountId),
        ),
      )
    } else {
      const source = category.kind === 'income' ? incomes : expenses
      spent = total(source.filter((transaction) => transaction.categoryId === category.id))
    }

    byCategory[category.id] = {
      categoryId: category.id,
      budget: categoryBudget,
      spent,
      remaining: categoryBudget - spent,
    }

    const group = byGroup[category.group]
    group.budget += categoryBudget
    group.spent += spent
    group.remaining = group.budget - group.spent
  }

  return {
    month,
    income: total(incomes),
    expenses: total(expenses),
    savings: total(savingTransfers),
    leisureRemaining: byGroup.loisirs.remaining,
    byCategory,
    byGroup,
  }
}
