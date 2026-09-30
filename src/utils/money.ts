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

/**
 * Comme formatEuros, mais masque les centimes quand ils valent zéro :
 * 2000 -> "20 €", 2450 -> "24,50 €". C'est le format utilisé dans les listes
 * d'opérations, où la plupart des montants sont ronds.
 */
export function formatEurosCompact(cents: Cents): string {
  return formatEuros(cents, { showCents: cents % 100 !== 0 })
}

/**
 * 24.5 -> 2450. Arrondit au centime le plus proche.
 *
 * Le `toPrecision(12)` n'est pas une coquetterie : en binaire, `1.005 * 100`
 * vaut 100.49999999999999, et un simple Math.round renverrait 100 au lieu
 * de 101. On coupe d'abord les décimales parasites, puis on arrondit.
 */
export function toCents(amountInEuros: number): Cents {
  return Math.round(Number((amountInEuros * 100).toPrecision(12)))
}

/** 2450 -> 24.5. À n'utiliser que pour l'affichage, jamais pour calculer. */
export function fromCents(cents: Cents): number {
  return cents / 100
}

/** Somme sûre d'une liste de montants en centimes. */
export function sumCents(values: Cents[]): Cents {
  return values.reduce((total, value) => total + value, 0)
}

/**
 * Traduit ce que tu tapes au clavier en centimes.
 *
 * Accepte la virgule comme le point, les espaces, et tolère un séparateur en
 * fin de frappe ("24," pendant que tu tapes). Renvoie `null` si la saisie ne
 * représente pas un montant utilisable — c'est ce qui désactive le bouton
 * Enregistrer tant que le montant n'est pas valable.
 *
 *   '24,50' -> 2450      '20' -> 2000       '' -> null
 *   '0'     -> null      '24,' -> 2400      '1 234,5' -> 123450
 */
export function parseAmountInput(raw: string): Cents | null {
  const cents = parseDigits(raw)
  // Un montant d'opération est forcément strictement positif : le sens
  // (entrée, sortie) est porté par le TYPE de l'opération, pas par le signe.
  return cents !== null && cents > 0 ? cents : null
}

/**
 * Comme parseAmountInput, mais pour un SOLDE de compte.
 *
 * Deux différences, et elles comptent : un solde peut valoir zéro, et un
 * compte courant peut être à découvert. Refuser le signe moins ici
 * t'empêcherait de saisir la réalité.
 */
export function parseBalanceInput(raw: string): Cents | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null

  const isNegative = trimmed.startsWith('-') || trimmed.startsWith('−')
  const magnitude = parseDigits(isNegative ? trimmed.slice(1) : trimmed)
  if (magnitude === null) return null

  return isNegative ? -magnitude : magnitude
}

/**
 * Le cœur commun : transforme une saisie en centimes, sans jamais construire
 * de nombre à virgule. Renvoie `null` si la saisie n'est pas un nombre.
 */
function parseDigits(raw: string): Cents | null {
  const normalised = raw.replace(/\s/g, '').replace(',', '.')
  const match = /^(\d*)(?:\.(\d*))?$/.exec(normalised)
  if (match === null) return null

  const [, wholePart = '', fractionPart = ''] = match
  if (wholePart === '' && fractionPart === '') return null

  // On assemble les centimes à partir des CHIFFRES : c'est ce qui rend la
  // conversion exacte, là où 1,005 * 100 vaudrait 100,49999999999999.
  const twoDecimals = fractionPart.slice(0, 2).padEnd(2, '0')
  let cents = Number(wholePart || '0') * 100 + Number(twoDecimals)

  // Si tu tapes plus de deux décimales, on arrondit au centime le plus proche.
  if (fractionPart.length > 2 && Number(fractionPart[2]) >= 5) cents += 1

  return cents
}

/**
 * Applique une touche du clavier numérique au montant en cours de saisie.
 *
 * Fonction PURE : elle reçoit le texte actuel et une touche, elle renvoie le
 * nouveau texte. Aucun état, aucun effet — donc testable, et le composant
 * React n'a plus qu'à afficher le résultat.
 *
 * Règles : deux décimales maximum, une seule virgule, 7 chiffres avant la
 * virgule (soit 9 999 999 € — largement au-delà de tout besoin réel).
 */
export function appendAmountKey(current: string, key: string): string {
  if (key === 'backspace') return current.slice(0, -1)
  if (key === 'clear') return ''

  if (key === ',') {
    if (current.includes(',')) return current
    return current === '' ? '0,' : `${current},`
  }

  if (!/^\d$/.test(key)) return current

  const [wholePart, fractionPart] = current.split(',')

  if (fractionPart !== undefined) {
    if (fractionPart.length >= 2) return current
    return `${wholePart},${fractionPart}${key}`
  }

  if (wholePart.length >= 7) return current
  // Évite « 007 » : un zéro seul est remplacé par le chiffre tapé.
  if (wholePart === '0') return key
  return `${wholePart}${key}`
}
