/**
 * Vérifie le gel des budgets mensuels (§11).
 *
 * C'est une règle dont on ne verrait l'erreur que des mois plus tard, quand
 * les chiffres d'un mois passé se mettraient à bouger. D'où ces tests.
 */

import { describe, expect, it } from 'vitest'
import type { Settings } from '../../db/types'
import { buildBudgetSnapshot, isMonthFrozen, monthsToFreeze } from './monthlyBudget'

const settings = (): Settings => ({
  id: 1,
  referenceIncome: 200000,
  budgetTemplate: [
    { categoryId: 'shopping', amount: 20000 },
    { categoryId: 'sorties', amount: 10000 },
  ],
  lepThreshold: 800000,
  assuranceVieMonthly: 50000,
  flexibleSavingsCategoryId: 'flex',
  lepAccountId: 'lep',
  peaAccountId: 'pea',
  assuranceVieAccountId: 'av',
  defaultAccountId: 'courant',
  studentLoan: {
    initialAmount: 3800000,
    monthlyPayment: 35000,
    remainingCapital: 3800000,
    lastUpdated: '2026-09-01',
  },
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
})

describe('monthsToFreeze', () => {
  it('liste les mois révolus sans photo', () => {
    expect(monthsToFreeze('2026-09', '2026-12', [])).toEqual(['2026-09', '2026-10', '2026-11'])
  })

  it('ne refige pas un mois déjà figé', () => {
    expect(monthsToFreeze('2026-09', '2026-12', ['2026-10'])).toEqual(['2026-09', '2026-11'])
  })

  it('ne fige JAMAIS le mois en cours', () => {
    expect(monthsToFreeze('2026-09', '2026-09', [])).toEqual([])
    expect(monthsToFreeze('2026-09', '2026-10', [])).toEqual(['2026-09'])
  })

  it('passe correctement d’une année à l’autre', () => {
    expect(monthsToFreeze('2026-11', '2027-02', [])).toEqual(['2026-11', '2026-12', '2027-01'])
  })

  it('ne renvoie rien si le premier mois est dans le futur', () => {
    expect(monthsToFreeze('2027-01', '2026-09', [])).toEqual([])
  })

  it('ne boucle pas indéfiniment sur une date aberrante', () => {
    expect(monthsToFreeze('1900-01', '2026-09', []).length).toBeLessThanOrEqual(1200)
  })
})

describe('buildBudgetSnapshot', () => {
  it('recopie les montants et les réglages qui influencent les calculs', () => {
    const snapshot = buildBudgetSnapshot('2026-09', settings(), '2026-09-30T23:00:00.000Z')

    expect(snapshot.id).toBe('2026-09')
    expect(snapshot.month).toBe('2026-09')
    expect(snapshot.lines).toEqual([
      { categoryId: 'shopping', amount: 20000 },
      { categoryId: 'sorties', amount: 10000 },
    ])
    expect(snapshot.referenceIncome).toBe(200000)
    expect(snapshot.lepThreshold).toBe(800000)
    expect(snapshot.assuranceVieMonthly).toBe(50000)
  })

  it('copie les lignes au lieu de les partager — sinon la photo bougerait', () => {
    const live = settings()
    const snapshot = buildBudgetSnapshot('2026-09', live, '2026-09-30T23:00:00.000Z')

    // On modifie les réglages APRÈS la photo, comme le ferait l'écran Paramètres.
    live.budgetTemplate[0].amount = 25000

    expect(snapshot.lines[0].amount).toBe(20000)
  })
})

describe('isMonthFrozen', () => {
  it('un mois révolu avec une photo est figé', () => {
    expect(isMonthFrozen('2026-09', '2026-10', true)).toBe(true)
  })

  it('le mois en cours n’est jamais figé, même avec une photo', () => {
    // La photo existe bien, mais elle suit encore les réglages.
    expect(isMonthFrozen('2026-09', '2026-09', true)).toBe(false)
  })

  it('un mois révolu sans photo n’est pas figé', () => {
    expect(isMonthFrozen('2026-09', '2026-10', false)).toBe(false)
  })
})
