/**
 * src/components/charts/GroupedBarChart.tsx
 *
 * Deux séries de barres côte à côte, par période.
 *
 * Utilisé pour répondre d'un coup aux deux questions du §8 : combien tu as
 * versé chaque année (la première série EST ton épargne annuelle), et ce que
 * tes placements ont gagné ou perdu par-dessus.
 *
 * Une performance négative descend SOUS la ligne de base. C'est le signe qui
 * porte la perte, pas la couleur : la couleur dit quelle série on regarde, et
 * le chiffre est écrit à côté.
 */

import { useState } from 'react'
import { niceScale, scaleY } from './scale'
import type { Cents } from '../../db/types'
import { formatEurosCompact } from '../../utils/money'
import './charts.css'

export interface BarGroup {
  label: string
  values: [Cents, Cents]
}

const WIDTH = 320
const HEIGHT = 170
const PADDING = { top: 12, right: 8, bottom: 22, left: 46 }
/** Plafonné : une barre épaisse et saturée crie, une barre fine se lit. */
const MAX_BAR = 22

interface GroupedBarChartProps {
  groups: BarGroup[]
  series: [{ name: string; color: string }, { name: string; color: string }]
  description: string
  emptyMessage: string
}

export function GroupedBarChart({ groups, series, description, emptyMessage }: GroupedBarChartProps) {
  const [hovered, setHovered] = useState<string>()

  if (groups.length === 0) return <p className="chart-empty">{emptyMessage}</p>

  const scale = niceScale(groups.flatMap((group) => group.values))
  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom
  const y = (value: Cents) => scaleY(value, scale, PADDING.top, plotHeight)
  const zero = y(0)

  const slot = plotWidth / groups.length
  // 2 px d'écart entre les deux barres d'un groupe : c'est ce VIDE qui les
  // sépare, pas un contour — un contour ajouterait de l'encre sans donnée.
  const barWidth = Math.min(MAX_BAR, (slot - 10) / 2 - 1)

  return (
    <div className="bars">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="bars-svg"
        role="img"
        aria-label={`${description}. ${groups
          .map(
            (group) =>
              `${group.label} : ${series[0].name} ${formatEurosCompact(group.values[0])}, ` +
              `${series[1].name} ${formatEurosCompact(group.values[1])}`,
          )
          .join('. ')}`}
      >
        {scale.ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PADDING.left}
              x2={WIDTH - PADDING.right}
              y1={y(tick)}
              y2={y(tick)}
              className={tick === 0 ? 'bars-baseline' : 'line-grid'}
              vectorEffect="non-scaling-stroke"
            />
            <text x={PADDING.left - 6} y={y(tick)} className="line-tick" textAnchor="end" dominantBaseline="middle">
              {formatEurosCompact(tick)}
            </text>
          </g>
        ))}

        {groups.map((group, groupIndex) => {
          const center = PADDING.left + slot * (groupIndex + 0.5)
          return (
            <g key={group.label}>
              {group.values.map((value, seriesIndex) => {
                const top = Math.min(y(value), zero)
                const height = Math.abs(y(value) - zero)
                const key = `${group.label}-${seriesIndex}`
                return (
                  <rect
                    key={key}
                    x={center + (seriesIndex === 0 ? -barWidth - 1 : 1)}
                    y={top}
                    width={barWidth}
                    height={Math.max(height, value === 0 ? 0 : 1)}
                    rx="2"
                    fill={series[seriesIndex].color}
                    className={`bars-rect${hovered !== undefined && hovered !== key ? ' is-dimmed' : ''}`}
                    onPointerEnter={() => setHovered(key)}
                    onPointerLeave={() => setHovered(undefined)}
                  />
                )
              })}
              <text x={center} y={HEIGHT - 6} className="line-tick" textAnchor="middle">
                {group.label}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Légende ET tableau de données : chaque montant y figure en toutes
          lettres, donc rien ne dépend de la seule couleur. */}
      <ul className="bars-legend">
        {series.map((entry, seriesIndex) => (
          <li key={entry.name}>
            <span className="color-dot" style={{ background: entry.color }} aria-hidden="true" />
            <span className="bars-legend-name">{entry.name}</span>
            <span className="bars-legend-values tabular">
              {groups.map((group) => (
                <span key={group.label}>{formatEurosCompact(group.values[seriesIndex])}</span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
