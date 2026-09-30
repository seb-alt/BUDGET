/**
 * src/domain/recurring/recurringEngine.ts
 *
 * LOGIQUE MÉTIER PURE — les opérations récurrentes (§7).
 *
 * ---------------------------------------------------------------------------
 * LA RÈGLE ABSOLUE : NE JAMAIS CRÉER DE DOUBLON
 * ---------------------------------------------------------------------------
 * Un moteur de récurrence qui se trompe crée un loyer en double. Pire : il le
 * refait à chaque ouverture de l'application, et tu t'en aperçois des semaines
 * plus tard en voyant ton budget partir en vrille.
 *
 * La protection ne repose donc PAS sur un compteur « dernière exécution », qui
 * peut se désynchroniser (restauration d'une sauvegarde, opération supprimée à
 * la main, horloge décalée). Elle repose sur un fait vérifiable : une
 * opération déjà enregistrée porte l'identifiant de sa règle ET sa date. Si ce
 * couple existe déjà, l'échéance est passée, point final.
 *
 * ---------------------------------------------------------------------------
 * LE 31 FÉVRIER N'EXISTE PAS
 * ---------------------------------------------------------------------------
 * Une règle « le 31 de chaque mois » n'a pas d'échéance en février. Plutôt que
 * de la sauter — ce qui ferait disparaître un loyer un mois sur deux — on la
 * ramène au dernier jour du mois. C'est ce que font les banques.
 */

import type { IsoDate, RecurringRule } from '../../db/types'

/** Garde-fou : au-delà, une date de début aberrante boucle sans fin. */
const MAX_OCCURRENCES = 600

/** Le dernier jour d'un mois donné, années bissextiles comprises. */
function lastDayOf(year: number, month: number): number {
  // Le jour 0 du mois suivant EST le dernier jour du mois courant.
  return new Date(year, month, 0).getDate()
}

function format(year: number, month: number, day: number): IsoDate {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Le jour demandé, ramené au dernier jour du mois s'il n'existe pas. */
export function clampDayOfMonth(year: number, month: number, day: number): IsoDate {
  return format(year, month, Math.min(day, lastDayOf(year, month)))
}

/**
 * Toutes les échéances d'une règle, de son début jusqu'à `until` incluse.
 * Une règle inactive n'en produit aucune.
 */
export function occurrenceDates(rule: RecurringRule, until: IsoDate): IsoDate[] {
  if (!rule.active) return []

  const end = rule.endDate !== undefined && rule.endDate < until ? rule.endDate : until
  if (rule.startDate > end) return []

  const [startYear, startMonth, startDay] = rule.startDate.split('-').map(Number)
  const dates: IsoDate[] = []

  if (rule.frequency === 'weekly') {
    // Tous les 7 jours à partir du début : le jour de la semaine est celui de
    // la date de début, il n'y a rien à paramétrer.
    const cursor = new Date(startYear, startMonth - 1, startDay)
    for (let step = 0; step < MAX_OCCURRENCES; step += 1) {
      const date = format(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate())
      if (date > end) break
      dates.push(date)
      cursor.setDate(cursor.getDate() + 7)
    }
    return dates
  }

  const stepMonths = rule.frequency === 'yearly' ? 12 : 1
  for (let step = 0; step < MAX_OCCURRENCES; step += 1) {
    const cursor = new Date(startYear, startMonth - 1 + step * stepMonths, 1)
    const date = clampDayOfMonth(cursor.getFullYear(), cursor.getMonth() + 1, rule.dayOfMonth)

    if (date > end) break
    // La première échéance peut tomber avant le début si le jour du mois est
    // antérieur : on l'écarte sans arrêter la boucle.
    if (date >= rule.startDate) dates.push(date)
  }

  return dates
}

export interface PendingOccurrence {
  rule: RecurringRule
  date: IsoDate
}

/** Une opération déjà enregistrée, vue du moteur : sa règle et sa date. */
export interface MaterialisedOccurrence {
  recurringRuleId?: string
  date: IsoDate
}

/**
 * Les échéances qui DEVRAIENT exister et qui n'existent pas encore.
 *
 * C'est la seule fonction que l'application appelle : le mode de la règle
 * (automatique ou à confirmer) décide ensuite de ce qu'on en fait, mais le
 * calcul est le même.
 */
export function pendingOccurrences(
  rules: RecurringRule[],
  existing: MaterialisedOccurrence[],
  today: IsoDate,
): PendingOccurrence[] {
  // Un index « règle + date » : c'est lui qui garantit l'absence de doublon.
  const done = new Set(
    existing
      .filter((transaction) => transaction.recurringRuleId !== undefined)
      .map((transaction) => `${transaction.recurringRuleId}|${transaction.date}`),
  )

  const pending: PendingOccurrence[] = []
  for (const rule of rules) {
    const skipped = new Set(rule.skippedDates ?? [])
    for (const date of occurrenceDates(rule, today)) {
      if (done.has(`${rule.id}|${date}`) || skipped.has(date)) continue
      pending.push({ rule, date })
    }
  }

  return pending.sort(
    (a, b) => a.date.localeCompare(b.date) || a.rule.name.localeCompare(b.rule.name),
  )
}

/** Découpe les échéances en attente selon ce que l'application doit en faire. */
export function splitByMode(pending: PendingOccurrence[]): {
  automatic: PendingOccurrence[]
  toConfirm: PendingOccurrence[]
} {
  return {
    automatic: pending.filter((occurrence) => occurrence.rule.mode === 'auto'),
    toConfirm: pending.filter((occurrence) => occurrence.rule.mode === 'confirm'),
  }
}
