import { describe, expect, it } from 'vitest'
import { computeMonthBalance, plannedEnvelope } from './budgetEngine'
import type { BudgetLine, Category } from '../../db/types'

const euros = (value: number) => Math.round(value * 100)

/** Un jeu de catégories minimal, un par groupe qui compte dans le budget. */
const categories = [
  { id: 'loyer', name: 'Loyer', kind: 'expense', group: 'chargesFixes', order: 1, active: true },
  { id: 'av', name: 'Assurance-vie', kind: 'saving', group: 'epargne', order: 1, active: true },
  { id: 'lep-pea', name: 'LEP / PEA', kind: 'saving', group: 'epargne', order: 2, active: true },
  { id: 'sorties', name: 'Sorties', kind: 'expense', group: 'loisirs', order: 1, active: true },
  // Hors budget : ni dans les charges, ni dans l'épargne, ni dans les loisirs.
  { id: 'autre', name: 'Autre', kind: 'expense', group: 'divers', order: 1, active: true },
  { id: 'salaire', name: 'Salaire', kind: 'income', group: 'revenuPerso', order: 1, active: true },
] as Category[]

/** 800 + 500 + 350 + 350 = 2 000 € budgétés. */
const budget: BudgetLine[] = [
  { categoryId: 'loyer', amount: euros(800) },
  { categoryId: 'av', amount: euros(500) },
  { categoryId: 'lep-pea', amount: euros(350) },
  { categoryId: 'sorties', amount: euros(350) },
]

const balance = (actualIncome: number) =>
  computeMonthBalance({ actualIncome: euros(actualIncome), budget, categories })

describe('computeMonthBalance', () => {
  it('additionne les trois groupes budgétés', () => {
    expect(balance(2000).budgeted).toBe(euros(2000))
  })

  it('ne compte PAS les groupes hors budget', () => {
    const withExtra = computeMonthBalance({
      actualIncome: euros(2000),
      budget: [...budget, { categoryId: 'autre', amount: euros(500) }],
      categories,
    })
    expect(withExtra.budgeted).toBe(euros(2000))
  })

  it('ignore une ligne dont la catégorie a disparu', () => {
    const orphan = computeMonthBalance({
      actualIncome: euros(2000),
      budget: [...budget, { categoryId: 'supprimée', amount: euros(900) }],
      categories,
    })
    expect(orphan.budgeted).toBe(euros(2000))
  })

  it('ne laisse rien de non affecté quand les revenus couvrent juste le budget', () => {
    expect(balance(2000)).toMatchObject({ unallocated: 0, deficit: 0 })
  })

  it('montre le matelas quand les revenus dépassent le budget', () => {
    expect(balance(2200)).toMatchObject({ unallocated: euros(200), deficit: 0 })
  })

  it('montre le manque quand les revenus ne suffisent pas', () => {
    expect(balance(1800)).toMatchObject({ unallocated: 0, deficit: euros(200) })
  })

  it('n’affiche jamais un non-affecté négatif', () => {
    expect(balance(0).unallocated).toBe(0)
  })

  it('compte tout en non affecté quand le budget est vide', () => {
    const empty = computeMonthBalance({ actualIncome: euros(2000), budget: [], categories })
    expect(empty).toMatchObject({ budgeted: 0, unallocated: euros(2000), deficit: 0 })
  })

  /*
   * Le point qui a motivé la refonte : le montant saisi pour l'enveloppe
   * LEP/PEA est RESPECTÉ. Avant, il était remplacé par le surplus calculé, et
   * un budget qu'on ne peut pas fixer n'est plus vraiment un budget.
   */
  it('respecte le montant budgété de l’enveloppe, quels que soient les revenus', () => {
    expect(plannedEnvelope(budget, 'lep-pea')).toBe(euros(350))
    expect(balance(3000).unallocated).toBe(euros(1000))
    expect(plannedEnvelope(budget, 'lep-pea')).toBe(euros(350))
  })
})

describe('plannedEnvelope', () => {
  it('rend zéro si l’enveloppe n’a pas de ligne de budget', () => {
    expect(plannedEnvelope(budget, 'inconnue')).toBe(0)
  })

  it('rend zéro sur un budget vide', () => {
    expect(plannedEnvelope([], 'lep-pea')).toBe(0)
  })
})
