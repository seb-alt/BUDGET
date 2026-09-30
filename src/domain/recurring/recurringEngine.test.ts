/**
 * Tests du moteur de récurrence.
 *
 * C'est le seul endroit de l'application qui crée des opérations sans que tu
 * les aies saisies. Une erreur ici passe inaperçue des semaines, puis ton
 * budget part en vrille. D'où le nombre de cas couverts.
 */

import { describe, expect, it } from 'vitest'
import type { RecurringRule } from '../../db/types'
import {
  clampDayOfMonth,
  occurrenceDates,
  pendingOccurrences,
  splitByMode,
} from './recurringEngine'

let sequence = 0
function rule(partial: Partial<RecurringRule> = {}): RecurringRule {
  sequence += 1
  return {
    id: `r${sequence}`,
    name: `Règle ${sequence}`,
    type: 'expense',
    amount: 35000,
    categoryId: 'cat-pret-etudiant',
    accountId: 'acc-courant',
    frequency: 'monthly',
    dayOfMonth: 5,
    startDate: '2026-01-05',
    active: true,
    mode: 'auto',
    createdAt: '',
    updatedAt: '',
    ...partial,
  }
}

describe('clampDayOfMonth : le 31 février n’existe pas', () => {
  it('ramène au dernier jour du mois', () => {
    expect(clampDayOfMonth(2026, 2, 31)).toBe('2026-02-28')
    expect(clampDayOfMonth(2026, 4, 31)).toBe('2026-04-30')
  })

  it('tient compte des années bissextiles', () => {
    expect(clampDayOfMonth(2028, 2, 31)).toBe('2028-02-29')
  })

  it('laisse un jour valable intact', () => {
    expect(clampDayOfMonth(2026, 3, 15)).toBe('2026-03-15')
  })
})

describe('occurrenceDates — mensuel', () => {
  it('produit une échéance par mois', () => {
    expect(occurrenceDates(rule(), '2026-04-30')).toEqual([
      '2026-01-05',
      '2026-02-05',
      '2026-03-05',
      '2026-04-05',
    ])
  })

  it('ne saute jamais un mois : le 31 devient le dernier jour', () => {
    // Sans ce repli, un loyer disparaîtrait un mois sur deux.
    const dates = occurrenceDates(rule({ dayOfMonth: 31, startDate: '2026-01-31' }), '2026-04-30')
    expect(dates).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
  })

  it('s’arrête à la date demandée', () => {
    expect(occurrenceDates(rule(), '2026-02-04')).toEqual(['2026-01-05'])
  })

  it('respecte la date de fin', () => {
    const dates = occurrenceDates(rule({ endDate: '2026-03-01' }), '2026-12-31')
    expect(dates).toEqual(['2026-01-05', '2026-02-05'])
  })

  it('ignore une échéance antérieure au début', () => {
    // Règle commencée le 20 janvier, échéance le 5 : janvier ne compte pas.
    const dates = occurrenceDates(rule({ startDate: '2026-01-20', dayOfMonth: 5 }), '2026-03-31')
    expect(dates).toEqual(['2026-02-05', '2026-03-05'])
  })

  it('ne produit rien si le début est dans le futur', () => {
    expect(occurrenceDates(rule({ startDate: '2027-01-05' }), '2026-12-31')).toEqual([])
  })

  it('ne produit rien pour une règle désactivée', () => {
    expect(occurrenceDates(rule({ active: false }), '2026-12-31')).toEqual([])
  })

  it('ne boucle pas indéfiniment sur une date aberrante', () => {
    const dates = occurrenceDates(rule({ startDate: '1900-01-05' }), '2026-12-31')
    expect(dates.length).toBeLessThanOrEqual(600)
  })
})

describe('occurrenceDates — hebdomadaire et annuel', () => {
  it('hebdomadaire : tous les sept jours depuis le début', () => {
    const dates = occurrenceDates(
      rule({ frequency: 'weekly', startDate: '2026-01-05' }),
      '2026-02-01',
    )
    expect(dates).toEqual(['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26'])
  })

  it('hebdomadaire : traverse les mois sans accroc', () => {
    const dates = occurrenceDates(
      rule({ frequency: 'weekly', startDate: '2026-01-29' }),
      '2026-02-15',
    )
    expect(dates).toEqual(['2026-01-29', '2026-02-05', '2026-02-12'])
  })

  it('annuel : une fois par an, au même mois', () => {
    const dates = occurrenceDates(
      rule({ frequency: 'yearly', startDate: '2026-06-15', dayOfMonth: 15 }),
      '2029-01-01',
    )
    expect(dates).toEqual(['2026-06-15', '2027-06-15', '2028-06-15'])
  })
})

describe('pendingOccurrences : jamais de doublon', () => {
  const loyer = rule({ id: 'loyer', name: 'Loyer', startDate: '2026-01-05' })

  it('propose les échéances manquantes', () => {
    const pending = pendingOccurrences([loyer], [], '2026-03-10')
    expect(pending.map((p) => p.date)).toEqual(['2026-01-05', '2026-02-05', '2026-03-05'])
  })

  it('écarte celles déjà enregistrées', () => {
    const pending = pendingOccurrences(
      [loyer],
      [
        { recurringRuleId: 'loyer', date: '2026-01-05' },
        { recurringRuleId: 'loyer', date: '2026-02-05' },
      ],
      '2026-03-10',
    )
    expect(pending.map((p) => p.date)).toEqual(['2026-03-05'])
  })

  it('appelée deux fois de suite, la seconde ne propose plus rien', () => {
    // C'est exactement le scénario « l'application est rouverte » : sans cette
    // garantie, chaque ouverture ajouterait un loyer.
    const first = pendingOccurrences([loyer], [], '2026-03-10')
    const materialised = first.map((p) => ({ recurringRuleId: p.rule.id, date: p.date }))
    expect(pendingOccurrences([loyer], materialised, '2026-03-10')).toEqual([])
  })

  it('ne confond pas deux règles tombant le même jour', () => {
    const abonnement = rule({ id: 'abo', name: 'Abonnement', startDate: '2026-01-05' })
    const pending = pendingOccurrences(
      [loyer, abonnement],
      [{ recurringRuleId: 'loyer', date: '2026-01-05' }],
      '2026-01-10',
    )
    expect(pending.map((p) => `${p.rule.id}@${p.date}`)).toEqual(['abo@2026-01-05'])
  })

  it('ignore les opérations saisies à la main le même jour', () => {
    // Une dépense saisie manuellement n'a pas d'identifiant de règle : elle ne
    // doit pas empêcher la règle de produire son échéance.
    const pending = pendingOccurrences([loyer], [{ date: '2026-01-05' }], '2026-01-10')
    expect(pending.map((p) => p.date)).toEqual(['2026-01-05'])
  })

  it('n’affiche plus une échéance explicitement écartée', () => {
    const pending = pendingOccurrences(
      [rule({ id: 'loyer', startDate: '2026-01-05', skippedDates: ['2026-02-05'] })],
      [],
      '2026-03-10',
    )
    expect(pending.map((p) => p.date)).toEqual(['2026-01-05', '2026-03-05'])
  })

  it('trie par date, la plus ancienne d’abord', () => {
    const a = rule({ id: 'a', name: 'Zèbre', startDate: '2026-02-05' })
    const b = rule({ id: 'b', name: 'Abeille', startDate: '2026-01-05' })
    const pending = pendingOccurrences([a, b], [], '2026-02-10')
    expect(pending.map((p) => p.date)).toEqual(['2026-01-05', '2026-02-05', '2026-02-05'])
  })
})

describe('splitByMode', () => {
  it('sépare ce qui se crée seul de ce qui demande ton accord', () => {
    const pending = pendingOccurrences(
      [
        rule({ id: 'auto', mode: 'auto', startDate: '2026-01-05' }),
        rule({ id: 'conf', mode: 'confirm', startDate: '2026-01-05' }),
      ],
      [],
      '2026-01-10',
    )
    const { automatic, toConfirm } = splitByMode(pending)

    expect(automatic.map((p) => p.rule.id)).toEqual(['auto'])
    expect(toConfirm.map((p) => p.rule.id)).toEqual(['conf'])
  })
})
