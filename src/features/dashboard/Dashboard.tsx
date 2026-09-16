/**
 * src/features/dashboard/Dashboard.tsx
 *
 * L'écran d'accueil. Version volontairement réduite à ce stade :
 * les 4 indicateurs, les 3 cartes budgétaires repliables, et les dernières
 * opérations. Les graphiques et le résumé Micro viendront ensuite.
 *
 * Ce composant ne calcule RIEN lui-même : il lit la base, passe les données à
 * `computeMonthSummary` (dans domain/, testé), et affiche le résultat.
 */

import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { resolveBudgetForMonth } from '../../db/budgets'
import { db } from '../../db/db'
import { computeMonthSummary } from '../../domain/budget/monthSummary'
import { addMonths, currentMonth, formatDayLabel, formatMonthLabel } from '../../utils/date'
import { formatEurosCompact } from '../../utils/money'
import { BudgetDonutChart } from './BudgetDonutChart'
import { BudgetProgressChart } from './BudgetProgressChart'
import { BUDGET_GROUPS } from './groups'
import './Dashboard.css'

export function Dashboard() {
  const [month, setMonth] = useState(currentMonth())

  const accounts = useLiveQuery(() => db.accounts.toArray(), [])
  const categories = useLiveQuery(() => db.categories.orderBy('[group+order]').toArray(), [])
  const budget = useLiveQuery(() => resolveBudgetForMonth(month), [month])
  const transactions = useLiveQuery(
    // Les dates sont des chaînes 'AAAA-MM-JJ' : tout le mois tient entre
    // '2026-09-01' et '2026-09-31', même pour les mois de 30 jours.
    () => db.transactions.where('date').between(`${month}-01`, `${month}-31`, true, true).toArray(),
    [month],
  )

  const summary = useMemo(() => {
    if (!accounts || !categories || !budget || !transactions) return undefined

    const savingCategoryAccounts = Object.fromEntries(
      categories
        .filter((category) => category.savingAccountIds !== undefined)
        .map((category) => [category.id, category.savingAccountIds ?? []]),
    )

    return computeMonthSummary({
      month,
      transactions,
      accounts,
      categories,
      budget,
      savingCategoryAccounts,
    })
  }, [accounts, categories, budget, transactions, month])

  const namesById = useMemo(() => {
    const map = new Map<string, string>()
    for (const category of categories ?? []) map.set(category.id, category.name)
    for (const account of accounts ?? []) map.set(account.id, account.name)
    return map
  }, [categories, accounts])

  const recentByDay = useMemo(() => {
    const recent = [...(transactions ?? [])]
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6)

    const groups = new Map<string, typeof recent>()
    for (const transaction of recent) {
      const existing = groups.get(transaction.date) ?? []
      existing.push(transaction)
      groups.set(transaction.date, existing)
    }
    return [...groups.entries()]
  }, [transactions])

  if (!summary || !categories) {
    return <p className="dash-loading">Chargement…</p>
  }

  const isCurrentMonth = month === currentMonth()

  return (
    <div className="dash">
      <header className="dash-header">
        <div className="dash-month">
          <button
            type="button"
            className="dash-month-arrow"
            aria-label="Mois précédent"
            onClick={() => setMonth(addMonths(month, -1))}
          >
            ‹
          </button>
          <span className="dash-month-label">{formatMonthLabel(month)}</span>
          <button
            type="button"
            className="dash-month-arrow"
            aria-label="Mois suivant"
            onClick={() => setMonth(addMonths(month, 1))}
          >
            ›
          </button>
        </div>
        {!isCurrentMonth && (
          <button
            type="button"
            className="dash-today"
            onClick={() => setMonth(currentMonth())}
          >
            Revenir au mois en cours
          </button>
        )}
      </header>

      <section className="dash-indicators" aria-label="Indicateurs du mois">
        <Indicator label="Entrées du mois" amount={summary.income} tone="positive" />
        <Indicator label="Sorties du mois" amount={summary.expenses} tone="negative" />
        <Indicator label="Épargne du mois" amount={summary.savings} tone="accent" />
        <Indicator
          label="Loisirs restants"
          amount={summary.leisureRemaining}
          tone={summary.leisureRemaining < 0 ? 'negative' : 'neutral'}
        />
      </section>

      {BUDGET_GROUPS.map((card) => {
        const group = summary.byGroup[card.group]
        const groupCategories = categories.filter(
          (category) => category.group === card.group && category.active,
        )

        return (
          <details key={card.group} className="dash-card">
            <summary>
              <span className="dash-card-title">
                <span className="chart-dot" style={{ background: card.color }} aria-hidden="true" />
                {card.title}
              </span>

              {/* En gros : ce qu'il te reste — le chiffre qui sert à décider.
                  En petit juste en dessous : ce qui est déjà parti, sur le
                  total de l'enveloppe. */}
              <span className="dash-card-headline tabular">
                <strong className={group.remaining < 0 ? 'is-negative' : undefined}>
                  {formatEurosCompact(group.remaining)}
                </strong>{' '}
                {card.remainingWord}
              </span>
              <span className="dash-card-used tabular">
                {formatEurosCompact(group.spent)} / {formatEurosCompact(group.budget)} utilisés
              </span>
            </summary>

            <ul className="dash-lines">
              {groupCategories.map((category) => {
                const progress = summary.byCategory[category.id]
                if (progress === undefined) return null
                const ratio =
                  progress.budget > 0 ? Math.min(progress.spent / progress.budget, 1) : 0

                return (
                  <li key={category.id} className="dash-line">
                    <div className="dash-line-head">
                      <span>{category.name}</span>
                      <span className="tabular">
                        {formatEurosCompact(progress.spent)} / {formatEurosCompact(progress.budget)}
                      </span>
                    </div>
                    <div
                      className="dash-bar"
                      role="img"
                      aria-label={`${Math.round(ratio * 100)} % du budget utilisé`}
                    >
                      <div
                        className={`dash-bar-fill${progress.remaining < 0 ? ' is-over' : ''}`}
                        style={{ width: `${ratio * 100}%` }}
                      />
                    </div>
                    <p className={`dash-line-rest${progress.remaining < 0 ? ' is-negative' : ''}`}>
                      {progress.remaining < 0
                        ? `Dépassement : ${formatEurosCompact(-progress.remaining)}`
                        : `Reste : ${formatEurosCompact(progress.remaining)}`}
                    </p>
                  </li>
                )
              })}
            </ul>
          </details>
        )
      })}

      <section className="dash-card dash-recent">
        <h2>Dernières opérations</h2>
        {recentByDay.length === 0 ? (
          <p className="dash-empty">
            Aucune opération ce mois-ci. Appuie sur <strong>+</strong> pour en ajouter une.
          </p>
        ) : (
          recentByDay.map(([date, dayTransactions]) => (
            <div key={date} className="dash-day">
              <h3>{formatDayLabel(date)}</h3>
              <ul className="dash-ops">
                {dayTransactions.map((transaction) => {
                  const isIncome = transaction.type === 'income'
                  const isTransfer = transaction.type === 'transfer'
                  const title = isTransfer
                    ? `${namesById.get(transaction.fromAccountId ?? '') ?? '?'} → ${
                        namesById.get(transaction.toAccountId ?? '') ?? '?'
                      }`
                    : (namesById.get(transaction.categoryId ?? '') ?? 'Sans catégorie')

                  return (
                    <li key={transaction.id} className="dash-op">
                      <div className="dash-op-text">
                        <span className="dash-op-title">{title}</span>
                        {transaction.label !== undefined && (
                          <span className="dash-op-label">{transaction.label}</span>
                        )}
                      </div>
                      <span
                        className={`dash-op-amount tabular${
                          isIncome ? ' is-positive' : isTransfer ? ' is-transfer' : ''
                        }`}
                      >
                        {isTransfer ? '' : isIncome ? '+' : '−'}
                        {formatEurosCompact(transaction.amount)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))
        )}
      </section>

      <BudgetProgressChart summary={summary} categories={categories} />
      <BudgetDonutChart summary={summary} />
    </div>
  )
}

function Indicator({
  label,
  amount,
  tone,
}: {
  label: string
  amount: number
  tone: 'positive' | 'negative' | 'accent' | 'neutral'
}) {
  return (
    <div className={`dash-indicator tone-${tone}`}>
      <span className="dash-indicator-label">{label}</span>
      <strong className="dash-indicator-value tabular">{formatEurosCompact(amount)}</strong>
    </div>
  )
}
