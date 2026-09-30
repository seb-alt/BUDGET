/**
 * src/features/patrimony/PatrimonyScreen.tsx
 *
 * L'onglet Patrimoine (§8).
 *
 * Le chiffre principal est le patrimoine FINANCIER : ce que tu possèdes.
 * Le patrimoine NET (déduction faite du prêt étudiant) est une information
 * secondaire, en bas — c'est un chiffre déprimant en début de remboursement,
 * et ce n'est pas lui qu'on vient consulter tous les jours.
 *
 * Comme sur le Dashboard, cet écran ne calcule rien : il lit la base et
 * délègue à `domain/patrimony/`, qui est testé.
 */

import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { DonutChart } from '../../components/charts/DonutChart'
import { GroupedBarChart } from '../../components/charts/GroupedBarChart'
import { LineChart } from '../../components/charts/LineChart'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { db } from '../../db/db'
import type { Account } from '../../db/types'
import { computeAccountBalances } from '../../domain/patrimony/accountBalance'
import {
  buildPatrimonySeries,
  buildYearlySummaries,
  lastDayOfMonth,
  monthsBetween,
  netContributions,
  splitContributionAndPerformance,
} from '../../domain/patrimony/patrimonySeries'
import { addMonths, currentMonth, formatDayLabel, today } from '../../utils/date'
import { formatEurosCompact } from '../../utils/money'
import './Patrimony.css'

/** Les plages proposées pour la courbe, en nombre de mois. */
type Range = '6m' | '1a' | '3a' | '5a' | 'tout'

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: '6m', label: '6 mois' },
  { value: '1a', label: '1 an' },
  { value: '3a', label: '3 ans' },
  { value: '5a', label: '5 ans' },
  { value: 'tout', label: 'Tout' },
]

const RANGE_MONTHS: Record<Exclude<Range, 'tout'>, number> = { '6m': 6, '1a': 12, '3a': 36, '5a': 60 }

/** Une couleur par compte, dans l'ordre d'affichage. Palette vérifiée. */
const ACCOUNT_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)']

const MONTH_LABEL = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit' })

interface PatrimonyScreenProps {
  onUpdateBalances: () => void
}

export function PatrimonyScreen({ onUpdateBalances }: PatrimonyScreenProps) {
  const [range, setRange] = useState<Range>('1a')

  const accounts = useLiveQuery(() => db.accounts.orderBy('order').toArray(), [])
  const transactions = useLiveQuery(() => db.transactions.toArray(), [])
  const snapshots = useLiveQuery(() => db.patrimonySnapshots.toArray(), [])
  const settings = useLiveQuery(() => db.settings.get(1), [])

  /** Le patrimoine, c'est tout sauf la micro-entreprise, qui a son onglet. */
  const wealthAccounts = useMemo(
    () => (accounts ?? []).filter((account) => account.active && account.kind !== 'micro'),
    [accounts],
  )
  const accountIds = useMemo(() => wealthAccounts.map((account) => account.id), [wealthAccounts])

  /** Les comptes de placement : ce sont les seuls dont la valeur peut varier seule. */
  const investmentIds = useMemo(
    () => wealthAccounts.filter((account) => account.kind === 'investment').map((a) => a.id),
    [wealthAccounts],
  )

  /**
   * Les poches d'épargne, pour mesurer l'effort d'épargne.
   *
   * Important : on ne peut PAS le mesurer sur l'ensemble du patrimoine. Un
   * virement du compte courant vers le LEP sortirait d'un compte de l'ensemble
   * pour entrer dans un autre : les deux mouvements s'annuleraient et
   * l'épargne afficherait zéro. Elle se mesure sur la poche qui REÇOIT.
   */
  const savingsIds = useMemo(
    () => wealthAccounts.filter((account) => account.countsAsSavings).map((a) => a.id),
    [wealthAccounts],
  )

  const balances = useMemo(
    () => computeAccountBalances(accountIds, transactions ?? [], snapshots ?? []),
    [accountIds, transactions, snapshots],
  )

  const total = useMemo(
    () => accountIds.reduce((sum, id) => sum + (balances.get(id)?.balance ?? 0), 0),
    [accountIds, balances],
  )

  const series = useMemo(() => {
    if (transactions === undefined || snapshots === undefined || accountIds.length === 0) return []

    const dated = [
      ...transactions.map((transaction) => transaction.date),
      ...snapshots.map((snapshot) => snapshot.date),
    ].sort()
    if (dated.length === 0) return []

    const last = currentMonth()
    const firstRecorded = dated[0].slice(0, 7)
    const first =
      range === 'tout'
        ? firstRecorded
        : // On ne remonte pas plus loin que les données : une courbe qui
          // commence par des mois vides ne dit rien et écrase l'échelle.
          [addMonths(last, -(RANGE_MONTHS[range] - 1)), firstRecorded].sort().at(-1)!

    return buildPatrimonySeries(monthsBetween(first, last), accountIds, transactions, snapshots)
  }, [transactions, snapshots, accountIds, range])

  /** Variation du patrimoine ENTIER ce mois-ci : c'est bien tous les comptes. */
  const monthSplit = useMemo(() => {
    const month = currentMonth()
    return splitContributionAndPerformance(
      accountIds,
      transactions ?? [],
      snapshots ?? [],
      `${month}-01`,
      lastDayOfMonth(month),
    )
  }, [accountIds, transactions, snapshots])

  /** Effort d'épargne : mesuré sur les poches qui reçoivent, pas sur le tout. */
  const savedThisMonth = useMemo(() => {
    const month = currentMonth()
    return netContributions(
      savingsIds,
      transactions ?? [],
      `${month}-01`,
      lastDayOfMonth(month),
    )
  }, [savingsIds, transactions])

  const savedThisYear = useMemo(() => {
    const year = today().slice(0, 4)
    return netContributions(savingsIds, transactions ?? [], `${year}-01-01`, `${year}-12-31`)
  }, [savingsIds, transactions])

  const investmentSplit = useMemo(() => {
    const year = today().slice(0, 4)
    return splitContributionAndPerformance(
      investmentIds,
      transactions ?? [],
      snapshots ?? [],
      `${year}-01-01`,
      `${year}-12-31`,
    )
  }, [investmentIds, transactions, snapshots])

  const years = useMemo(() => {
    const recorded = (transactions ?? []).map((transaction) => Number(transaction.date.slice(0, 4)))
    if (recorded.length === 0) return []
    const first = Math.min(...recorded)
    const last = Number(today().slice(0, 4))
    return Array.from({ length: last - first + 1 }, (_, index) => first + index).slice(-5)
  }, [transactions])

  const yearly = useMemo(
    () => buildYearlySummaries(years, savingsIds, investmentIds, transactions ?? [], snapshots ?? []),
    [years, savingsIds, investmentIds, transactions, snapshots],
  )

  const lastSnapshotDate = useMemo(
    () => [...(snapshots ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0]?.date,
    [snapshots],
  )

  if (!accounts || !transactions || !snapshots || !settings) {
    return <p className="pat-loading">Chargement…</p>
  }

  const loan = settings.studentLoan
  const hasSnapshots = snapshots.length > 0

  return (
    <div className="pat">
      <h1 className="pat-title">Patrimoine</h1>

      <section className="pat-hero">
        <span className="pat-hero-label">Patrimoine financier</span>
        <strong className="pat-hero-value tabular">{formatEurosCompact(total)}</strong>
      </section>

      <section className="pat-indicators" aria-label="Indicateurs du patrimoine">
        <Indicator label="Évolution ce mois" amount={monthSplit.change} signed />
        <Indicator label="Épargné ce mois" amount={savedThisMonth} />
        <Indicator label="Épargné cette année" amount={savedThisYear} />
        <Indicator
          label={
            investmentSplit.performanceSince === undefined
              ? 'Valorisation des placements'
              : `Valorisation depuis le ${investmentSplit.performanceSince.split('-').reverse().join('/')}`
          }
          amount={investmentSplit.performance}
          signed
          muted={investmentSplit.performanceSince === undefined}
        />
      </section>

      {!hasSnapshots && (
        /* Sans relevé, le solde n'est que le cumul des opérations : dire que
           la performance vaut zéro serait vrai mais trompeur si on ne précise
           pas pourquoi. */
        <button type="button" className="pat-notice" onClick={onUpdateBalances}>
          Aucun relevé de soldes saisi : les montants ci-dessus ne reflètent que tes
          opérations enregistrées, et la valorisation ne peut pas être calculée.
          Saisir mes soldes →
        </button>
      )}

      <section className="pat-card">
        <h2>Évolution</h2>
        <div className="pat-range">
          <SegmentedControl
            label="Période affichée"
            value={range}
            options={RANGE_OPTIONS}
            onChange={setRange}
          />
        </div>
        <LineChart
          points={series.map((point) => ({
            label: MONTH_LABEL.format(new Date(`${point.month}-01T12:00:00`)),
            value: point.total,
          }))}
          description="Évolution du patrimoine financier"
          emptyMessage="Pas encore assez d'historique pour tracer une courbe."
        />
      </section>

      <section className="pat-card">
        <h2>Répartition actuelle</h2>
        <DonutChart
          slices={wealthAccounts.map((account, index) => ({
            key: account.id,
            label: account.name,
            color: ACCOUNT_COLORS[index % ACCOUNT_COLORS.length],
            value: Math.max(0, balances.get(account.id)?.balance ?? 0),
          }))}
          centerLabel="Total"
          description="Répartition du patrimoine par compte"
          emptyMessage="Aucun compte n'a de solde positif pour l'instant."
        />
      </section>

      <section className="pat-card">
        <h2>Versements et performance</h2>
        <p className="pat-subtitle">
          Ce que tu as mis de ta poche chaque année, et ce que tes placements ont gagné ou
          perdu par-dessus.
        </p>
        <GroupedBarChart
          groups={yearly.map((summary) => ({
            label: String(summary.year),
            values: [summary.contributions, summary.performance],
          }))}
          series={[
            { name: 'Versé', color: 'var(--chart-1)' },
            { name: 'Performance', color: 'var(--chart-3)' },
          ]}
          description="Versements et performance par année"
          emptyMessage="Aucune opération enregistrée pour l'instant."
        />
      </section>

      <section className="pat-card">
        <h2>Mes comptes</h2>
        <ul className="pat-accounts">
          {wealthAccounts.map((account, index) => (
            <AccountRow
              key={account.id}
              account={account}
              color={ACCOUNT_COLORS[index % ACCOUNT_COLORS.length]}
              balance={balances.get(account.id)?.balance ?? 0}
              contributedThisMonth={splitContributionAndPerformance(
                [account.id],
                transactions,
                snapshots,
                `${currentMonth()}-01`,
                lastDayOfMonth(currentMonth()),
              ).contributions}
            />
          ))}
        </ul>
        <button type="button" className="pat-update" onClick={onUpdateBalances}>
          {lastSnapshotDate === undefined
            ? 'Aucun relevé — saisir mes soldes'
            : `Dernier relevé : ${formatDayLabel(lastSnapshotDate)} · Actualiser`}
        </button>
      </section>

      <section className="pat-card">
        <h2>Prêt étudiant</h2>
        <div className="pat-loan">
          <div className="pat-loan-head">
            <span>Capital restant dû</span>
            <strong className="tabular">{formatEurosCompact(loan.remainingCapital)}</strong>
          </div>
          <div
            className="dash-bar pat-loan-bar"
            role="img"
            aria-label={`Prêt remboursé à ${Math.round(
              loan.initialAmount > 0
                ? (1 - loan.remainingCapital / loan.initialAmount) * 100
                : 0,
            )} %`}
          >
            <div
              className="dash-bar-fill"
              style={{
                width: `${
                  loan.initialAmount > 0
                    ? Math.max(0, Math.min(1, 1 - loan.remainingCapital / loan.initialAmount)) * 100
                    : 0
                }%`,
              }}
            />
          </div>
          <p className="pat-loan-note">
            Remboursé : {formatEurosCompact(Math.max(0, loan.initialAmount - loan.remainingCapital))}{' '}
            sur {formatEurosCompact(loan.initialAmount)} · {formatEurosCompact(loan.monthlyPayment)} par
            mois
          </p>
        </div>

        {/* Le patrimoine net arrive APRÈS, et en petit : c'est une information
            utile, pas celle qu'on vient chercher chaque semaine. */}
        <p className="pat-net">
          Patrimoine net, dette déduite :{' '}
          <strong className="tabular">{formatEurosCompact(total - loan.remainingCapital)}</strong>
        </p>
      </section>
    </div>
  )
}

function Indicator({
  label,
  amount,
  signed = false,
  muted = false,
}: {
  label: string
  amount: number
  signed?: boolean
  muted?: boolean
}) {
  const tone = !signed || amount === 0 ? '' : amount > 0 ? ' is-positive' : ' is-negative'
  return (
    <div className={`pat-indicator${muted ? ' is-muted' : ''}`}>
      <span className="pat-indicator-label">{label}</span>
      <strong className={`pat-indicator-value tabular${tone}`}>
        {signed && amount > 0 ? '+' : ''}
        {formatEurosCompact(amount)}
      </strong>
    </div>
  )
}

function AccountRow({
  account,
  color,
  balance,
  contributedThisMonth,
}: {
  account: Account
  color: string
  balance: number
  contributedThisMonth: number
}) {
  const ratio =
    account.ceiling !== undefined && account.ceiling > 0
      ? Math.min(balance / account.ceiling, 1)
      : undefined

  return (
    <li className="pat-account" style={{ ['--row-color' as string]: color }}>
      <div className="pat-account-head">
        <span className="pat-account-name">
          <span className="color-dot" style={{ background: color }} aria-hidden="true" />
          {account.name}
        </span>
        <strong className="tabular">{formatEurosCompact(balance)}</strong>
      </div>

      {ratio !== undefined && (
        <>
          <div
            className="dash-bar"
            role="img"
            aria-label={`${account.name} rempli à ${Math.round(ratio * 100)} %`}
          >
            <div className="dash-bar-fill" style={{ width: `${ratio * 100}%` }} />
          </div>
          <p className="pat-account-note">
            {formatEurosCompact(balance)} / {formatEurosCompact(account.ceiling!)} —{' '}
            {Math.round(ratio * 100)} %
          </p>
        </>
      )}

      {contributedThisMonth !== 0 && (
        <p className="pat-account-note">
          {contributedThisMonth > 0 ? '+' : ''}
          {formatEurosCompact(contributedThisMonth)} ce mois-ci
        </p>
      )}
    </li>
  )
}
