/**
 * Tests des règles de l'écran Paramètres.
 * Le point sensible : ne jamais laisser une modification de réglage rendre
 * incohérentes des opérations déjà enregistrées.
 */

import { describe, expect, it } from 'vitest'
import type { Transaction } from '../../db/types'
import {
  countAccountUses,
  countCategoryUses,
  formatPercent,
  moveInOrder,
  parsePercent,
} from './settingsRules'

const items = [
  { id: 'a', order: 1 },
  { id: 'b', order: 2 },
  { id: 'c', order: 3 },
]

describe('moveInOrder', () => {
  it('monte un élément', () => {
    expect(moveInOrder(items, 'c', -1).map((i) => i.id)).toEqual(['a', 'c', 'b'])
  })

  it('descend un élément', () => {
    expect(moveInOrder(items, 'a', 1).map((i) => i.id)).toEqual(['b', 'a', 'c'])
  })

  it('ne fait rien au-delà des bornes', () => {
    expect(moveInOrder(items, 'a', -1).map((i) => i.id)).toEqual(['a', 'b', 'c'])
    expect(moveInOrder(items, 'c', 1).map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })

  it('renumérote toujours de 1 à n, sans trou ni doublon', () => {
    // Des ordres abîmés par des modifications successives.
    const messy = [
      { id: 'a', order: 5 },
      { id: 'b', order: 5 },
      { id: 'c', order: 42 },
    ]
    expect(moveInOrder(messy, 'c', -1).map((i) => i.order)).toEqual([1, 2, 3])
  })

  it('ignore un identifiant inconnu mais remet la liste au propre', () => {
    expect(moveInOrder(items, 'inconnu', 1).map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('suppressions protégées', () => {
  const transactions = [
    { id: '1', type: 'expense', amount: 100, date: '2026-09-01', categoryId: 'shopping', accountId: 'cic', createdAt: '', updatedAt: '' },
    { id: '2', type: 'expense', amount: 200, date: '2026-09-02', categoryId: 'shopping', accountId: 'cic', createdAt: '', updatedAt: '' },
    { id: '3', type: 'transfer', amount: 300, date: '2026-09-03', fromAccountId: 'cic', toAccountId: 'lep', createdAt: '', updatedAt: '' },
  ] satisfies Transaction[]

  it('compte les opérations d’une catégorie', () => {
    expect(countCategoryUses('shopping', transactions)).toBe(2)
    expect(countCategoryUses('sorties', transactions)).toBe(0)
  })

  it('compte un transfert pour ses DEUX comptes', () => {
    expect(countAccountUses('cic', transactions)).toBe(3)
    expect(countAccountUses('lep', transactions)).toBe(1)
    expect(countAccountUses('pea', transactions)).toBe(0)
  })
})

describe('parsePercent', () => {
  it('lit le taux URSSAF', () => {
    expect(parsePercent('25,6')).toBeCloseTo(0.256, 10)
  })

  it('accepte le point, le signe % et les espaces', () => {
    expect(parsePercent('25.6')).toBeCloseTo(0.256, 10)
    expect(parsePercent('25,6 %')).toBeCloseTo(0.256, 10)
  })

  it('accepte zéro et cent', () => {
    expect(parsePercent('0')).toBe(0)
    expect(parsePercent('100')).toBe(1)
  })

  it('refuse au-delà de 100 %', () => {
    expect(parsePercent('101')).toBeNull()
  })

  it('refuse une saisie vide ou non numérique', () => {
    expect(parsePercent('')).toBeNull()
    expect(parsePercent('abc')).toBeNull()
    expect(parsePercent('-5')).toBeNull()
  })

  it('fait l’aller-retour sans dérive', () => {
    for (const value of ['25,6', '12', '0,5', '33,33']) {
      expect(formatPercent(parsePercent(value)!)).toBe(value)
    }
  })
})

describe('formatPercent', () => {
  it('retire les zéros inutiles', () => {
    expect(formatPercent(0.256)).toBe('25,6')
    expect(formatPercent(0.25)).toBe('25')
    expect(formatPercent(0)).toBe('0')
  })
})
