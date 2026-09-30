/**
 * Tests de la répartition LEP / PEA (§4).
 * Le premier cas est l'exemple chiffré du cahier des charges.
 */

import { describe, expect, it } from 'vitest'
import { splitLepPea } from './lepPeaEngine'

const THRESHOLD = 800000 // 8 000 €

describe('exemple du cahier des charges', () => {
  it('LEP à 7 850 €, flexible 350 € -> 150 € au LEP, 200 € au PEA', () => {
    const result = splitLepPea({ flexible: 35000, lepBalance: 785000, lepThreshold: THRESHOLD })

    expect(result.toLep).toBe(15000)
    expect(result.toPea).toBe(20000)
    expect(result.lepNeed).toBe(15000)
    expect(result.lepFull).toBe(false)
  })
})

describe('le LEP est prioritaire tant qu’il n’est pas plein', () => {
  it('tout part au LEP quand il peut tout absorber', () => {
    const result = splitLepPea({ flexible: 35000, lepBalance: 500000, lepThreshold: THRESHOLD })

    expect(result.toLep).toBe(35000)
    expect(result.toPea).toBe(0)
  })

  it('un LEP vide absorbe tout', () => {
    const result = splitLepPea({ flexible: 35000, lepBalance: 0, lepThreshold: THRESHOLD })
    expect(result.toLep).toBe(35000)
    expect(result.toPea).toBe(0)
  })
})

describe('LEP plein', () => {
  it('tout part au PEA quand le seuil est atteint', () => {
    const result = splitLepPea({ flexible: 35000, lepBalance: THRESHOLD, lepThreshold: THRESHOLD })

    expect(result.toLep).toBe(0)
    expect(result.toPea).toBe(35000)
    expect(result.lepFull).toBe(true)
  })

  it('un LEP AU-DESSUS du seuil ne fait pas déborder le PEA', () => {
    // Le besoin serait négatif : s'il n'était pas ramené à zéro, le PEA
    // recevrait plus que l'enveloppe disponible.
    const result = splitLepPea({ flexible: 35000, lepBalance: 900000, lepThreshold: THRESHOLD })

    expect(result.toLep).toBe(0)
    expect(result.toPea).toBe(35000)
    expect(result.lepNeed).toBe(0)
  })
})

describe('invariant : rien ne se perd, rien ne se crée', () => {
  const cases = [
    { flexible: 35000, lepBalance: 785000 },
    { flexible: 0, lepBalance: 500000 },
    { flexible: 100000, lepBalance: 795000 },
    { flexible: 55000, lepBalance: 0 },
    { flexible: 35000, lepBalance: 1000000 },
  ]

  it('la somme des deux versements vaut toujours l’enveloppe flexible', () => {
    for (const { flexible, lepBalance } of cases) {
      const result = splitLepPea({ flexible, lepBalance, lepThreshold: THRESHOLD })
      expect(result.toLep + result.toPea).toBe(flexible)
    }
  })

  it('aucun versement n’est jamais négatif', () => {
    for (const { flexible, lepBalance } of cases) {
      const result = splitLepPea({ flexible, lepBalance, lepThreshold: THRESHOLD })
      expect(result.toLep).toBeGreaterThanOrEqual(0)
      expect(result.toPea).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('seuil paramétrable', () => {
  it('un seuil relevé rouvre le LEP', () => {
    const result = splitLepPea({ flexible: 35000, lepBalance: 800000, lepThreshold: 1000000 })

    expect(result.toLep).toBe(35000)
    expect(result.toPea).toBe(0)
    expect(result.lepFull).toBe(false)
  })
})
