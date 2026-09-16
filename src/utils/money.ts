/**
 * src/utils/money.ts
 *
 * Passage entre les centimes stockés en base et les euros affichés à l'écran.
 * Tout l'affichage monétaire de l'application passe par ici : si un jour tu
 * veux changer le format, il n'y a qu'un seul endroit à modifier.
 */

import type { Cents } from '../db/types'

const EUROS_WITH_CENTS = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
})

const EUROS_ROUNDED = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

/** 2450 -> "24,50 €".  Avec showCents: false -> "25 €". */
export function formatEuros(cents: Cents, options?: { showCents?: boolean }): string {
  const formatter = options?.showCents === false ? EUROS_ROUNDED : EUROS_WITH_CENTS
  return formatter.format(cents / 100)
}

/** 24.5 -> 2450. Arrondit au centime le plus proche. */
export function toCents(amountInEuros: number): Cents {
  return Math.round(amountInEuros * 100)
}

/** 2450 -> 24.5. À n'utiliser que pour l'affichage, jamais pour calculer. */
export function fromCents(cents: Cents): number {
  return cents / 100
}

/** Somme sûre d'une liste de montants en centimes. */
export function sumCents(values: Cents[]): Cents {
  return values.reduce((total, value) => total + value, 0)
}
