/**
 * Tests de l'évolution du patrimoine.
 *
 * Le point critique : la performance. Une erreur de signe ferait passer une
 * perte pour un gain, et rien à l'écran ne le trahirait.
 */

import { describe, expect, it } from 'vitest'
import type { PatrimonySnapshot, Transaction } from '../../db/types'
import {
  buildPatrimonySeries,
  buildYearlySummaries,
  lastDayOfMonth,
  monthsBetween,
  netContributions,
  splitContributionAndPerformance,
} from './patrimonySeries'

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

const snapshot = (date: string, balances: Record<string, number>): PatrimonySnapshot => ({
  id: `s-${date}`,
  date,
  balances: Object.entries(balances).map(([accountId, balance]) => ({ accountId, balance })),
  createdAt: `${date}T00:00:00.000Z`,
})

describe('lastDayOfMonth', () => {
  it('trouve le dernier jour sans connaître la longueur des mois', () => {
    expect(lastDayOfMonth('2026-01')).toBe('2026-01-31')
    expect(lastDayOfMonth('2026-04')).toBe('2026-04-30')
    expect(lastDayOfMonth('2026-02')).toBe('2026-02-28')
  })

  it('gère les années bissextiles', () => {
    expect(lastDayOfMonth('2028-02')).toBe('2028-02-29')
  })
})

describe('monthsBetween', () => {
  it('liste les mois, bornes comprises', () => {
    expect(monthsBetween('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
  })

  it('renvoie un seul mois quand les bornes sont égales', () => {
    expect(monthsBetween('2026-09', '2026-09')).toEqual(['2026-09'])
  })

  it('renvoie une liste vide si la fin précède le début', () => {
    expect(monthsBetween('2026-09', '2026-08')).toEqual([])
  })
})

describe('buildPatrimonySeries', () => {
  const transactions = [
    tx({ type: 'transfer', amount: 100000, fromAccountId: 'cic', toAccountId: 'lep', date: '2026-07-15' }),
    tx({ type: 'transfer', amount: 50000, fromAccountId: 'cic', toAccountId: 'av', date: '2026-08-15' }),
    tx({ type: 'transfer', amount: 50000, fromAccountId: 'cic', toAccountId: 'av', date: '2026-09-15' }),
  ]

  it('suit la progression mois après mois', () => {
    const series = buildPatrimonySeries(
      ['2026-07', '2026-08', '2026-09'],
      ['lep', 'av'],
      transactions,
      [],
    )

    expect(series.map((point) => point.total)).toEqual([100000, 150000, 200000])
    expect(series[2].byAccount).toEqual({ lep: 100000, av: 100000 })
  })

  it('repart d’un relevé manuel quand il y en a un', () => {
    const series = buildPatrimonySeries(
      ['2026-08', '2026-09'],
      ['lep'],
      transactions,
      [snapshot('2026-08-01', { lep: 500000 })],
    )
    expect(series.map((point) => point.total)).toEqual([500000, 500000])
  })
})

describe('netContributions', () => {
  const transactions = [
    tx({ type: 'transfer', amount: 50000, fromAccountId: 'cic', toAccountId: 'av', date: '2026-08-15' }),
    tx({ type: 'transfer', amount: 20000, fromAccountId: 'av', toAccountId: 'cic', date: '2026-09-20' }),
  ]

  it('additionne les entrées et retranche les sorties', () => {
    expect(netContributions(['av'], transactions, '2026-08-01', '2026-09-30')).toBe(30000)
  })

  it('respecte les bornes de la période', () => {
    expect(netContributions(['av'], transactions, '2026-08-01', '2026-08-31')).toBe(50000)
    expect(netContributions(['av'], transactions, '2026-09-01', '2026-09-30')).toBe(-20000)
  })

  it('inclut les opérations des jours de bornes', () => {
    expect(netContributions(['av'], transactions, '2026-08-15', '2026-08-15')).toBe(50000)
  })
})

describe('versements contre performance — le cœur du §8', () => {
  it('un gain : le solde monte plus que les versements', () => {
    // Versé 500 €, le solde passe de 8 000 € à 8 600 € : 100 € de gain.
    const split = splitContributionAndPerformance(
      ['av'],
      [tx({ type: 'transfer', amount: 50000, fromAccountId: 'cic', toAccountId: 'av', date: '2026-09-05' })],
      [snapshot('2026-08-31', { av: 800000 }), snapshot('2026-09-30', { av: 860000 })],
      '2026-09-01',
      '2026-09-30',
    )

    expect(split.change).toBe(60000)
    expect(split.contributions).toBe(50000)
    expect(split.performance).toBe(10000)
  })

  it('une PERTE que la hausse du solde aurait cachée', () => {
    // Versé 700 €, le solde ne monte que de 600 € : 100 € perdus.
    const split = splitContributionAndPerformance(
      ['av'],
      [tx({ type: 'transfer', amount: 70000, fromAccountId: 'cic', toAccountId: 'av', date: '2026-09-05' })],
      [snapshot('2026-08-31', { av: 800000 }), snapshot('2026-09-30', { av: 860000 })],
      '2026-09-01',
      '2026-09-30',
    )

    expect(split.change).toBe(60000)
    expect(split.contributions).toBe(70000)
    expect(split.performance).toBe(-10000)
  })

  it('sans relevé, la performance vaut zéro — et c’est honnête', () => {
    // Le solde n'est alors que le cumul des versements : il n'y a rien de plus
    // à constater, et prétendre le contraire serait inventer un chiffre.
    const split = splitContributionAndPerformance(
      ['av'],
      [tx({ type: 'transfer', amount: 50000, fromAccountId: 'cic', toAccountId: 'av', date: '2026-09-05' })],
      [],
      '2026-09-01',
      '2026-09-30',
    )

    expect(split.contributions).toBe(50000)
    expect(split.performance).toBe(0)
  })

  it('compte les mouvements du PREMIER jour de la période', () => {
    // Le solde de départ est celui de la veille : sinon un versement du 1er
    // serait compté dans le solde initial ET dans les versements, et la
    // performance afficherait une perte fictive.
    const split = splitContributionAndPerformance(
      ['av'],
      [tx({ type: 'transfer', amount: 50000, fromAccountId: 'cic', toAccountId: 'av', date: '2026-09-01' })],
      [],
      '2026-09-01',
      '2026-09-30',
    )

    expect(split.contributions).toBe(50000)
    expect(split.performance).toBe(0)
  })
})

describe('le capital qui préexiste ne doit jamais passer pour un gain', () => {
  // L'assurance-vie contient déjà 8 000 € au premier relevé, le 31 août.
  const snapshots = [
    snapshot('2026-08-31', { av: 800000 }),
    snapshot('2026-09-30', { av: 860000 }),
  ]
  const transactions = [
    tx({ type: 'transfer', amount: 70000, fromAccountId: 'cic', toAccountId: 'av', date: '2026-09-05' }),
  ]

  it('ne compte pas les 8 000 € préexistants comme une performance', () => {
    // Sur l'année entière, alors que le premier relevé date du 31 août.
    const split = splitContributionAndPerformance(
      ['av'],
      transactions,
      snapshots,
      '2026-01-01',
      '2026-12-31',
    )

    // Versé 700 €, solde passé de 8 000 € à 8 600 € : la valeur a perdu 100 €.
    expect(split.performance).toBe(-10000)
    expect(split.performance).not.toBe(790000)
  })

  it('annonce depuis quand la performance est constatable', () => {
    const split = splitContributionAndPerformance(
      ['av'],
      transactions,
      snapshots,
      '2026-01-01',
      '2026-12-31',
    )
    // Le lendemain du premier relevé : les opérations du jour du relevé sont
    // déjà comprises dans le solde relevé.
    expect(split.performanceSince).toBe('2026-09-01')
  })

  it('les versements, eux, couvrent bien toute la période demandée', () => {
    const split = splitContributionAndPerformance(
      ['av'],
      [
        tx({ type: 'transfer', amount: 50000, fromAccountId: 'cic', toAccountId: 'av', date: '2026-03-01' }),
        ...transactions,
      ],
      snapshots,
      '2026-01-01',
      '2026-12-31',
    )
    // Ils viennent des opérations, pas des soldes : mars compte.
    expect(split.contributions).toBe(120000)
  })

  it('utilise la veille de la période quand un relevé la couvre déjà', () => {
    const split = splitContributionAndPerformance(
      ['av'],
      transactions,
      snapshots,
      '2026-09-01',
      '2026-09-30',
    )
    expect(split.performance).toBe(-10000)
    expect(split.performanceSince).toBe('2026-09-01')
  })

  it('ne constate rien quand le premier relevé est postérieur à la période', () => {
    const split = splitContributionAndPerformance(
      ['av'],
      transactions,
      [snapshot('2027-01-31', { av: 900000 })],
      '2026-01-01',
      '2026-12-31',
    )
    expect(split.performance).toBe(0)
    expect(split.performanceSince).toBeUndefined()
  })
})

describe('buildYearlySummaries', () => {
  it('donne un bilan par année', () => {
    const transactions = [
      tx({ type: 'transfer', amount: 100000, fromAccountId: 'cic', toAccountId: 'av', date: '2025-06-01' }),
      tx({ type: 'transfer', amount: 200000, fromAccountId: 'cic', toAccountId: 'av', date: '2026-06-01' }),
    ]

    const summaries = buildYearlySummaries([2025, 2026], ['av'], ['av'], transactions, [])

    expect(summaries.map((s) => s.contributions)).toEqual([100000, 200000])
  })

  it('les versements ne s’annulent pas en prenant les comptes ensemble', () => {
    // Le piège : si les versements portaient sur TOUS les comptes, le débit
    // du compte courant annulerait le crédit du LEP, et l'effort d'épargne
    // afficherait zéro. D'où deux ensembles de comptes distincts.
    const transactions = [
      tx({ type: 'transfer', amount: 100000, fromAccountId: 'cic', toAccountId: 'lep', date: '2026-06-01' }),
    ]

    expect(buildYearlySummaries([2026], ['lep', 'av'], ['av'], transactions, [])[0].contributions).toBe(
      100000,
    )
    expect(buildYearlySummaries([2026], ['cic', 'lep'], ['av'], transactions, [])[0].contributions).toBe(
      0,
    )
  })
})
