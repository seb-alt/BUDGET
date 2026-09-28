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

import { useMemo, useState, type CSSProperties } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { resolveMonthBudget } from '../../db/budgets'
import { db } from '../../db/db'
import { needsBackupReminder } from '../../domain/backup/backupFile'
import { applyFlexibleEnvelope } from '../../domain/budget/budgetEngine'
import { computeMonthSummary } from '../../domain/budget/monthSummary'
import { computeAccountBalances } from '../../domain/patrimony/accountBalance'
import { addMonths, currentMonth, formatDayLabel, formatMonthLabel } from '../../utils/date'
import { formatEurosCompact } from '../../utils/money'
import { BudgetDonutChart } from './BudgetDonutChart'
import { SavingsPlanCard } from './SavingsPlanCard'
import { BUDGET_GROUPS } from './groups'
import './Dashboard.css'

interface DashboardProps {
  onShowAllOperations: () => void
  onUpdateBalances: () => void
  onOpenSettings: () => void
}

export function Dashboard({
  onShowAllOperations,
  onUpdateBalances,
  onOpenSettings,
}: DashboardProps) {
  const [month, setMonth] = useState(currentMonth())

  const accounts = useLiveQuery(() => db.accounts.toArray(), [])
  const categories = useLiveQuery(() => db.categories.orderBy('[group+order]').toArray(), [])
  const budget = useLiveQuery(() => resolveMonthBudget(month), [month])
  const transactions = useLiveQuery(
    // Les dates sont des chaînes 'AAAA-MM-JJ' : tout le mois tient entre
    // '2026-09-01' et '2026-09-31', même pour les mois de 30 jours.
    () => db.transactions.where('date').between(`${month}-01`, `${month}-31`, true, true).toArray(),
    [month],
  )
  const settings = useLiveQuery(() => db.settings.get(1), [])
  // Le solde du LEP se calcule sur TOUT l'historique, pas sur le mois affiché.
  const allTransactions = useLiveQuery(() => db.transactions.toArray(), [])
  const snapshots = useLiveQuery(() => db.patrimonySnapshots.toArray(), [])

  /**
   * Les revenus personnels réellement encaissés ce mois-ci : c'est l'entrée de
   * la règle de l'enveloppe flexible. La micro-entreprise en est exclue, elle
   * a son propre onglet.
   */
  const actualIncome = useMemo(
    () =>
      (transactions ?? [])
        .filter((transaction) => transaction.type === 'income' && !transaction.isMicro)
        .reduce((total, transaction) => total + transaction.amount, 0),
    [transactions],
  )

  /**
   * Le budget du mois passe par le moteur AVANT d'être résumé : la ligne de
   * l'enveloppe flexible y est remplacée par le montant que la règle calcule.
   * Sans ça, la carte Épargne afficherait la ligne fixe du budget pendant que
   * la carte de proposition annoncerait autre chose.
   */
  const planned = useMemo(() => {
    if (!categories || !budget || !settings) return undefined
    return applyFlexibleEnvelope({
      budget: budget.lines,
      categories,
      actualIncome,
      flexibleCategoryId: settings.flexibleSavingsCategoryId,
      assuranceVieMonthly: budget.assuranceVieMonthly,
    })
  }, [categories, budget, settings, actualIncome])

  const summary = useMemo(() => {
    if (!accounts || !categories || !planned || !transactions) return undefined

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
      budget: planned.budget,
      savingCategoryAccounts,
    })
  }, [accounts, categories, planned, transactions, month])

  const lepBalance = useMemo(() => {
    if (!settings || !allTransactions || !snapshots) return 0
    return (
      computeAccountBalances([settings.lepAccountId], allTransactions, snapshots).get(
        settings.lepAccountId,
      )?.balance ?? 0
    )
  }, [settings, allTransactions, snapshots])

  const lastSnapshotDate = useMemo(
    () =>
      [...(snapshots ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0]?.date,
    [snapshots],
  )

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

  if (!summary || !categories || !budget || !planned || !settings || !accounts) {
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
        {/* Un mois révolu porte la mention « figé » : ses chiffres ne bougeront
            plus, même si tu changes ton budget l'an prochain (§11). */}
        {budget.frozen && (
          <p className="dash-frozen" title="Le budget de ce mois ne changera plus.">
            Budget figé
          </p>
        )}

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

      {/* Rappel discret, pas une alerte : tes données ne vivent que dans ce
          navigateur, et un nettoyage de stockage les effacerait sans prévenir. */}
      {needsBackupReminder(settings.lastBackupAt, new Date()) && (
        <button type="button" className="dash-backup" onClick={onOpenSettings}>
          {settings.lastBackupAt === undefined
            ? 'Tes données ne sont sauvegardées nulle part — en faire une copie'
            : 'Ta dernière sauvegarde date de plus d’un mois — en refaire une'}
        </button>
      )}

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

      {/* Le mois en cours seulement : proposer une répartition pour un mois
          révolu n'aurait aucun sens, l'argent est déjà placé. */}
      {isCurrentMonth && (
        <SavingsPlanCard
          savings={planned.savings}
          actualIncome={actualIncome}
          lepBalance={lepBalance}
          lepThreshold={budget.lepThreshold}
          lepAccountName={accounts.find((a) => a.id === settings.lepAccountId)?.name ?? 'LEP'}
          peaAccountName={accounts.find((a) => a.id === settings.peaAccountId)?.name ?? 'PEA'}
          lastSnapshotDate={lastSnapshotDate}
          onUpdateBalances={onUpdateBalances}
        />
      )}

      {BUDGET_GROUPS.map((card) => {
        const group = summary.byGroup[card.group]
        // Une catégorie désactivée reste affichée si elle a servi ce mois-ci :
        // sinon ses dépenses compteraient dans le total du groupe sans
        // apparaître nulle part, et le compte ne tomberait pas juste.
        const groupCategories = categories.filter(
          (category) =>
            category.group === card.group &&
            (category.active || (summary.byCategory[category.id]?.spent ?? 0) > 0),
        )

        // La barre est plafonnée à 100 % : au-delà, c'est la couleur et le
        // montant en rouge qui portent l'information, pas une barre qui
        // déborderait de son rail.
        const groupRatio = group.budget > 0 ? Math.min(group.spent / group.budget, 1) : 0
        const groupFilled = groupRatio * 100
        const groupPercent = group.budget > 0 ? Math.round((group.spent / group.budget) * 100) : 0

        return (
          /* --row-color descend dans toute la carte : la barre générale et les
             barres de détail prennent la couleur du groupe, et le rail en
             reprend une version diluée. Le rouge d'alerte remplace la couleur
             du groupe en cas de dépassement — mais la pastille d'identité, elle,
             ne change jamais. */
          <details
            key={card.group}
            className="dash-card"
            style={
              {
                '--row-color': group.remaining < 0 ? 'var(--chart-over)' : card.color,
              } as CSSProperties
            }
          >
            <summary>
              <span className="dash-card-title">
                <span className="color-dot" style={{ background: card.color }} aria-hidden="true" />
                {card.title}
              </span>

              {/* En gros : ce qu'il te reste — le chiffre qui sert à décider.
                  Puis la barre, pour saisir la proportion sans lire.
                  En petit : ce qui est déjà parti, sur le total de l'enveloppe. */}
              {/* « −65,50 € disponibles » ne veut rien dire : en cas de
                  dépassement on change la phrase, pas seulement le signe. */}
              <span className="dash-card-headline tabular">
                {group.remaining < 0 ? (
                  <>
                    <strong className="is-negative">
                      {formatEurosCompact(-group.remaining)}
                    </strong>{' '}
                    de dépassement
                  </>
                ) : (
                  <>
                    <strong>{formatEurosCompact(group.remaining)}</strong> {card.remainingWord}
                  </>
                )}
              </span>

              <span
                className="dash-bar dash-card-bar"
                role="img"
                aria-label={`${groupPercent} % du budget utilisé`}
              >
                <span className="dash-bar-fill" style={{ width: `${groupFilled}%` }} />
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
                  <li
                    key={category.id}
                    className="dash-line"
                    style={
                      {
                        '--row-color':
                          progress.remaining < 0 ? 'var(--chart-over)' : card.color,
                      } as CSSProperties
                    }
                  >
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
                      <div className="dash-bar-fill" style={{ width: `${ratio * 100}%` }} />
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

        <button type="button" className="dash-see-all" onClick={onShowAllOperations}>
          Voir toutes les opérations →
        </button>
      </section>

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
