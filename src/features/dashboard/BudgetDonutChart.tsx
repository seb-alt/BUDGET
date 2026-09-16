/**
 * src/features/dashboard/BudgetDonutChart.tsx
 *
 * Le graphique en secteurs de la répartition du budget.
 *
 * Deux lectures au choix :
 *  - « Prévu »   : comment tes 2 000 € sont répartis entre les trois enveloppes ;
 *  - « Réalisé » : où l'argent est réellement parti ce mois-ci.
 *
 * Il est dessiné à la main en SVG, sans bibliothèque de graphiques. Trois
 * raisons : l'application reste légère (une bibliothèque pèse plus lourd que
 * tout le reste du code réuni), les couleurs suivent les variables du thème
 * donc le mode sombre fonctionne sans effort, et il n'y a aucune dépendance
 * extérieure à maintenir pendant des années.
 */

import { useState } from 'react'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import type { MonthSummary } from '../../domain/budget/monthSummary'
import { formatEurosCompact } from '../../utils/money'
import { buildDonutSegments, CENTER } from './donutGeometry'
import { BUDGET_GROUPS } from './groups'
import './charts.css'

type DonutMode = 'planned' | 'actual'

const MODE_OPTIONS: { value: DonutMode; label: string }[] = [
  { value: 'planned', label: 'Prévu' },
  { value: 'actual', label: 'Réalisé' },
]

export function BudgetDonutChart({ summary }: { summary: MonthSummary }) {
  const [mode, setMode] = useState<DonutMode>('planned')
  const [focused, setFocused] = useState<string>()

  const slices = BUDGET_GROUPS.map((definition) => {
    const group = summary.byGroup[definition.group]
    return {
      key: definition.group,
      label: definition.title,
      color: definition.color,
      value: mode === 'planned' ? group.budget : group.spent,
    }
  }).filter((slice) => slice.value > 0)

  const total = slices.reduce((sum, slice) => sum + slice.value, 0)

  if (total === 0) {
    return (
      <section className="chart-card">
        <ChartHeader mode={mode} onModeChange={setMode} />
        <p className="chart-empty">
          Rien n'a encore été dépensé ni versé ce mois-ci.
        </p>
      </section>
    )
  }

  const segments = buildDonutSegments(slices)

  const focusedSegment = segments.find((segment) => segment.key === focused)

  return (
    <section className="chart-card">
      <ChartHeader mode={mode} onModeChange={setMode} />

      <div className="donut">
        {/* Le cadre déborde du cercle : les pourcentages sont posés à
            l'extérieur de l'anneau et doivent tenir entièrement, sinon le
            « % » se fait rogner au bord droit. */}
        <svg
          viewBox="-26 -4 252 208"
          className="donut-svg"
          role="img"
          aria-label={
            `Répartition ${mode === 'planned' ? 'prévue' : 'réalisée'} : ` +
            segments.map((s) => `${s.label} ${s.share} %`).join(', ')
          }
        >
          {segments.map((segment) => (
            <path
              key={segment.key}
              d={segment.path}
              fill={segment.color}
              className={`donut-slice${focused !== undefined && focused !== segment.key ? ' is-dimmed' : ''}`}
              onMouseEnter={() => setFocused(segment.key)}
              onMouseLeave={() => setFocused(undefined)}
            />
          ))}

          {/* Les pourcentages sont posés À L'EXTÉRIEUR de l'anneau, en couleur
              de texte ordinaire : un texte coloré sur un fond coloré finit
              toujours par manquer de contraste pour quelqu'un. */}
          {segments.map((segment) => (
            <text
              key={segment.key}
              x={segment.labelX}
              y={segment.labelY}
              className="donut-label"
              textAnchor={segment.labelX > CENTER + 4 ? 'start' : segment.labelX < CENTER - 4 ? 'end' : 'middle'}
              dominantBaseline="middle"
            >
              {segment.share} %
            </text>
          ))}

          <text x={CENTER} y={CENTER - 6} className="donut-center-value" textAnchor="middle">
            {formatEurosCompact(focusedSegment?.value ?? total)}
          </text>
          <text x={CENTER} y={CENTER + 12} className="donut-center-label" textAnchor="middle">
            {focusedSegment?.label ?? 'Total'}
          </text>
        </svg>

        {/* La légende est aussi le tableau de données : chaque valeur y est
            écrite, donc rien ne dépend de la seule couleur. */}
        <ul className="donut-legend">
          {segments.map((segment) => (
            <li
              key={segment.key}
              className={focused !== undefined && focused !== segment.key ? 'is-dimmed' : undefined}
              onMouseEnter={() => setFocused(segment.key)}
              onMouseLeave={() => setFocused(undefined)}
            >
              <span className="color-dot" style={{ background: segment.color }} aria-hidden="true" />
              <span className="donut-legend-name">{segment.label}</span>
              <span className="donut-legend-value tabular">
                {formatEurosCompact(segment.value)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function ChartHeader({
  mode,
  onModeChange,
}: {
  mode: DonutMode
  onModeChange: (mode: DonutMode) => void
}) {
  return (
    <>
      <h2>Répartition du budget</h2>
      <p className="chart-subtitle">
        {mode === 'planned'
          ? 'Comment ton budget de référence est réparti.'
          : "Où l'argent est réellement allé ce mois-ci."}
      </p>
      <div className="chart-toggle">
        <SegmentedControl
          label="Prévu ou réalisé"
          value={mode}
          options={MODE_OPTIONS}
          onChange={onModeChange}
        />
      </div>
    </>
  )
}
