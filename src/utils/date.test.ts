/**
 * Tests des dates.
 *
 * Le piège principal : `new Date('2026-09-01')` est interprété en heure UTC et
 * peut retomber sur le 31 août en France. Tout le fichier lit l'heure locale ;
 * ces tests le vérifient.
 */

import { describe, expect, it } from 'vitest'
import { addMonths, formatDayLabel, formatMonthLabel, monthOf } from './date'

describe('addMonths', () => {
  it('avance d’un mois', () => {
    expect(addMonths('2026-09', 1)).toBe('2026-10')
  })

  it('passe à l’année suivante', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01')
  })

  it('recule sur l’année précédente', () => {
    expect(addMonths('2027-01', -1)).toBe('2026-12')
    expect(addMonths('2026-01', -2)).toBe('2025-11')
  })

  it('ne bouge pas avec un décalage nul', () => {
    expect(addMonths('2026-09', 0)).toBe('2026-09')
  })
})

describe('monthOf', () => {
  it('extrait le mois d’une date', () => {
    expect(monthOf('2026-09-16')).toBe('2026-09')
    // Le 1er du mois appartient bien à ce mois, malgré les fuseaux horaires.
    expect(monthOf('2026-09-01')).toBe('2026-09')
  })
})

describe('formatMonthLabel', () => {
  it('rend un libellé en majuscules', () => {
    expect(formatMonthLabel('2026-09')).toBe('SEPTEMBRE 2026')
    expect(formatMonthLabel('2027-01')).toBe('JANVIER 2027')
  })
})

describe('formatDayLabel', () => {
  const reference = '2026-09-16'

  it('nomme aujourd’hui et hier', () => {
    expect(formatDayLabel('2026-09-16', reference)).toBe("Aujourd'hui")
    expect(formatDayLabel('2026-09-15', reference)).toBe('Hier')
  })

  it('gère « hier » quand on change de mois', () => {
    expect(formatDayLabel('2026-08-31', '2026-09-01')).toBe('Hier')
  })

  it('écrit « 1er » et non « 1 »', () => {
    expect(formatDayLabel('2026-09-01', reference)).toBe('mardi 1er septembre')
  })

  it('n’ajoute « er » qu’au premier du mois', () => {
    expect(formatDayLabel('2026-09-21', reference)).toBe('lundi 21 septembre')
    expect(formatDayLabel('2026-09-11', reference)).toBe('vendredi 11 septembre')
  })
})
