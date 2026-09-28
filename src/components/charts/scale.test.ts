/**
 * Tests de l'échelle verticale.
 * Une échelle fausse donne un graphique d'apparence normale mais aux
 * proportions mensongères : rien à l'écran ne le signale.
 */

import { describe, expect, it } from 'vitest'
import { niceScale, scaleY } from './scale'

describe('niceScale', () => {
  it('arrondit le maximum à une valeur ronde', () => {
    const scale = niceScale([843700])
    expect(scale.max).toBeGreaterThanOrEqual(843700)
    expect(scale.ticks[0]).toBe(0)
    expect(scale.ticks.at(-1)).toBe(scale.max)
  })

  it('produit des graduations régulières', () => {
    const { ticks } = niceScale([1000000])
    const gaps = ticks.slice(1).map((tick, index) => tick - ticks[index])
    expect(new Set(gaps).size).toBe(1)
  })

  it('reste proche du nombre de graduations demandé', () => {
    for (const value of [100, 5000, 843700, 12345678]) {
      const { ticks } = niceScale([value], 4)
      expect(ticks.length).toBeGreaterThanOrEqual(3)
      expect(ticks.length).toBeLessThanOrEqual(7)
    }
  })

  it('part toujours de zéro pour des valeurs positives', () => {
    expect(niceScale([500000, 800000]).min).toBe(0)
  })

  it('descend sous zéro quand une valeur est négative', () => {
    // Une performance en perte ne doit pas être écrasée sur la ligne de base.
    const scale = niceScale([-20000, 50000])
    expect(scale.min).toBeLessThanOrEqual(-20000)
    expect(scale.max).toBeGreaterThanOrEqual(50000)
    expect(scale.ticks).toContain(0)
  })

  it('gère une série entièrement à zéro sans échelle plate', () => {
    const scale = niceScale([0, 0])
    expect(scale.max).toBeGreaterThan(scale.min)
  })

  it('gère une série vide', () => {
    expect(niceScale([]).max).toBeGreaterThan(0)
  })
})

describe('scaleY', () => {
  const scale = niceScale([0, 100000])

  it('place le maximum en haut et le minimum en bas', () => {
    expect(scaleY(scale.max, scale, 10, 100)).toBeCloseTo(10)
    expect(scaleY(scale.min, scale, 10, 100)).toBeCloseTo(110)
  })

  it('place le milieu au milieu', () => {
    const middle = (scale.min + scale.max) / 2
    expect(scaleY(middle, scale, 0, 100)).toBeCloseTo(50)
  })
})
