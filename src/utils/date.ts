/**
 * src/utils/date.ts
 *
 * Manipulation des dates de l'application.
 *
 * Toutes les dates sont des chaînes 'AAAA-MM-JJ' et tous les mois des chaînes
 * 'AAAA-MM'. Deux avantages : elles se trient comme du texte ordinaire, et on
 * évite le piège classique des fuseaux horaires (`new Date('2026-09-01')` est
 * interprété en heure UTC et peut retomber sur le 31 août en France).
 * Ici on lit toujours l'heure LOCALE, donc « aujourd'hui » est bien ton
 * aujourd'hui.
 */

import type { IsoDate, IsoMonth } from '../db/types'

/** Convertit un objet Date en 'AAAA-MM-JJ', en heure locale. */
function toIsoDate(date: Date): IsoDate {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** La date du jour, en heure locale. */
export function today(): IsoDate {
  return toIsoDate(new Date())
}

/** Le mois en cours, ex. '2026-09'. */
export function currentMonth(): IsoMonth {
  return today().slice(0, 7)
}

/** '2026-09-16' -> '2026-09'. */
export function monthOf(date: IsoDate): IsoMonth {
  return date.slice(0, 7)
}

/** Décale un mois. addMonths('2026-12', 1) -> '2027-01'. */
export function addMonths(month: IsoMonth, delta: number): IsoMonth {
  const [year, monthNumber] = month.split('-').map(Number)
  // On passe par un index 0-11 pour que JavaScript gère le passage d'année.
  const shifted = new Date(year, monthNumber - 1 + delta, 1)
  return toIsoDate(shifted).slice(0, 7)
}

/** '2026-09' -> 'SEPTEMBRE 2026', pour l'en-tête du Dashboard. */
export function formatMonthLabel(month: IsoMonth): string {
  const [year, monthNumber] = month.split('-').map(Number)
  const label = new Date(year, monthNumber - 1, 1).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  })
  return label.toUpperCase()
}

/** '2026-09-16' -> 'Aujourd'hui', 'Hier', ou 'mardi 16 septembre'. */
export function formatDayLabel(date: IsoDate, reference: IsoDate = today()): string {
  if (date === reference) return "Aujourd'hui"

  const [year, month, day] = reference.split('-').map(Number)
  const yesterday = toIsoDate(new Date(year, month - 1, day - 1))
  if (date === yesterday) return 'Hier'

  const [y, m, d] = date.split('-').map(Number)
  const label = new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  // Typographie française : on dit « 1er septembre », pas « 1 septembre ».
  // Seul le premier du mois est concerné (jamais « 2nd » ni « 21er »).
  return d === 1 ? label.replace(/\b1\b/, '1er') : label
}
