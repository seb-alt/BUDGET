/**
 * src/domain/settings/settingsRules.ts
 *
 * LOGIQUE MÉTIER PURE — les règles de l'écran Paramètres.
 *
 * L'essentiel tient en une question : que se passe-t-il quand tu modifies une
 * chose déjà utilisée ailleurs ? Supprimer la catégorie « Shopping » alors que
 * douze opérations y sont rattachées les laisserait orphelines, affichées
 * « Sans catégorie » pour toujours. On l'interdit, et on propose de désactiver
 * à la place.
 */

import type { Transaction } from '../../db/types'

/* ------------------------------------------------------------------ */
/* Ordre d'affichage                                                   */
/* ------------------------------------------------------------------ */

export interface Ordered {
  id: string
  order: number
}

/**
 * Déplace un élément d'un cran et renumérote toute la liste de 1 à n.
 *
 * La renumérotation systématique évite les trous et les doublons qui
 * s'accumulent après plusieurs déplacements, et rend l'ordre lisible en base.
 * Un déplacement impossible (déjà en haut, déjà en bas) renvoie simplement la
 * liste remise au propre.
 */
export function moveInOrder<T extends Ordered>(items: T[], id: string, direction: -1 | 1): T[] {
  const sorted = [...items].sort((a, b) => a.order - b.order)
  const index = sorted.findIndex((item) => item.id === id)
  const target = index + direction

  if (index !== -1 && target >= 0 && target < sorted.length) {
    const moved = sorted[index]
    sorted[index] = sorted[target]
    sorted[target] = moved
  }

  return sorted.map((item, position) => ({ ...item, order: position + 1 }))
}

/* ------------------------------------------------------------------ */
/* Suppressions protégées                                              */
/* ------------------------------------------------------------------ */

/** Combien d'opérations utilisent cette catégorie ? */
export function countCategoryUses(categoryId: string, transactions: Transaction[]): number {
  return transactions.filter((transaction) => transaction.categoryId === categoryId).length
}

/**
 * Combien d'opérations touchent ce compte ?
 * Un transfert compte pour son compte de départ comme pour celui d'arrivée.
 */
export function countAccountUses(accountId: string, transactions: Transaction[]): number {
  return transactions.filter(
    (transaction) =>
      transaction.accountId === accountId ||
      transaction.fromAccountId === accountId ||
      transaction.toAccountId === accountId,
  ).length
}

/* ------------------------------------------------------------------ */
/* Pourcentages                                                        */
/* ------------------------------------------------------------------ */

/**
 * '25,6' -> 0.256. Le taux est stocké en fraction, affiché en pourcentage.
 *
 * On passe par les CHIFFRES plutôt que par un nombre à virgule, pour la même
 * raison que les montants : la conversion doit être exacte.
 * Renvoie `null` hors de l'intervalle 0–100 % ou si la saisie n'est pas un nombre.
 */
export function parsePercent(raw: string): number | null {
  const normalised = raw.replace(/\s/g, '').replace('%', '').replace(',', '.')
  const match = /^(\d*)(?:\.(\d*))?$/.exec(normalised)
  if (match === null) return null

  const [, wholePart = '', fractionPart = ''] = match
  if (wholePart === '' && fractionPart === '') return null

  // Deux décimales de pourcentage : 25,60 % devient 2560 centièmes de pourcent.
  const hundredths = Number(wholePart || '0') * 100 + Number(fractionPart.slice(0, 2).padEnd(2, '0'))
  if (hundredths > 10000) return null

  return hundredths / 10000
}

/** 0.256 -> '25,6'. Les zéros inutiles sont retirés. */
export function formatPercent(rate: number): string {
  return (Math.round(rate * 10000) / 100).toString().replace('.', ',')
}
