/**
 * Tests de la règle de l'enveloppe flexible (§4).
 * Les quatre premiers cas sont les exemples chiffrés du cahier des charges.
 */

import { describe, expect, it } from 'vitest'
import type { BudgetLine, Category } from '../../db/types'
import { applyFlexibleEnvelope, computeFlexibleSavings } from './budgetEngine'

/** La configuration de référence : 800 + 350 + 500 = 1 650 € d'incompressible. */
const reference = (actualIncome: number) =>
  computeFlexibleSavings({
    actualIncome,
    fixedCharges: 80000,
    leisure: 35000,
    assuranceVie: 50000,
  })

describe('exemples du cahier des charges', () => {
  it('2 000 € de revenus -> 350 € de flexible', () => {
    expect(reference(200000).flexible).toBe(35000)
  })

  it('1 900 € -> 250 €', () => {
    expect(reference(190000).flexible).toBe(25000)
  })

  it('1 800 € -> 150 €', () => {
    expect(reference(180000).flexible).toBe(15000)
  })

  it('2 200 € -> 550 €', () => {
    expect(reference(220000).flexible).toBe(55000)
  })
})

describe('incompressible', () => {
  it('additionne charges fixes, loisirs et assurance-vie', () => {
    expect(reference(200000).incompressible).toBe(165000)
  })

  it('ne dépend pas des revenus', () => {
    expect(reference(100000).incompressible).toBe(165000)
    expect(reference(500000).incompressible).toBe(165000)
  })
})

describe('revenus insuffisants', () => {
  it('l’épargne flexible tombe à zéro, jamais en négatif', () => {
    const result = reference(160000)
    expect(result.flexible).toBe(0)
  })

  it('le manque est chiffré séparément', () => {
    // 1 600 € de revenus contre 1 650 € d'incompressible : il manque 50 €.
    expect(reference(160000).deficit).toBe(5000)
  })

  it('ne réduit JAMAIS les autres enveloppes de lui-même', () => {
    const result = reference(100000)
    // L'incompressible reste intact : c'est à l'utilisateur de décider quoi couper.
    expect(result.incompressible).toBe(165000)
    expect(result.flexible).toBe(0)
    expect(result.deficit).toBe(65000)
  })

  it('aucun déficit quand les revenus couvrent exactement l’incompressible', () => {
    const result = reference(165000)
    expect(result.flexible).toBe(0)
    expect(result.deficit).toBe(0)
  })
})

describe('cas limites', () => {
  it('zéro revenu : tout l’incompressible est en déficit', () => {
    expect(reference(0)).toEqual({ incompressible: 165000, flexible: 0, deficit: 165000 })
  })

  it('un budget modifié change l’incompressible', () => {
    // Assurance-vie portée à 600 € : l'incompressible monte, le flexible baisse.
    const result = computeFlexibleSavings({
      actualIncome: 200000,
      fixedCharges: 80000,
      leisure: 35000,
      assuranceVie: 60000,
    })
    expect(result.incompressible).toBe(175000)
    expect(result.flexible).toBe(25000)
  })
})

describe('applyFlexibleEnvelope', () => {
  const categories: Category[] = [
    { id: 'abo', name: 'Abonnements', kind: 'expense', group: 'chargesFixes', order: 1, active: true },
    { id: 'pret', name: 'Prêt', kind: 'expense', group: 'chargesFixes', order: 2, active: true },
    { id: 'sorties', name: 'Sorties', kind: 'expense', group: 'loisirs', order: 1, active: true },
    { id: 'shopping', name: 'Shopping', kind: 'expense', group: 'loisirs', order: 2, active: true },
    { id: 'av', name: 'Assurance-vie', kind: 'saving', group: 'epargne', order: 1, active: true },
    { id: 'flex', name: 'Flexible', kind: 'saving', group: 'epargne', order: 2, active: true },
  ]

  // 450 + 350 de charges, 100 + 250 de loisirs, 500 d'assurance-vie = 1 650 €.
  const budget: BudgetLine[] = [
    { categoryId: 'abo', amount: 45000 },
    { categoryId: 'pret', amount: 35000 },
    { categoryId: 'sorties', amount: 10000 },
    { categoryId: 'shopping', amount: 25000 },
    { categoryId: 'av', amount: 50000 },
    { categoryId: 'flex', amount: 35000 },
  ]

  const apply = (actualIncome: number) =>
    applyFlexibleEnvelope({
      budget,
      categories,
      actualIncome,
      flexibleCategoryId: 'flex',
      assuranceVieMonthly: 50000,
    })

  it('réécrit la ligne flexible avec le montant calculé', () => {
    const result = apply(190000)
    expect(result.savings.flexible).toBe(25000)
    expect(result.budget.find((l) => l.categoryId === 'flex')?.amount).toBe(25000)
  })

  it('ne touche à aucune autre ligne', () => {
    const result = apply(190000)
    expect(result.budget.filter((l) => l.categoryId !== 'flex')).toEqual(
      budget.filter((l) => l.categoryId !== 'flex'),
    )
  })

  it('ramène la ligne à zéro quand les revenus sont insuffisants', () => {
    const result = apply(150000)
    expect(result.budget.find((l) => l.categoryId === 'flex')?.amount).toBe(0)
    expect(result.savings.deficit).toBe(15000)
  })

  it('lit les charges dans le budget FOURNI, pas dans les réglages du jour', () => {
    // Un mois figé avec des loisirs à 200 € au lieu de 350 € : l'enveloppe
    // flexible de ce mois-là doit être calculée avec 200 €.
    const frozen = budget.map((l) =>
      l.categoryId === 'shopping' ? { ...l, amount: 10000 } : l,
    )
    const result = applyFlexibleEnvelope({
      budget: frozen,
      categories,
      actualIncome: 200000,
      flexibleCategoryId: 'flex',
      assuranceVieMonthly: 50000,
    })

    // Incompressible = 800 + 200 + 500 = 1 500 -> flexible 500 €.
    expect(result.savings.incompressible).toBe(150000)
    expect(result.savings.flexible).toBe(50000)
  })
})
