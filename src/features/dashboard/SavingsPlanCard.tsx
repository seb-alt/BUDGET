/**
 * src/features/dashboard/SavingsPlanCard.tsx
 *
 * « Où va mon épargne ce mois-ci » — la répartition LEP / PEA.
 *
 * C'est une PROPOSITION, pas un constat. L'application ne vire rien à ta place
 * et n'a aucun lien avec ta banque : elle dit seulement comment répartir le
 * montant que TU as budgété pour cette enveloppe. Les virements réellement
 * enregistrés apparaissent, eux, dans la carte Épargne & investissement.
 *
 * La carte ne décide plus du montant à épargner — c'est ta ligne de budget qui
 * le fixe. Elle répond à la question suivante : de ces 350 €, combien sur le
 * LEP tant qu'il n'est pas plein, et combien sur le PEA.
 */

import type { Cents } from '../../db/types'
import type { MonthBalanceResult } from '../../domain/budget/budgetEngine'
import { splitLepPea } from '../../domain/budget/lepPeaEngine'
import { formatEurosCompact } from '../../utils/money'
import { formatDayLabel } from '../../utils/date'
import './SavingsPlanCard.css'

interface SavingsPlanCardProps {
  /** Le montant budgété pour l'enveloppe LEP / PEA, à répartir. */
  envelope: Cents
  balance: MonthBalanceResult
  actualIncome: Cents
  lepBalance: Cents
  lepThreshold: Cents
  lepAccountName: string
  peaAccountName: string
  /** Date du dernier relevé manuel de soldes, s'il y en a un. */
  lastSnapshotDate?: string
  onUpdateBalances: () => void
}

export function SavingsPlanCard({
  envelope,
  balance,
  actualIncome,
  lepBalance,
  lepThreshold,
  lepAccountName,
  peaAccountName,
  lastSnapshotDate,
  onUpdateBalances,
}: SavingsPlanCardProps) {
  const split = splitLepPea({ flexible: envelope, lepBalance, lepThreshold })
  const lepRatio = lepThreshold > 0 ? Math.min(lepBalance / lepThreshold, 1) : 0

  return (
    <section className="plan">
      <h2>Ce mois-ci</h2>

      <dl className="plan-maths">
        <div>
          <dt>Revenus encaissés</dt>
          <dd className="tabular">{formatEurosCompact(actualIncome)}</dd>
        </div>
        <div>
          <dt>Budget du mois</dt>
          <dd className="tabular">− {formatEurosCompact(balance.budgeted)}</dd>
        </div>
        <div className="plan-total">
          <dt>{balance.deficit > 0 ? 'Revenus attendus' : 'Non affecté'}</dt>
          <dd className="tabular">
            {formatEurosCompact(balance.deficit > 0 ? balance.deficit : balance.unallocated)}
          </dd>
        </div>
      </dl>

      {balance.deficit > 0 && (
        /*
           Pas de ton d'alerte ici : cette carte ne s'affiche que pour le mois
           EN COURS. Le 1er, le loyer est parti et la paie n'est pas arrivée —
           le budget semble découvert alors qu'il ne manque que du temps.
           Peindre ça en rouge chaque début de mois apprendrait surtout à
           ignorer le rouge.

           Et quoi qu'il arrive, l'application ne rogne jamais une enveloppe
           d'elle-même : c'est à toi de décider ce que tu ajustes.
        */
        <p className="plan-empty">
          Il te reste {formatEurosCompact(balance.deficit)} à encaisser pour couvrir ton budget
          du mois. Rien n’a été réduit automatiquement — le solde de ton compte, en haut, dit où
          tu en es vraiment.
        </p>
      )}

      {/* L'avertissement est ICI et pas dans le titre de la carte : c'est la
          répartition qui pourrait se prendre pour un ordre de virement, pas le
          constat des revenus. */}
      <h3 className="plan-subtitle">Enveloppe LEP / PEA — à virer toi-même</h3>

      {envelope === 0 ? (
        <p className="plan-empty">
          Aucun montant budgété pour cette enveloppe. Règle-le dans Paramètres → Budget mensuel
          : c'est toi qui décides combien y mettre.
        </p>
      ) : (
        <ul className="plan-split">
          <li>
            <span className="plan-split-name">→ {lepAccountName}</span>
            <span className="plan-split-amount tabular">{formatEurosCompact(split.toLep)}</span>
          </li>
          <li>
            <span className="plan-split-name">→ {peaAccountName}</span>
            <span className="plan-split-amount tabular">{formatEurosCompact(split.toPea)}</span>
          </li>
        </ul>
      )}

      <div className="plan-lep">
        <div className="plan-lep-head">
          <span>
            {lepAccountName}
            {split.lepFull && ' — plein'}
          </span>
          <span className="tabular">
            {formatEurosCompact(lepBalance)} / {formatEurosCompact(lepThreshold)}
          </span>
        </div>
        <div
          className="dash-bar"
          role="img"
          aria-label={`${lepAccountName} rempli à ${Math.round(lepRatio * 100)} %`}
        >
          <div className="dash-bar-fill" style={{ width: `${lepRatio * 100}%` }} />
        </div>
      </div>

      <button type="button" className="plan-update" onClick={onUpdateBalances}>
        {lastSnapshotDate === undefined
          ? 'Aucun relevé de soldes — en saisir un'
          : `Dernier relevé : ${formatDayLabel(lastSnapshotDate)} · Actualiser`}
      </button>
    </section>
  )
}
