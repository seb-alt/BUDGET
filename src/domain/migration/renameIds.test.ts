import { describe, expect, it } from 'vitest'
import {
  V5_RENAMES,
  renameInBackupData,
  renameInCategory,
  renameInMicroSettings,
  renameInMonthlyBudget,
  renameInRecurringRule,
  renameInSettings,
  renameInSnapshot,
  renameInTransaction,
} from './renameIds'
import type { Category, Settings, Transaction } from '../../db/types'

/*
 * ATTENTION EN RELISANT CE FICHIER.
 *
 * Les ANCIENS identifiants ('acc-cic', 'cat-itaxia') sont ici des ENTRÉES : ce
 * sont eux qu'une base d'avant la version 5 contient. Les remplacer par les
 * nouveaux rendrait chaque test vide de sens — il vérifierait qu'un nom déjà
 * neutre reste neutre, ce qui est vrai de n'importe quelle fonction.
 */
const R = V5_RENAMES

describe('renameInTransaction', () => {
  const base = { id: 't1', date: '2026-09-10', amount: 1000, createdAt: '', updatedAt: '' }

  it('renomme la catégorie et le compte', () => {
    const out = renameInTransaction(
      {
        ...base,
        type: 'income',
        categoryId: 'cat-itaxia',
        accountId: 'acc-cic',
      } as Transaction,
      R,
    )
    expect(out.categoryId).toBe('cat-revenu-1')
    expect(out.accountId).toBe('acc-courant')
  })

  it('renomme les deux côtés d’un virement', () => {
    const out = renameInTransaction(
      {
        ...base,
        type: 'transfer',
        fromAccountId: 'acc-cic',
        toAccountId: 'acc-lep',
      } as Transaction,
      R,
    )
    expect(out.fromAccountId).toBe('acc-courant')
    expect(out.toAccountId).toBe('acc-lep')
  })

  it('laisse intact ce qui n’est pas concerné', () => {
    const row = {
      ...base,
      type: 'expense',
      categoryId: 'cat-sorties',
      accountId: 'acc-lep',
    } as Transaction
    expect(renameInTransaction(row, R)).toEqual(row)
  })

  it('ne transforme pas un champ absent en quelque chose', () => {
    const out = renameInTransaction({ ...base, type: 'expense' } as Transaction, R)
    expect(out.categoryId).toBeUndefined()
    expect(out.fromAccountId).toBeUndefined()
  })

  it('ne touche à rien d’autre : montant, date, libellé', () => {
    const row = {
      ...base,
      type: 'income',
      categoryId: 'cat-itaxia',
      accountId: 'acc-cic',
      label: 'Salaire',
      isMicro: true,
    } as Transaction
    const out = renameInTransaction(row, R)
    expect(out.amount).toBe(1000)
    expect(out.date).toBe('2026-09-10')
    expect(out.label).toBe('Salaire')
    expect(out.isMicro).toBe(true)
  })
})

describe('renameInCategory', () => {
  const base = { kind: 'income', group: 'revenuPerso', order: 1, active: true } as const

  it('renomme l’identifiant ET le nom affiché', () => {
    const out = renameInCategory({ ...base, id: 'cat-itaxia', name: 'ITAXIA' } as Category, R)
    expect(out.id).toBe('cat-revenu-1')
    expect(out.name).toBe('Revenu principal')
  })

  it('garde le nom d’une catégorie non renommée, même si tu l’as personnalisé', () => {
    const row = { ...base, id: 'cat-sorties', name: 'Mes sorties' } as Category
    expect(renameInCategory(row, R)).toEqual(row)
  })

  it('suit les comptes d’épargne rattachés', () => {
    const out = renameInCategory(
      {
        id: 'cat-epargne-flexible',
        name: 'Enveloppe flexible',
        kind: 'saving',
        group: 'epargne',
        order: 1,
        active: true,
        savingAccountIds: ['acc-cic', 'acc-pea'],
      } as Category,
      R,
    )
    expect(out.savingAccountIds).toEqual(['acc-courant', 'acc-pea'])
  })
})

describe('renameInSettings', () => {
  const settings = {
    id: 1,
    referenceIncome: 0,
    budgetTemplate: [
      { categoryId: 'cat-itaxia', amount: 100 },
      { categoryId: 'cat-sorties', amount: 200 },
    ],
    lepThreshold: 0,
    assuranceVieMonthly: 0,
    flexibleSavingsCategoryId: 'cat-epargne-flexible',
    lepAccountId: 'acc-lep',
    peaAccountId: 'acc-pea',
    assuranceVieAccountId: 'acc-assurance-vie',
    defaultAccountId: 'acc-cic',
    createdAt: '',
    updatedAt: '',
  } as Settings

  it('suit le compte par défaut', () => {
    expect(renameInSettings(settings, R).defaultAccountId).toBe('acc-courant')
  })

  it('suit les lignes du budget type', () => {
    expect(renameInSettings(settings, R).budgetTemplate).toEqual([
      { categoryId: 'cat-revenu-1', amount: 100 },
      { categoryId: 'cat-sorties', amount: 200 },
    ])
  })

  it('laisse les comptes non concernés en place', () => {
    const out = renameInSettings(settings, R)
    expect(out.lepAccountId).toBe('acc-lep')
    expect(out.peaAccountId).toBe('acc-pea')
  })
})

describe('les autres tables', () => {
  it('suit les soldes d’un relevé de patrimoine', () => {
    const out = renameInSnapshot(
      {
        id: 's1',
        date: '2026-09-30',
        balances: [
          { accountId: 'acc-cic', balance: 100 },
          { accountId: 'acc-lep', balance: 200 },
        ],
        createdAt: '',
      },
      R,
    )
    expect(out.balances.map((b) => b.accountId)).toEqual(['acc-courant', 'acc-lep'])
    expect(out.balances[0].balance).toBe(100)
  })

  it('suit les lignes d’un budget mensuel figé', () => {
    const out = renameInMonthlyBudget(
      {
        id: 'b1',
        month: '2026-09',
        lines: [{ categoryId: 'cat-itaxia', amount: 500 }],
        referenceIncome: 0,
        lepThreshold: 0,
        assuranceVieMonthly: 0,
        createdAt: '',
        updatedAt: '',
      },
      R,
    )
    expect(out.lines[0].categoryId).toBe('cat-revenu-1')
    expect(out.lines[0].amount).toBe(500)
  })

  it('suit une règle récurrente', () => {
    const out = renameInRecurringRule(
      {
        id: 'r1',
        name: 'Salaire',
        type: 'income',
        amount: 100,
        frequency: 'monthly',
        dayOfMonth: 1,
        startDate: '2026-01-01',
        active: true,
        mode: 'auto',
        categoryId: 'cat-itaxia',
        accountId: 'acc-cic',
        createdAt: '',
        updatedAt: '',
      },
      R,
    )
    expect(out.categoryId).toBe('cat-revenu-1')
    expect(out.accountId).toBe('acc-courant')
  })

  it('suit les réglages de la micro-entreprise', () => {
    const out = renameInMicroSettings(
      {
        id: 1,
        urssafRate: 0.256,
        acreEnabled: false,
        defaultPaymentTermDays: 30,
        microAccountId: 'acc-cic',
        urssafCategoryId: 'cat-micro-urssaf',
        invoiceNumberPrefix: 'F',
        nextInvoiceNumber: 1,
        createdAt: '',
        updatedAt: '',
      },
      R,
    )
    expect(out.microAccountId).toBe('acc-courant')
    expect(out.urssafCategoryId).toBe('cat-micro-urssaf')
  })
})

describe('renameInBackupData', () => {
  const legacy = () => ({
    accounts: [{ id: 'acc-cic', name: 'CIC', kind: 'checking', order: 1, active: true }],
    categories: [],
    transactions: [
      {
        id: 't',
        date: '2026-09-01',
        type: 'expense',
        amount: 1,
        accountId: 'acc-cic',
        createdAt: '',
        updatedAt: '',
      },
    ],
    monthlyBudgets: [],
    recurringRules: [],
    patrimonySnapshots: [],
    microClients: [{ id: 'c1', name: 'Client' }],
    microInvoices: [],
    microForecasts: [],
    settings: [],
    microSettings: [],
  })

  it('traite toutes les tables d’une sauvegarde d’un coup', () => {
    const out = renameInBackupData(legacy(), R)
    expect((out.accounts[0] as { id: string }).id).toBe('acc-courant')
    expect((out.accounts[0] as { name: string }).name).toBe('Compte courant')
    expect((out.transactions[0] as { accountId: string }).accountId).toBe('acc-courant')
    // Les tables sans identifiant concerné passent telles quelles.
    expect(out.microClients).toEqual([{ id: 'c1', name: 'Client' }])
  })

  it('accepte une sauvegarde à laquelle il manque des tables', () => {
    const out = renameInBackupData({ transactions: [] }, R)
    expect(out.accounts).toEqual([])
    expect(out.settings).toEqual([])
  })

  it('appliqué deux fois, ne change rien de plus', () => {
    const once = renameInBackupData(legacy(), R)
    expect(renameInBackupData(once, R)).toEqual(once)
  })
})
