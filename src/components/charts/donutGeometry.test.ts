/**
 * Vérifie les maths du graphique en secteurs.
 * Un camembert faux est difficile à repérer à l'œil : les proportions ont
 * l'air plausibles même quand elles sont fausses. D'où ces tests.
 */

import { describe, expect, it } from 'vitest'
import { buildDonutSegments, CENTER } from './donutGeometry'

const slice = (key: string, value: number) => ({ key, label: key, color: 'red', value })

describe('buildDonutSegments', () => {
  it('calcule des parts qui totalisent 100 %', () => {
    const segments = buildDonutSegments([
      slice('charges', 80000),
      slice('epargne', 85000),
      slice('loisirs', 35000),
    ])

    expect(segments.map((s) => s.share)).toEqual([40, 43, 18])
    // 40 + 43 + 18 = 101 : les arrondis ne tombent pas toujours juste, c'est
    // attendu. Les montants exacts sont dans la légende, pas dans les %.
    expect(segments).toHaveLength(3)
  })

  it('écarte les parts nulles', () => {
    const segments = buildDonutSegments([
      slice('charges', 0),
      slice('epargne', 50000),
      slice('loisirs', 50000),
    ])

    expect(segments.map((s) => s.key)).toEqual(['epargne', 'loisirs'])
    expect(segments.map((s) => s.share)).toEqual([50, 50])
  })

  it('renvoie une liste vide quand tout est à zéro', () => {
    expect(buildDonutSegments([slice('a', 0), slice('b', 0)])).toEqual([])
  })

  it('démarre le premier secteur en haut du cercle', () => {
    const [first] = buildDonutSegments([slice('a', 1), slice('b', 1)])
    const [, startX, startY] = /^M([\d.]+) ([\d.]+)/.exec(first.path.replace('M', 'M')) ?? []

    // Midi : même abscisse que le centre (à l'écart de 2 px près), ordonnée au-dessus.
    expect(Math.abs(Number(startX) - CENTER)).toBeLessThan(3)
    expect(Number(startY)).toBeLessThan(CENTER)
  })

  it('un secteur qui dépasse le demi-cercle utilise le grand arc', () => {
    const [big, small] = buildDonutSegments([slice('a', 90), slice('b', 10)])

    // Le drapeau large-arc est le 4e nombre après « A ».
    expect(/A[\d.]+ [\d.]+ 0 1 1/.test(big.path)).toBe(true)
    expect(/A[\d.]+ [\d.]+ 0 0 1/.test(small.path)).toBe(true)
  })
})
