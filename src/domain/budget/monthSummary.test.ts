/**
 * src/domain/budget/monthSummary.test.ts
 *
 * Ces tests décrivent les règles métier en français et vérifient qu'elles sont
 * bien appliquées. Lance-les avec `npm test`.
 *
 * Ils servent de filet de sécurité : le jour où on modifiera les calculs, un
 * test rouge dira immédiatement quelle règle a été cassée.
 */

import { describe, expect, it } from 'vitest'
import type { Account, BudgetLine, Category, Transaction } from '../../db/types'
import { computeMonthSummary, transactionsOfMonth } from './monthSummary'

/* --- Jeu de données minimal, inspiré de la configuration réelle ---------- */

const accounts: Account[] = [
  { id: 'cic', name: 'CIC', kind: 'checking', countsAsSavings: false, order: 1, active: true },
  { id: 'lep', name: 'LEP', kind: 'savings', countsAsSavings: true, order: 2, active: true },
  { id: 'pea', name: 'PEA', kind: 'investment', countsAsSavings: true, order: 3, active: true },
  { id: 'av', name: 'Assurance-vie', kind: 'investment', countsAsSavings: true, order: 4, active: true },
  { id: 'micro', name: 'Micro', kind: 'micro', countsAsSavings: false, order: 5, active: true },
]

const categories: Category[] = [
  { id: 'shopping', name: 'Shopping', kind: 'expense', group: 'loisirs', order: 1, active: true },
  { id: 'sorties', name: 'Sorties', kind: 'expense', group: 'loisirs', order: 2, active: true },
  { id: 'essence', name: 'Essence', kind: 'expense', group: 'chargesFixes', order: 1, active: true },
  { id: 'itaxia', name: 'ITAXIA', kind: 'income', group: 'revenuPerso', order: 1, active: true },
  { id: 'av-env', name: 'Assurance-vie', kind: 'saving', group: 'epargne', order: 1, active: true },
  { id: 'flex', name: 'Flexible LEP / PEA', kind: 'saving', group: 'epargne', order: 2, active: true },
  { id: 'micro-logiciels', name: 'Logiciels', kind: 'expense', group: 'micro', order: 1, active: true, isMicro: true },
]

const budget: BudgetLine[] = [
  { categoryId: 'shopping', amount: 20000 },
  { categoryId: 'sorties', amount: 10000 },
  { categoryId: 'essence', amount: 15000 },
  { categoryId: 'av-env', amount: 50000 },
  { categoryId: 'flex', amount: 35000 },
]

const savingCategoryAccounts = {
  'av-env': ['av'],
  flex: ['lep', 'pea'],
}

let sequence = 0
function tx(partial: Partial<Transaction> & Pick<Transaction, 'type' | 'amount'>): Transaction {
  sequence += 1
  return {
    id: `t${sequence}`,
    date: '2026-09-16',
    createdAt: '2026-09-16T10:00:00.000Z',
    updatedAt: '2026-09-16T10:00:00.000Z',
    ...partial,
  }
}

const summarise = (transactions: Transaction[], month = '2026-09') =>
  computeMonthSummary({
    month,
    transactions,
    accounts,
    categories,
    budget,
    savingCategoryAccounts,
  })

/* ------------------------------------------------------------------------ */

describe('transactionsOfMonth', () => {
  it('ne garde que les opérations du mois demandé', () => {
    const transactions = [
      tx({ type: 'expense', amount: 100, date: '2026-08-31' }),
      tx({ type: 'expense', amount: 200, date: '2026-09-01' }),
      tx({ type: 'expense', amount: 300, date: '2026-09-30' }),
      tx({ type: 'expense', amount: 400, date: '2026-10-01' }),
    ]

    const kept = transactionsOfMonth(transactions, '2026-09')

    expect(kept.map((t) => t.amount)).toEqual([200, 300])
  })
})

describe('scénario de validation du cahier des charges', () => {
  it('une dépense de 24,50 € en Shopping donne 24,50 € dépensés et 175,50 € de reste', () => {
    const summary = summarise([
      tx({ type: 'expense', amount: 2450, categoryId: 'shopping', accountId: 'cic' }),
    ])

    expect(summary.expenses).toBe(2450)
    expect(summary.byCategory.shopping.spent).toBe(2450)
    expect(summary.byCategory.shopping.budget).toBe(20000)
    expect(summary.byCategory.shopping.remaining).toBe(17550)
  })
})

describe('règle 1 — un transfert n’est jamais une dépense', () => {
  it('un virement CIC -> LEP ne gonfle pas les sorties du mois', () => {
    const summary = summarise([
      tx({ type: 'expense', amount: 2450, categoryId: 'shopping', accountId: 'cic' }),
      tx({ type: 'transfer', amount: 30000, fromAccountId: 'cic', toAccountId: 'lep' }),
    ])

    expect(summary.expenses).toBe(2450)
    expect(summary.savings).toBe(30000)
  })
})

describe('règle 2 — l’épargne du mois est l’argent qui entre dans la poche épargne', () => {
  it('compte les virements du compte courant vers les comptes d’épargne', () => {
    const summary = summarise([
      tx({ type: 'transfer', amount: 50000, fromAccountId: 'cic', toAccountId: 'av' }),
      tx({ type: 'transfer', amount: 15000, fromAccountId: 'cic', toAccountId: 'lep' }),
      tx({ type: 'transfer', amount: 20000, fromAccountId: 'cic', toAccountId: 'pea' }),
    ])

    expect(summary.savings).toBe(85000)
  })

  it('ignore un virement interne LEP -> PEA, qui ne crée pas d’épargne nouvelle', () => {
    const summary = summarise([
      tx({ type: 'transfer', amount: 100000, fromAccountId: 'lep', toAccountId: 'pea' }),
    ])

    expect(summary.savings).toBe(0)
  })

  it('ignore un retrait LEP -> CIC', () => {
    const summary = summarise([
      tx({ type: 'transfer', amount: 100000, fromAccountId: 'lep', toAccountId: 'cic' }),
    ])

    expect(summary.savings).toBe(0)
    expect(summary.expenses).toBe(0)
  })

  it('ventile les virements dans la bonne enveloppe d’épargne', () => {
    const summary = summarise([
      tx({ type: 'transfer', amount: 50000, fromAccountId: 'cic', toAccountId: 'av' }),
      tx({ type: 'transfer', amount: 15000, fromAccountId: 'cic', toAccountId: 'lep' }),
      tx({ type: 'transfer', amount: 20000, fromAccountId: 'cic', toAccountId: 'pea' }),
    ])

    expect(summary.byCategory['av-env'].spent).toBe(50000)
    expect(summary.byCategory['av-env'].remaining).toBe(0)
    // L'enveloppe flexible est alimentée par le LEP ET le PEA : 150 € + 200 €.
    expect(summary.byCategory.flex.spent).toBe(35000)
    expect(summary.byCategory.flex.remaining).toBe(0)
  })
})

describe('règle 3 — la micro-entreprise ne se mélange pas au budget personnel', () => {
  it('exclut une dépense micro des sorties personnelles', () => {
    const summary = summarise([
      tx({ type: 'expense', amount: 2450, categoryId: 'shopping', accountId: 'cic' }),
      tx({ type: 'expense', amount: 9900, categoryId: 'micro-logiciels', accountId: 'micro', isMicro: true }),
    ])

    expect(summary.expenses).toBe(2450)
    expect(summary.byCategory['micro-logiciels'].spent).toBe(0)
  })

  it('exclut un encaissement micro des entrées personnelles', () => {
    const summary = summarise([
      tx({ type: 'income', amount: 120000, categoryId: 'itaxia', accountId: 'cic' }),
      tx({ type: 'income', amount: 77000, categoryId: 'itaxia', accountId: 'micro', isMicro: true }),
    ])

    expect(summary.income).toBe(120000)
  })
})

describe('agrégation par carte du Dashboard', () => {
  it('additionne les sous-catégories d’un groupe', () => {
    const summary = summarise([
      tx({ type: 'expense', amount: 2450, categoryId: 'shopping', accountId: 'cic' }),
      tx({ type: 'expense', amount: 3000, categoryId: 'sorties', accountId: 'cic' }),
    ])

    // Loisirs : budget 300 €, dépensé 54,50 €, reste 245,50 €.
    expect(summary.byGroup.loisirs.budget).toBe(30000)
    expect(summary.byGroup.loisirs.spent).toBe(5450)
    expect(summary.byGroup.loisirs.remaining).toBe(24550)
    expect(summary.leisureRemaining).toBe(24550)
  })

  it('affiche un reste négatif en cas de dépassement, sans le masquer', () => {
    const summary = summarise([
      tx({ type: 'expense', amount: 25000, categoryId: 'shopping', accountId: 'cic' }),
    ])

    expect(summary.byCategory.shopping.remaining).toBe(-5000)
    expect(summary.leisureRemaining).toBe(5000) // 300 € de budget - 250 € dépensés
  })
})

describe('mois vide', () => {
  it('renvoie des indicateurs à zéro et les budgets intacts', () => {
    const summary = summarise([])

    expect(summary.income).toBe(0)
    expect(summary.expenses).toBe(0)
    expect(summary.savings).toBe(0)
    expect(summary.byCategory.shopping.remaining).toBe(20000)
    expect(summary.leisureRemaining).toBe(30000)
  })
})
