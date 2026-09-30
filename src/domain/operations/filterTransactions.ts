/**
 * src/domain/operations/filterTransactions.ts
 *
 * LOGIQUE MÉTIER PURE — la recherche et les filtres de l'onglet Opérations.
 *
 * Isolée du composant pour une raison précise : un filtre qui fait disparaître
 * une opération qu'il aurait dû garder est presque impossible à repérer à
 * l'œil. On ne voit pas ce qui manque. D'où des tests sur chaque règle.
 */

import type { IsoDate, Transaction, TransactionType } from '../../db/types'
import { addMonths } from '../../utils/date'
import { parseAmountInput } from '../../utils/money'

/** Périodes proposées. Des raccourcis plutôt que deux champs de date à remplir. */
export type Period = 'currentMonth' | 'last3Months' | 'currentYear' | 'all'

export interface OperationFilters {
  /** Texte libre : libellé, catégorie, compte, ou montant exact. */
  search: string
  type: TransactionType | 'all'
  categoryId: string | 'all'
  accountId: string | 'all'
  period: Period
}

export const EMPTY_FILTERS: OperationFilters = {
  search: '',
  type: 'all',
  categoryId: 'all',
  accountId: 'all',
  period: 'currentMonth',
}

/** Contexte nécessaire au filtrage, fourni par l'appelant pour rester pur. */
export interface FilterContext {
  /** La date du jour, passée en paramètre pour que les tests soient stables. */
  today: IsoDate
  /** Identifiant de catégorie ou de compte -> nom affiché, pour la recherche. */
  namesById: Map<string, string>
}

/**
 * Combien de filtres sont actifs, pour l'afficher sur le bouton « Filtres ».
 * La période par défaut (mois en cours) ne compte pas : c'est la vue normale,
 * pas un filtre qu'on aurait posé.
 */
export function countActiveFilters(filters: OperationFilters): number {
  let count = 0
  if (filters.type !== 'all') count += 1
  if (filters.categoryId !== 'all') count += 1
  if (filters.accountId !== 'all') count += 1
  if (filters.period !== EMPTY_FILTERS.period) count += 1
  return count
}

/** La date la plus ancienne acceptée par la période, ou undefined si aucune borne. */
export function periodStart(period: Period, today: IsoDate): IsoDate | undefined {
  const month = today.slice(0, 7)
  switch (period) {
    case 'currentMonth':
      return `${month}-01`
    case 'last3Months':
      // Le mois en cours plus les deux précédents.
      return `${addMonths(month, -2)}-01`
    case 'currentYear':
      return `${today.slice(0, 4)}-01-01`
    case 'all':
      return undefined
  }
}

/**
 * Le texte recherché correspond-il à cette opération ?
 *
 * On cherche dans le libellé et dans les noms de catégorie et de comptes — pas
 * dans les identifiants, qui ne veulent rien dire pour toi. Si la saisie
 * ressemble à un montant, on accepte aussi la correspondance exacte : taper
 * « 69 » retrouve la dépense de 69 €.
 */
function matchesSearch(
  transaction: Transaction,
  search: string,
  namesById: Map<string, string>,
): boolean {
  const needle = search.trim().toLocaleLowerCase('fr')
  if (needle === '') return true

  const haystack = [
    transaction.label,
    transaction.categoryId && namesById.get(transaction.categoryId),
    transaction.accountId && namesById.get(transaction.accountId),
    transaction.fromAccountId && namesById.get(transaction.fromAccountId),
    transaction.toAccountId && namesById.get(transaction.toAccountId),
  ]
    .filter((part): part is string => typeof part === 'string')
    .join(' ')
    .toLocaleLowerCase('fr')

  if (haystack.includes(needle)) return true

  const amount = parseAmountInput(search)
  return amount !== null && transaction.amount === amount
}

/** Une opération touche-t-elle ce compte, quel que soit son type ? */
function usesAccount(transaction: Transaction, accountId: string): boolean {
  return (
    transaction.accountId === accountId ||
    transaction.fromAccountId === accountId ||
    transaction.toAccountId === accountId
  )
}

/**
 * Applique tous les filtres, puis trie de la plus récente à la plus ancienne.
 * À date égale, la dernière saisie passe en premier : c'est celle que tu viens
 * d'enregistrer, tu t'attends à la voir en haut.
 */
export function filterTransactions(
  transactions: Transaction[],
  filters: OperationFilters,
  context: FilterContext,
): Transaction[] {
  const start = periodStart(filters.period, context.today)

  return transactions
    .filter((transaction) => {
      if (start !== undefined && transaction.date < start) return false
      if (filters.type !== 'all' && transaction.type !== filters.type) return false
      if (filters.categoryId !== 'all' && transaction.categoryId !== filters.categoryId) return false
      if (filters.accountId !== 'all' && !usesAccount(transaction, filters.accountId)) return false
      return matchesSearch(transaction, filters.search, context.namesById)
    })
    .sort(
      (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    )
}

/** Regroupe une liste déjà triée par jour, pour l'affichage. */
export function groupByDay(transactions: Transaction[]): [IsoDate, Transaction[]][] {
  const groups = new Map<IsoDate, Transaction[]>()
  for (const transaction of transactions) {
    const existing = groups.get(transaction.date)
    if (existing === undefined) groups.set(transaction.date, [transaction])
    else existing.push(transaction)
  }
  return [...groups.entries()]
}
