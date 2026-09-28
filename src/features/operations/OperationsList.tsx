/**
 * src/features/operations/OperationsList.tsx
 *
 * L'onglet Opérations (§6) : la liste complète, avec recherche, filtres,
 * modification et suppression.
 *
 * Choix d'ergonomie : la recherche est toujours visible, les autres filtres
 * sont repliés derrière un bouton qui affiche leur nombre. Sur un téléphone,
 * cinq contrôles empilés en permanence repousseraient la liste hors de l'écran
 * — or c'est la liste qu'on vient voir.
 *
 * Aucun calcul ici : le tri et le filtrage viennent de `domain/operations/`,
 * qui est testé.
 */

import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Transaction } from '../../db/types'
import {
  EMPTY_FILTERS,
  countActiveFilters,
  filterTransactions,
  groupByDay,
  type OperationFilters,
  type Period,
} from '../../domain/operations/filterTransactions'
import { formatDayLabel, today } from '../../utils/date'
import { formatEurosCompact } from '../../utils/money'
import './OperationsList.css'

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'currentMonth', label: 'Ce mois-ci' },
  { value: 'last3Months', label: '3 derniers mois' },
  { value: 'currentYear', label: 'Cette année' },
  { value: 'all', label: 'Tout' },
]

const TYPE_OPTIONS = [
  { value: 'all', label: 'Tous' },
  { value: 'expense', label: 'Dépenses' },
  { value: 'income', label: 'Entrées' },
  { value: 'transfer', label: 'Transferts' },
] as const

/** On n'affiche pas des années d'opérations d'un coup : la page ramerait. */
const PAGE_SIZE = 50

interface OperationsListProps {
  onEdit: (transaction: Transaction) => void
}

export function OperationsList({ onEdit }: OperationsListProps) {
  const [filters, setFilters] = useState<OperationFilters>(EMPTY_FILTERS)
  const [isPanelOpen, setPanelOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const transactions = useLiveQuery(() => db.transactions.toArray(), [])
  const categories = useLiveQuery(() => db.categories.orderBy('[group+order]').toArray(), [])
  const accounts = useLiveQuery(() => db.accounts.orderBy('order').toArray(), [])

  const namesById = useMemo(() => {
    const map = new Map<string, string>()
    for (const category of categories ?? []) map.set(category.id, category.name)
    for (const account of accounts ?? []) map.set(account.id, account.name)
    return map
  }, [categories, accounts])

  const matching = useMemo(
    () => filterTransactions(transactions ?? [], filters, { today: today(), namesById }),
    [transactions, filters, namesById],
  )

  const visible = matching.slice(0, visibleCount)
  const days = groupByDay(visible)
  const activeFilters = countActiveFilters(filters)

  /** Toute modification de filtre ramène la liste à sa première page. */
  function update(patch: Partial<OperationFilters>) {
    setFilters((current) => ({ ...current, ...patch }))
    setVisibleCount(PAGE_SIZE)
  }

  const totals = useMemo(() => {
    const sum = (type: Transaction['type']) =>
      matching
        .filter((transaction) => transaction.type === type)
        .reduce((total, transaction) => total + transaction.amount, 0)
    return { expenses: sum('expense'), income: sum('income') }
  }, [matching])

  if (!transactions || !categories || !accounts) {
    return <p className="ops-loading">Chargement…</p>
  }

  return (
    <div className="ops">
      <h1 className="ops-title">Opérations</h1>

      <div className="ops-search">
        <input
          type="search"
          value={filters.search}
          placeholder="Libellé, catégorie, compte, montant…"
          aria-label="Rechercher une opération"
          onChange={(event) => update({ search: event.target.value })}
        />
        <button
          type="button"
          className={`ops-filter-toggle${activeFilters > 0 ? ' is-active' : ''}`}
          aria-expanded={isPanelOpen}
          onClick={() => setPanelOpen((open) => !open)}
        >
          Filtres
          {activeFilters > 0 && <span className="ops-filter-count">{activeFilters}</span>}
        </button>
      </div>

      {isPanelOpen && (
        <div className="ops-panel">
          <label className="ops-field">
            <span>Période</span>
            <select
              value={filters.period}
              onChange={(event) => update({ period: event.target.value as Period })}
            >
              {PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="ops-field">
            <span>Type</span>
            <select
              value={filters.type}
              onChange={(event) =>
                update({ type: event.target.value as OperationFilters['type'] })
              }
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="ops-field">
            <span>Catégorie</span>
            <select
              value={filters.categoryId}
              onChange={(event) => update({ categoryId: event.target.value })}
            >
              <option value="all">Toutes</option>
              {categories
                .filter((category) => category.active)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </select>
          </label>

          <label className="ops-field">
            <span>Compte</span>
            <select
              value={filters.accountId}
              onChange={(event) => update({ accountId: event.target.value })}
            >
              <option value="all">Tous</option>
              {accounts
                .filter((account) => account.active)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
            </select>
          </label>

          {(activeFilters > 0 || filters.search !== '') && (
            <button
              type="button"
              className="ops-reset"
              onClick={() => {
                setFilters(EMPTY_FILTERS)
                setVisibleCount(PAGE_SIZE)
              }}
            >
              Tout réinitialiser
            </button>
          )}
        </div>
      )}

      <p className="ops-summary">
        {matching.length === 0
          ? 'Aucune opération'
          : `${matching.length} opération${matching.length > 1 ? 's' : ''}`}
        {totals.expenses > 0 && ` · ${formatEurosCompact(totals.expenses)} de sorties`}
        {totals.income > 0 && ` · ${formatEurosCompact(totals.income)} d'entrées`}
      </p>

      {matching.length === 0 ? (
        <p className="ops-empty">
          Rien ne correspond. Élargis la période ou efface la recherche.
        </p>
      ) : (
        days.map(([date, dayTransactions]) => (
          <section key={date} className="ops-day">
            <h2>{formatDayLabel(date)}</h2>
            <ul>
              {dayTransactions.map((transaction) => (
                <li key={transaction.id}>
                  {/* Toute la ligne est un bouton : sur un téléphone, viser une
                      petite icône « modifier » est pénible. */}
                  <button type="button" onClick={() => onEdit(transaction)}>
                    <span className="ops-row-text">
                      <span className="ops-row-title">
                        {transaction.type === 'transfer'
                          ? `${namesById.get(transaction.fromAccountId ?? '') ?? '?'} → ${
                              namesById.get(transaction.toAccountId ?? '') ?? '?'
                            }`
                          : (namesById.get(transaction.categoryId ?? '') ?? 'Sans catégorie')}
                      </span>
                      <span className="ops-row-meta">
                        {transaction.label ??
                          (transaction.type === 'transfer'
                            ? 'Transfert'
                            : (namesById.get(transaction.accountId ?? '') ?? ''))}
                      </span>
                    </span>
                    <span
                      className={`ops-row-amount tabular${
                        transaction.type === 'income'
                          ? ' is-positive'
                          : transaction.type === 'transfer'
                            ? ' is-transfer'
                            : ''
                      }`}
                    >
                      {transaction.type === 'transfer'
                        ? ''
                        : transaction.type === 'income'
                          ? '+'
                          : '−'}
                      {formatEurosCompact(transaction.amount)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {matching.length > visible.length && (
        <button
          type="button"
          className="ops-more"
          onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
        >
          Voir {Math.min(PAGE_SIZE, matching.length - visible.length)} opérations de plus
        </button>
      )}
    </div>
  )
}
