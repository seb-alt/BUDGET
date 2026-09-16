/**
 * src/features/dashboard/donutGeometry.ts
 *
 * Les maths du graphique en secteurs, isolées du composant React.
 *
 * Un secteur d'anneau est un chemin SVG : on va au bord extérieur, on suit
 * l'arc, on rentre vers le bord intérieur, on revient. Les angles partent du
 * haut (midi) et tournent dans le sens des aiguilles d'une montre.
 *
 * Fonction pure, donc testable : voir donutGeometry.test.ts.
 */

export const CENTER = 100
const RADIUS_OUTER = 74
const RADIUS_INNER = 48
const LABEL_RADIUS = 88

export interface DonutInput {
  key: string
  label: string
  color: string
  value: number
}

export interface DonutSegment extends DonutInput {
  /** Attribut `d` du chemin SVG. */
  path: string
  /** Pourcentage arrondi, pour l'étiquette. */
  share: number
  labelX: number
  labelY: number
}

function pointOnCircle(radius: number, angle: number): [number, number] {
  return [CENTER + radius * Math.cos(angle), CENTER + radius * Math.sin(angle)]
}

function donutSegmentPath(startAngle: number, endAngle: number): string {
  const isLargeArc = endAngle - startAngle > Math.PI ? 1 : 0
  const [outerStartX, outerStartY] = pointOnCircle(RADIUS_OUTER, startAngle)
  const [outerEndX, outerEndY] = pointOnCircle(RADIUS_OUTER, endAngle)
  const [innerEndX, innerEndY] = pointOnCircle(RADIUS_INNER, endAngle)
  const [innerStartX, innerStartY] = pointOnCircle(RADIUS_INNER, startAngle)

  return [
    `M${outerStartX} ${outerStartY}`,
    `A${RADIUS_OUTER} ${RADIUS_OUTER} 0 ${isLargeArc} 1 ${outerEndX} ${outerEndY}`,
    `L${innerEndX} ${innerEndY}`,
    `A${RADIUS_INNER} ${RADIUS_INNER} 0 ${isLargeArc} 0 ${innerStartX} ${innerStartY}`,
    'Z',
  ].join(' ')
}

/**
 * Transforme des montants en secteurs prêts à dessiner.
 * Les parts nulles sont écartées : un secteur d'épaisseur zéro ne se voit pas
 * mais consomme un écart, ce qui décalerait tous les suivants.
 */
export function buildDonutSegments(slices: DonutInput[]): DonutSegment[] {
  const visible = slices.filter((slice) => slice.value > 0)
  const total = visible.reduce((sum, slice) => sum + slice.value, 0)
  if (total === 0) return []

  // Écart de 2 px entre les secteurs, tracé dans la couleur du fond : c'est ce
  // vide qui les sépare, pas un contour — un contour ajouterait de l'encre qui
  // ne représente aucune donnée. Converti en angle à partir du rayon moyen.
  const gapAngle = visible.length > 1 ? 2 / ((RADIUS_OUTER + RADIUS_INNER) / 2) : 0

  let cursor = -Math.PI / 2
  return visible.map((slice) => {
    const sweep = (slice.value / total) * Math.PI * 2
    const startAngle = cursor + gapAngle / 2
    const endAngle = cursor + sweep - gapAngle / 2
    cursor += sweep

    const [labelX, labelY] = pointOnCircle(LABEL_RADIUS, (startAngle + endAngle) / 2)

    return {
      ...slice,
      path: donutSegmentPath(startAngle, endAngle),
      share: Math.round((slice.value / total) * 100),
      labelX,
      labelY,
    }
  })
}
