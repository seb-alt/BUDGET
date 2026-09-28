/**
 * src/components/charts/LineChart.tsx
 *
 * Une courbe d'évolution, avec repère vertical et infobulle.
 *
 * Le repère suit le pointeur et s'accroche au point le plus proche : on vise
 * une DATE, jamais un trait de deux pixels. Sur un téléphone, le doigt fait
 * le même travail — d'où l'écoute des événements de pointeur et non de souris.
 *
 * `vector-effect="non-scaling-stroke"` garde les traits à leur épaisseur
 * réelle quelle que soit la largeur du graphique : sans lui, la courbe
 * s'épaissirait sur un écran large et la finesse voulue disparaîtrait.
 */

import { useRef, useState } from 'react'
import { niceScale, scaleY } from './scale'
import type { Cents } from '../../db/types'
import { formatEurosCompact } from '../../utils/money'
import './charts.css'

export interface LinePoint {
  /** Étiquette de l'axe horizontal, ex. 'sept. 26'. */
  label: string
  value: Cents
}

const WIDTH = 320
const HEIGHT = 170
const PADDING = { top: 12, right: 8, bottom: 22, left: 46 }

interface LineChartProps {
  points: LinePoint[]
  description: string
  emptyMessage: string
}

export function LineChart({ points, description, emptyMessage }: LineChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hovered, setHovered] = useState<number>()

  if (points.length < 2) return <p className="chart-empty">{emptyMessage}</p>

  const scale = niceScale(points.map((point) => point.value))
  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom

  const x = (index: number) =>
    PADDING.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth)
  const y = (value: Cents) => scaleY(value, scale, PADDING.top, plotHeight)

  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index)} ${y(point.value)}`).join(' ')
  const area = `${path} L${x(points.length - 1)} ${PADDING.top + plotHeight} L${x(0)} ${PADDING.top + plotHeight} Z`

  /** Étiquettes horizontales : au plus quatre, sinon elles se chevauchent. */
  const labelEvery = Math.max(1, Math.ceil(points.length / 4))
  const active = hovered ?? points.length - 1

  function handlePointer(event: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current
    if (svg === null) return
    const box = svg.getBoundingClientRect()
    // On convertit la position du doigt en unités du graphique, puis on
    // s'accroche au point le plus proche.
    const ratio = ((event.clientX - box.left) / box.width) * WIDTH
    const index = Math.round(((ratio - PADDING.left) / plotWidth) * (points.length - 1))
    setHovered(Math.min(points.length - 1, Math.max(0, index)))
  }

  return (
    <div className="line">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="line-svg"
        role="img"
        aria-label={`${description}. De ${formatEurosCompact(points[0].value)} à ${formatEurosCompact(
          points.at(-1)!.value,
        )}.`}
        onPointerMove={handlePointer}
        onPointerLeave={() => setHovered(undefined)}
      >
        {scale.ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PADDING.left}
              x2={WIDTH - PADDING.right}
              y1={y(tick)}
              y2={y(tick)}
              className="line-grid"
              vectorEffect="non-scaling-stroke"
            />
            <text x={PADDING.left - 6} y={y(tick)} className="line-tick" textAnchor="end" dominantBaseline="middle">
              {formatEurosCompact(tick)}
            </text>
          </g>
        ))}

        <path d={area} className="line-area" />
        <path d={path} className="line-path" fill="none" vectorEffect="non-scaling-stroke" />

        {points.map((point, index) =>
          index % labelEvery === 0 || index === points.length - 1 ? (
            <text
              key={point.label}
              x={x(index)}
              y={HEIGHT - 6}
              className="line-tick"
              // Les étiquettes des extrémités sont alignées vers l'intérieur :
              // centrées, elles déborderaient du cadre et se feraient rogner.
              textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
            >
              {point.label}
            </text>
          ) : null,
        )}

        {/* Repère vertical : il indique la date lue, le point la valeur. */}
        <line
          x1={x(active)}
          x2={x(active)}
          y1={PADDING.top}
          y2={PADDING.top + plotHeight}
          className="line-cursor"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={x(active)} cy={y(points[active].value)} r="4.5" className="line-dot" />
      </svg>

      {/* La valeur mène, le libellé suit : on a déjà la série en tête, on
          vient chercher le chiffre. */}
      <p className="line-readout">
        <strong className="tabular">{formatEurosCompact(points[active].value)}</strong>
        <span>{points[active].label}</span>
      </p>
    </div>
  )
}
