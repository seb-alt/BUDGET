/**
 * src/components/charts/scale.ts
 *
 * LOGIQUE PURE — l'échelle verticale d'un graphique.
 *
 * Un axe qui monte à « 8 437 € » est illisible : l'œil ne compare pas des
 * repères tordus. On arrondit donc le maximum à une valeur ronde et on place
 * des graduations régulières — 0, 2 500, 5 000, 7 500, 10 000.
 *
 * C'est typiquement le genre de calcul qui passe inaperçu quand il est faux :
 * le graphique s'affiche, il a l'air normal, et les proportions sont fausses.
 */

import type { Cents } from '../../db/types'

export interface Scale {
  /** Borne basse, à zéro sauf s'il y a des valeurs négatives. */
  min: Cents
  /** Borne haute arrondie. */
  max: Cents
  /** Les valeurs où placer une graduation, bornes comprises. */
  ticks: Cents[]
}

/** Les pas « ronds » acceptables, déclinés sur toutes les puissances de 10. */
const STEPS = [1, 2, 2.5, 5, 10]

/** Le plus petit pas rond qui découpe l'étendue en `target` graduations au plus. */
function niceStep(span: number, target: number): number {
  const rough = span / target
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  for (const step of STEPS) {
    if (magnitude * step >= rough) return magnitude * step
  }
  return magnitude * 10
}

/**
 * Construit une échelle lisible pour une série de valeurs.
 * Les valeurs négatives (une performance en perte) sont prises en compte :
 * l'échelle descend alors sous zéro au lieu de les écraser.
 */
export function niceScale(values: Cents[], targetTicks = 4): Scale {
  const highest = Math.max(0, ...values)
  const lowest = Math.min(0, ...values)

  // Tout à zéro : une échelle plate n'a pas de sens, on prend 1 € de haut.
  if (highest === 0 && lowest === 0) return { min: 0, max: 100, ticks: [0, 100] }

  const step = niceStep(highest - lowest, targetTicks)
  const max = Math.ceil(highest / step) * step
  const min = Math.floor(lowest / step) * step

  const ticks: Cents[] = []
  for (let value = min; value <= max + step / 2; value += step) {
    ticks.push(Math.round(value))
  }

  return { min: Math.round(min), max: Math.round(max), ticks }
}

/** Position verticale d'une valeur dans une zone de dessin, en unités SVG. */
export function scaleY(value: Cents, scale: Scale, top: number, height: number): number {
  const span = scale.max - scale.min || 1
  return top + height - ((value - scale.min) / span) * height
}
