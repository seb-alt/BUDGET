/**
 * src/utils/money.test.ts
 *
 * Vérifie la traduction entre ce que tu tapes et ce qui est stocké.
 * C'est le point d'entrée de toutes les données chiffrées de l'application :
 * une erreur ici se propagerait partout.
 */

import { describe, expect, it } from 'vitest'
import {
  appendAmountKey,
  formatEurosCompact,
  parseAmountInput,
  parseBalanceInput,
  sumCents,
  toCents,
} from './money'

describe('parseAmountInput', () => {
  it('accepte la virgule française', () => {
    expect(parseAmountInput('24,50')).toBe(2450)
  })

  it('accepte le point', () => {
    expect(parseAmountInput('24.50')).toBe(2450)
  })

  it('accepte un montant rond', () => {
    expect(parseAmountInput('20')).toBe(2000)
  })

  it('tolère un séparateur en cours de frappe', () => {
    expect(parseAmountInput('24,')).toBe(2400)
  })

  it('ignore les espaces de milliers', () => {
    expect(parseAmountInput('1 234,5')).toBe(123450)
  })

  it('refuse une saisie vide, nulle ou négative', () => {
    expect(parseAmountInput('')).toBeNull()
    expect(parseAmountInput('0')).toBeNull()
    expect(parseAmountInput('0,00')).toBeNull()
    expect(parseAmountInput('-5')).toBeNull()
  })

  it('refuse du texte', () => {
    expect(parseAmountInput('abc')).toBeNull()
    expect(parseAmountInput('12e4')).toBeNull()
  })
})

describe('toCents', () => {
  it('évite les erreurs d’arrondi des nombres à virgule', () => {
    // 1.005 * 100 vaut 100.49999999999999 en JavaScript : on doit obtenir 101.
    expect(toCents(1.005)).toBe(101)
    expect(toCents(0.1 + 0.2)).toBe(30)
  })
})

describe('sumCents', () => {
  it('additionne sans dérive, même sur beaucoup de valeurs', () => {
    const cents = Array.from({ length: 1000 }, () => 10)
    expect(sumCents(cents)).toBe(10000)
  })
})

describe('formatEurosCompact', () => {
  it('masque les centimes quand ils valent zéro', () => {
    expect(formatEurosCompact(2000).replace(/ | /g, ' ')).toBe('20 €')
  })

  it('affiche les centimes quand il y en a', () => {
    expect(formatEurosCompact(2450).replace(/ | /g, ' ')).toBe('24,50 €')
  })
})

describe('appendAmountKey', () => {
  const type = (keys: string[]) => keys.reduce(appendAmountKey, '')

  it('construit un montant chiffre après chiffre', () => {
    expect(type(['2', '4', ',', '5', '0'])).toBe('24,50')
  })

  it('accepte un montant rond', () => {
    expect(type(['2', '0'])).toBe('20')
  })

  it('refuse une troisième décimale', () => {
    expect(type(['1', ',', '2', '3', '4'])).toBe('1,23')
  })

  it('refuse une deuxième virgule', () => {
    expect(type(['1', ',', '5', ','])).toBe('1,5')
  })

  it('préfixe la virgule d’un zéro si on commence par elle', () => {
    expect(type([','])).toBe('0,')
    expect(type([',', '9', '9'])).toBe('0,99')
  })

  it('remplace un zéro initial au lieu de l’accumuler', () => {
    expect(type(['0', '5'])).toBe('5')
  })

  it('efface le dernier caractère', () => {
    expect(appendAmountKey('24,50', 'backspace')).toBe('24,5')
    expect(appendAmountKey('', 'backspace')).toBe('')
  })

  it('limite la partie entière', () => {
    expect(type(['1', '2', '3', '4', '5', '6', '7', '8'])).toBe('1234567')
  })

  it('ignore une touche inconnue', () => {
    expect(appendAmountKey('24', 'a')).toBe('24')
  })
})

describe('parseBalanceInput', () => {
  it('accepte zéro — un compte peut être vide', () => {
    expect(parseBalanceInput('0')).toBe(0)
    expect(parseBalanceInput('0,00')).toBe(0)
  })

  it('accepte un découvert', () => {
    expect(parseBalanceInput('-120,50')).toBe(-12050)
    // Le vrai signe moins typographique, que certains claviers produisent.
    expect(parseBalanceInput('−120,50')).toBe(-12050)
  })

  it('accepte un solde ordinaire', () => {
    expect(parseBalanceInput('7 850')).toBe(785000)
  })

  it('refuse une saisie vide ou incohérente', () => {
    expect(parseBalanceInput('')).toBeNull()
    expect(parseBalanceInput('   ')).toBeNull()
    expect(parseBalanceInput('abc')).toBeNull()
    expect(parseBalanceInput('-')).toBeNull()
  })
})
