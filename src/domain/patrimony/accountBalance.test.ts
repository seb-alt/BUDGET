/**
 * Tests du calcul des soldes.
 *
 * C'est le chiffre qui décide si le LEP est plein, donc où part ton épargne.
 * Une erreur de signe sur un transfert fausserait toute la répartition.
 */

import { describe, expect, it } from 'vitest'
import type { PatrimonySnapshot, Transaction } from '../../db/types'
import { computeAccountBalance, computeAccountBalances } from './accountBalance'

let sequence = 0
function tx(partial: Partial<Transaction> & Pick<Transaction, 'type' | 'amount'>): Transaction {
  sequence += 1
  return {
    id: `t${sequence}`,
    date: '2026-09-10',
    createdAt: '2026-09-10T00:00:00.000Z',
    updatedAt: '2026-09-10T00:00:00.000Z',
    ...partial,
  }
}

const snapshot = (
  date: string,
  balances: Record<string, number>,
): PatrimonySnapshot => ({
  id: `s-${date}`,
  date,
  balances: Object.entries(balances).map(([accountId, balance]) => ({ accountId, balance })),
  createdAt: `${date}T00:00:00.000Z`,
})

describe('sans relevé manuel', () => {
  it('part de zéro et cumule les opérations', () => {
    const balance = computeAccountBalance(
      'cic',
      [
        tx({ type: 'income', amount: 200000, accountId: 'cic' }),
        tx({ type: 'expense', amount: 2450, accountId: 'cic' }),
      ],
      [],
    )

    expect(balance.balance).toBe(197550)
    expect(balance.since).toBeUndefined()
  })

  it('un compte sans aucune opération vaut zéro', () => {
    expect(computeAccountBalance('pea', [], []).balance).toBe(0)
  })
})

describe('sens des mouvements', () => {
  const transactions = [
    tx({ type: 'transfer', amount: 30000, fromAccountId: 'cic', toAccountId: 'lep' }),
  ]

  it('un transfert débite le compte de départ', () => {
    expect(computeAccountBalance('cic', transactions, []).balance).toBe(-30000)
  })

  it('et crédite le compte d’arrivée', () => {
    expect(computeAccountBalance('lep', transactions, []).balance).toBe(30000)
  })

  it('ne touche pas un compte étranger à l’opération', () => {
    expect(computeAccountBalance('pea', transactions, []).balance).toBe(0)
  })

  it('une dépense débite, une entrée crédite', () => {
    expect(
      computeAccountBalance('cic', [tx({ type: 'expense', amount: 5000, accountId: 'cic' })], [])
        .balance,
    ).toBe(-5000)
    expect(
      computeAccountBalance('cic', [tx({ type: 'income', amount: 5000, accountId: 'cic' })], [])
        .balance,
    ).toBe(5000)
  })
})

describe('avec relevé manuel', () => {
  const transactions = [
    tx({ type: 'expense', amount: 10000, accountId: 'cic', date: '2026-08-20' }),
    tx({ type: 'expense', amount: 2000, accountId: 'cic', date: '2026-09-01' }),
    tx({ type: 'expense', amount: 3000, accountId: 'cic', date: '2026-09-05' }),
  ]

  it('repart du relevé et ignore ce qui le précède', () => {
    const balance = computeAccountBalance('cic', transactions, [snapshot('2026-09-01', { cic: 150000 })])

    // 1 500 € au 1er septembre, moins les 30 € du 5 septembre.
    expect(balance.balance).toBe(147000)
    expect(balance.since).toBe('2026-09-01')
  })

  it('ne recompte pas les opérations du JOUR du relevé', () => {
    // Le solde saisi fait foi pour cette date : les 20 € du 1er sont dedans.
    const balance = computeAccountBalance('cic', transactions, [snapshot('2026-09-01', { cic: 150000 })])
    expect(balance.balance).not.toBe(145000)
  })

  it('le relevé le plus récent l’emporte', () => {
    const balance = computeAccountBalance('cic', transactions, [
      snapshot('2026-08-01', { cic: 500000 }),
      snapshot('2026-09-01', { cic: 150000 }),
    ])
    expect(balance.balance).toBe(147000)
  })

  it('un relevé partiel ne recale que les comptes qu’il cite', () => {
    const balances = computeAccountBalances(
      ['cic', 'lep'],
      [
        tx({ type: 'transfer', amount: 30000, fromAccountId: 'cic', toAccountId: 'lep', date: '2026-09-05' }),
      ],
      // Le relevé ne parle que du CIC : le LEP reste calculé depuis zéro.
      [snapshot('2026-09-01', { cic: 150000 })],
    )

    expect(balances.get('cic')?.balance).toBe(120000)
    expect(balances.get('lep')?.balance).toBe(30000)
    expect(balances.get('lep')?.since).toBeUndefined()
  })
})

describe('plusieurs comptes d’un coup', () => {
  it('renvoie un solde par compte demandé', () => {
    const balances = computeAccountBalances(
      ['cic', 'lep', 'pea'],
      [tx({ type: 'transfer', amount: 30000, fromAccountId: 'cic', toAccountId: 'lep' })],
      [],
    )

    expect([...balances.keys()]).toEqual(['cic', 'lep', 'pea'])
    expect(balances.get('pea')?.balance).toBe(0)
  })
})

describe('solde à une date passée', () => {
  const transactions = [
    tx({ type: 'income', amount: 100000, accountId: 'cic', date: '2026-07-10' }),
    tx({ type: 'expense', amount: 20000, accountId: 'cic', date: '2026-08-10' }),
    tx({ type: 'expense', amount: 30000, accountId: 'cic', date: '2026-09-10' }),
  ]

  it('ignore les opérations postérieures à la date demandée', () => {
    expect(computeAccountBalance('cic', transactions, [], '2026-08-31').balance).toBe(80000)
    expect(computeAccountBalance('cic', transactions, [], '2026-07-31').balance).toBe(100000)
  })

  it('inclut les opérations du jour demandé', () => {
    expect(computeAccountBalance('cic', transactions, [], '2026-09-10').balance).toBe(50000)
  })

  it('vaut zéro avant la première opération', () => {
    expect(computeAccountBalance('cic', transactions, [], '2026-06-30').balance).toBe(0)
  })

  it('ignore un relevé POSTÉRIEUR à la date demandée', () => {
    // Un relevé de septembre ne dit rien du solde qu'on avait en juillet.
    const balance = computeAccountBalance(
      'cic',
      transactions,
      [snapshot('2026-09-01', { cic: 999999 })],
      '2026-08-31',
    )
    expect(balance.balance).toBe(80000)
  })

  it('utilise le dernier relevé antérieur à la date demandée', () => {
    const balance = computeAccountBalance(
      'cic',
      transactions,
      [snapshot('2026-08-01', { cic: 150000 })],
      '2026-08-31',
    )
    // 1 500 € au 1er août, moins les 200 € du 10 août.
    expect(balance.balance).toBe(130000)
  })
})
