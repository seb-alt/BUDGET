/**
 * src/features/dashboard/BudgetProgressChart.tsx
 *
 * « Avancement des budgets » : une barre par sous-catégorie, qui montre la
 * part du budget déjà consommée.
 *
 * Forme choisie : une jauge par ligne, pas un histogramme classique. La
 * question à laquelle on répond n'est pas « qui dépense le plus » mais
 * « où en suis-je par rapport à ma limite » — c'est un rapport à un plafond,
 * et une jauge le montre directement.
 *
 * L'ordre des lignes est stable d'un mois sur l'autre (groupe, puis ordre de
 * la catégorie) : on retrouve toujours Shopping au même endroit.
 */

import type { CSSProperties } from 'react'
import type { Category } from '../../db/types'
import type { MonthSummary } from '../../domain/budget/monthSummary'
import { formatEurosCompact } from '../../utils/money'
import { BUDGET_GROUPS } from './groups'
import './charts.css'

interface BudgetProgressChartProps {
  summary: MonthSummary
  categories: Category[]
}

export function BudgetProgressChart({ summary, categories }: BudgetProgressChartProps) {
  const groups = BUDGET_GROUPS.map((definition) => ({
    ...definition,
    rows: categories
      .filter(
        (category) =>
          category.group === definition.group &&
          category.active &&
          (summary.byCategory[category.id]?.budget ?? 0) > 0,
      )
      .map((category) => ({ category, progress: summary.byCategory[category.id] })),
  })).filter((group) => group.rows.length > 0)

  if (groups.length === 0) {
    return null
  }

  return (
    <section className="chart-card">
      <h2>Avancement des budgets</h2>
      <p className="chart-subtitle">Part de chaque enveloppe déjà utilisée ce mois-ci.</p>

      {groups.map((group) => (
        <div key={group.group} className="chart-group">
          <h3>
            <span className="chart-dot" style={{ background: group.color }} aria-hidden="true" />
            {group.title}
          </h3>

          <ul className="chart-rows">
            {group.rows.map(({ category, progress }) => {
              const isOver = progress.remaining < 0
              // La jauge est plafonnée à 100 % : au-delà, c'est la couleur et
              // la mention « dépassement » qui portent l'information, pas une
              // barre qui déborderait de son rail.
              const filled = Math.min(progress.spent / progress.budget, 1) * 100
              const percent = Math.round((progress.spent / progress.budget) * 100)

              return (
                <li
                  key={category.id}
                  className="chart-row"
                  // La couleur est posée une seule fois sur la ligne : la
                  // barre la porte à pleine intensité, le rail la reprend très
                  // diluée. L'état se lit ainsi sur toute la longueur.
                  style={{ '--row-color': isOver ? 'var(--chart-over)' : group.color } as CSSProperties}
                >
                  <div className="chart-row-head">
                    <span className="chart-row-name">{category.name}</span>
                    <span className="chart-row-value tabular">
                      {formatEurosCompact(progress.spent)} / {formatEurosCompact(progress.budget)}
                    </span>
                  </div>

                  <div
                    className="chart-track"
                    role="img"
                    aria-label={`${category.name} : ${percent} % du budget utilisé`}
                  >
                    <div className="chart-fill" style={{ width: `${filled}%` }} />
                  </div>

                  <p className={`chart-row-note${isOver ? ' is-over' : ''}`}>
                    {isOver
                      ? `Dépassement de ${formatEurosCompact(-progress.remaining)}`
                      : `${percent} % utilisé`}
                  </p>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </section>
  )
}
