/**
 * src/features/dashboard/SavingsPlanCard.tsx
 *
 * « Où va mon épargne ce mois-ci » — le résultat des deux règles du §4.
 *
 * C'est une PROPOSITION, pas un constat : l'application calcule ce qu'il
 * faudrait verser, elle ne vire rien à ta place. Les virements que tu fais
 * réellement apparaissent, eux, dans la carte Épargne & investissement.
 */

import type { Cents } from '../../db/types'
import type { FlexibleSavingsResult } from '../../domain/budget/budgetEngine'
import { splitLepPea } from '../../domain/budget/lepPeaEngine'
import { formatEurosCompact } from '../../utils/money'
import { formatDayLabel } from '../../utils/date'
import './SavingsPlanCard.css'

interface SavingsPlanCardProps {
  savings: FlexibleSavingsResult
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
  savings,
  actualIncome,
  lepBalance,
  lepThreshold,
  lepAccountName,
  peaAccountName,
  lastSnapshotDate,
  onUpdateBalances,
}: SavingsPlanCardProps) {
  const split = splitLepPea({ flexible: savings.flexible, lepBalance, lepThreshold })
  const lepRatio = lepThreshold > 0 ? Math.min(lepBalance / lepThreshold, 1) : 0

  return (
    <section className="plan">
      <h2>Épargne du mois — proposition</h2>

      <dl className="plan-maths">
        <div>
          <dt>Revenus encaissés</dt>
          <dd className="tabular">{formatEurosCompact(actualIncome)}</dd>
        </div>
        <div>
          <dt>Budget incompressible</dt>
          <dd className="tabular">− {formatEurosCompact(savings.incompressible)}</dd>
        </div>
        <div className="plan-total">
          <dt>Enveloppe flexible</dt>
          <dd className="tabular">{formatEurosCompact(savings.flexible)}</dd>
        </div>
      </dl>

      {savings.deficit > 0 ? (
        /* On annonce le manque sans rien décider : c'est à toi de choisir ce
           que tu ajustes, l'application ne rogne jamais une enveloppe seule. */
        <p className="plan-deficit">
          Il manque <strong>{formatEurosCompact(savings.deficit)}</strong> pour couvrir
          tes charges fixes, tes loisirs et ton assurance-vie ce mois-ci. Rien n'a été
          réduit automatiquement : à toi de voir ce que tu ajustes.
        </p>
      ) : savings.flexible === 0 ? (
        <p className="plan-empty">
          Tes revenus couvrent tout juste ton budget incompressible : rien à répartir
          ce mois-ci.
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
