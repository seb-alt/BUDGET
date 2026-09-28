/**
 * src/components/charts/DonutChart.tsx
 *
 * Un anneau de répartition, avec ses étiquettes et sa légende.
 * Partagé par le camembert du budget et celui du patrimoine : même forme,
 * mêmes règles de lisibilité, une seule implémentation à corriger.
 *
 * Deux choix de lisibilité qui ne se négocient pas :
 *  - les pourcentages sont posés À L'EXTÉRIEUR de l'anneau, en couleur de
 *    texte ordinaire. Un texte coloré sur un fond coloré finit toujours par
 *    manquer de contraste pour quelqu'un ;
 *  - la légende porte les montants exacts. Rien ne dépend de la seule couleur.
 */

import { useState } from 'react'
import { buildDonutSegments, CENTER, type DonutInput } from './donutGeometry'
import { formatEurosCompact } from '../../utils/money'
import './charts.css'

interface DonutChartProps {
  slices: DonutInput[]
  /** Libellé affiché au centre quand rien n'est survolé. */
  centerLabel: string
  emptyMessage: string
  /** Description lue par les lecteurs d'écran, avant la liste des parts. */
  description: string
}

export function DonutChart({ slices, centerLabel, emptyMessage, description }: DonutChartProps) {
  const [focused, setFocused] = useState<string>()

  const segments = buildDonutSegments(slices)
  if (segments.length === 0) return <p className="chart-empty">{emptyMessage}</p>

  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  const focusedSegment = segments.find((segment) => segment.key === focused)

  return (
    <div className="donut">
      {/* Le cadre déborde du cercle : les pourcentages sont posés à
          l'extérieur de l'anneau et doivent tenir entièrement, sinon le
          « % » se fait rogner au bord droit. */}
      <svg
        viewBox="-26 -4 252 208"
        className="donut-svg"
        role="img"
        aria-label={`${description} : ${segments.map((s) => `${s.label} ${s.share} %`).join(', ')}`}
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

        {segments.map((segment) => (
          <text
            key={segment.key}
            x={segment.labelX}
            y={segment.labelY}
            className="donut-label"
            textAnchor={
              segment.labelX > CENTER + 4 ? 'start' : segment.labelX < CENTER - 4 ? 'end' : 'middle'
            }
            dominantBaseline="middle"
          >
            {segment.share} %
          </text>
        ))}

        <text x={CENTER} y={CENTER - 6} className="donut-center-value" textAnchor="middle">
          {formatEurosCompact(focusedSegment?.value ?? total)}
        </text>
        <text x={CENTER} y={CENTER + 12} className="donut-center-label" textAnchor="middle">
          {focusedSegment?.label ?? centerLabel}
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
            <span className="donut-legend-value tabular">{formatEurosCompact(segment.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
