/**
 * Tests de la recherche et des filtres.
 *
 * Un filtre trop strict fait disparaître des opérations sans rien signaler :
 * on ne voit pas ce qui manque. Chaque règle est donc vérifiée séparément.
 */

import { describe, expect, it } from 'vitest'
import type { Transaction } from '../../db/types'
import {
  EMPTY_FILTERS,
  countActiveFilters,
  filterTransactions,
  groupByDay,
  periodStart,
} from './filterTransactions'

const namesById = new Map([
  ['cat-shopping', 'Shopping'],
  ['cat-sorties', 'Sorties'],
  ['cat-salaire', 'Salaire'],
  ['acc-courant', 'Compte courant'],
  ['acc-lep', 'LEP'],
])

const context = { today: '2026-09-16', namesById }

let sequence = 0
function tx(partial: Partial<Transaction> & Pick<Transaction, 'type' | 'amount'>): Transaction {
  sequence += 1
  return {
    id: `t${sequence}`,
    date: '2026-09-10',
    createdAt: `2026-09-10T00:00:${String(sequence).padStart(2, '0')}.000Z`,
    updatedAt: '2026-09-10T00:00:00.000Z',
    ...partial,
  }
}

const all = (filters = {}) => ({ ...EMPTY_FILTERS, period: 'all' as const, ...filters })

describe('periodStart', () => {
  it('mois en cours', () => {
    expect(periodStart('currentMonth', '2026-09-16')).toBe('2026-09-01')
  })

  it('trois derniers mois : le mois en cours plus les deux précédents', () => {
    expect(periodStart('last3Months', '2026-09-16')).toBe('2026-07-01')
  })

  it('trois derniers mois à cheval sur deux années', () => {
    expect(periodStart('last3Months', '2027-01-15')).toBe('2026-11-01')
  })

  it('année en cours', () => {
    expect(periodStart('currentYear', '2026-09-16')).toBe('2026-01-01')
  })

  it('tout l’historique : aucune borne', () => {
    expect(periodStart('all', '2026-09-16')).toBeUndefined()
  })
})

describe('filtre de période', () => {
  const transactions = [
    tx({ type: 'expense', amount: 100, date: '2026-09-01' }),
    tx({ type: 'expense', amount: 200, date: '2026-08-31' }),
    tx({ type: 'expense', amount: 300, date: '2026-07-01' }),
    tx({ type: 'expense', amount: 400, date: '2026-06-30' }),
    tx({ type: 'expense', amount: 500, date: '2025-12-31' }),
  ]

  it('garde le mois en cours', () => {
    const kept = filterTransactions(transactions, EMPTY_FILTERS, context)
    expect(kept.map((t) => t.amount)).toEqual([100])
  })

  it('garde les trois derniers mois, bornes comprises', () => {
    const kept = filterTransactions(transactions, { ...EMPTY_FILTERS, period: 'last3Months' }, context)
    expect(kept.map((t) => t.amount)).toEqual([100, 200, 300])
  })

  it('garde l’année en cours', () => {
    const kept = filterTransactions(transactions, { ...EMPTY_FILTERS, period: 'currentYear' }, context)
    expect(kept.map((t) => t.amount)).toEqual([100, 200, 300, 400])
  })

  it('garde tout', () => {
    expect(filterTransactions(transactions, all(), context)).toHaveLength(5)
  })
})

describe('filtre de type', () => {
  const transactions = [
    tx({ type: 'expense', amount: 100, categoryId: 'cat-shopping', accountId: 'acc-courant' }),
    tx({ type: 'income', amount: 200, categoryId: 'cat-salaire', accountId: 'acc-courant' }),
    tx({ type: 'transfer', amount: 300, fromAccountId: 'acc-courant', toAccountId: 'acc-lep' }),
  ]

  it('ne garde que les dépenses', () => {
    const kept = filterTransactions(transactions, all({ type: 'expense' }), context)
    expect(kept.map((t) => t.amount)).toEqual([100])
  })

  it('ne garde que les transferts', () => {
    const kept = filterTransactions(transactions, all({ type: 'transfer' }), context)
    expect(kept.map((t) => t.amount)).toEqual([300])
  })
})

describe('filtre de compte', () => {
  const transactions = [
    tx({ type: 'expense', amount: 100, categoryId: 'cat-shopping', accountId: 'acc-courant' }),
    tx({ type: 'transfer', amount: 300, fromAccountId: 'acc-courant', toAccountId: 'acc-lep' }),
    tx({ type: 'expense', amount: 400, categoryId: 'cat-shopping', accountId: 'acc-lep' }),
  ]

  it('un transfert est retenu par son compte de DÉPART comme par son compte d’arrivée', () => {
    expect(filterTransactions(transactions, all({ accountId: 'acc-courant' }), context).map((t) => t.amount))
      .toEqual([300, 100])
    expect(filterTransactions(transactions, all({ accountId: 'acc-lep' }), context).map((t) => t.amount))
      .toEqual([400, 300])
  })
})

describe('recherche', () => {
  const transactions = [
    tx({ type: 'expense', amount: 6900, categoryId: 'cat-shopping', accountId: 'acc-courant', label: 'Décathlon' }),
    tx({ type: 'expense', amount: 4200, categoryId: 'cat-sorties', accountId: 'acc-courant' }),
    tx({ type: 'transfer', amount: 30000, fromAccountId: 'acc-courant', toAccountId: 'acc-lep' }),
  ]

  it('trouve par libellé, sans tenir compte de la casse ni des accents tapés', () => {
    expect(filterTransactions(transactions, all({ search: 'décath' }), context)).toHaveLength(1)
    expect(filterTransactions(transactions, all({ search: 'DÉCATHLON' }), context)).toHaveLength(1)
  })

  it('trouve par nom de catégorie', () => {
    const kept = filterTransactions(transactions, all({ search: 'sorties' }), context)
    expect(kept.map((t) => t.amount)).toEqual([4200])
  })

  it('trouve un transfert par le nom du compte de destination', () => {
    const kept = filterTransactions(transactions, all({ search: 'LEP' }), context)
    expect(kept.map((t) => t.amount)).toEqual([30000])
  })

  it('trouve par montant exact', () => {
    expect(filterTransactions(transactions, all({ search: '69' }), context).map((t) => t.amount))
      .toEqual([6900])
    expect(filterTransactions(transactions, all({ search: '42,00' }), context).map((t) => t.amount))
      .toEqual([4200])
  })

  it('ne renvoie rien quand rien ne correspond', () => {
    expect(filterTransactions(transactions, all({ search: 'zzz' }), context)).toHaveLength(0)
  })

  it('une recherche vide ne filtre rien', () => {
    expect(filterTransactions(transactions, all({ search: '   ' }), context)).toHaveLength(3)
  })
})

describe('tri', () => {
  it('la plus récente en premier, et à date égale la dernière saisie', () => {
    const older = tx({ type: 'expense', amount: 100, date: '2026-09-10' })
    const newer = tx({ type: 'expense', amount: 200, date: '2026-09-10' })
    const other = tx({ type: 'expense', amount: 300, date: '2026-09-12' })

    const kept = filterTransactions([older, newer, other], all(), context)
    expect(kept.map((t) => t.amount)).toEqual([300, 200, 100])
  })
})

describe('countActiveFilters', () => {
  it('ne compte pas la vue par défaut', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0)
  })

  it('compte chaque filtre posé, période comprise', () => {
    expect(countActiveFilters({ ...EMPTY_FILTERS, type: 'expense' })).toBe(1)
    expect(countActiveFilters({ ...EMPTY_FILTERS, type: 'expense', period: 'all' })).toBe(2)
    expect(
      countActiveFilters({ ...EMPTY_FILTERS, type: 'expense', accountId: 'acc-courant', categoryId: 'cat-shopping' }),
    ).toBe(3)
  })

  it('ne compte pas la recherche : elle est déjà visible dans son champ', () => {
    expect(countActiveFilters({ ...EMPTY_FILTERS, search: 'décathlon' })).toBe(0)
  })
})

describe('groupByDay', () => {
  it('regroupe en conservant l’ordre d’arrivée', () => {
    const groups = groupByDay([
      tx({ type: 'expense', amount: 100, date: '2026-09-12' }),
      tx({ type: 'expense', amount: 200, date: '2026-09-10' }),
      tx({ type: 'expense', amount: 300, date: '2026-09-10' }),
    ])

    expect(groups.map(([date, rows]) => [date, rows.length])).toEqual([
      ['2026-09-12', 1],
      ['2026-09-10', 2],
    ])
  })
})
