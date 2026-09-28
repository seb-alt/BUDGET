/**
 * src/db/budgets.ts
 *
 * Quel budget s'applique à un mois donné, et comment les mois passés sont figés.
 *
 * La règle elle-même vit dans `domain/budget/monthlyBudget.ts`, sans base de
 * données ni React, pour être testable. Ce fichier ne fait que l'appliquer aux
 * tables.
 *
 * Règle retenue (§11) : le mois EN COURS suit tes réglages en permanence ; dès
 * qu'il est révolu, sa copie cesse d'être mise à jour et devient définitive.
 */

import {
  buildBudgetSnapshot,
  isMonthFrozen,
  monthsToFreeze,
} from '../domain/budget/monthlyBudget'
import { currentMonth } from '../utils/date'
import { db } from './db'
import type { BudgetLine, IsoMonth } from './types'

export interface ResolvedBudget {
  lines: BudgetLine[]
  /** Vrai si ce mois est révolu et que ses chiffres ne bougeront plus. */
  frozen: boolean
}

/**
 * Le budget à utiliser pour afficher un mois.
 * On lit d'abord la photo ; à défaut seulement, le budget courant.
 */
export async function resolveMonthBudget(month: IsoMonth): Promise<ResolvedBudget> {
  const snapshot = await db.monthlyBudgets.get(month)
  if (snapshot !== undefined) {
    return { lines: snapshot.lines, frozen: isMonthFrozen(month, currentMonth(), true) }
  }

  const settings = await db.settings.get(1)
  return { lines: settings?.budgetTemplate ?? [], frozen: false }
}

export interface SyncReport {
  /** Le mois en cours, dont la copie vient d'être rafraîchie. */
  refreshed?: IsoMonth
  /** Les mois révolus qui viennent d'être figés. */
  frozen: IsoMonth[]
}

/**
 * À appeler au démarrage, et après toute modification du budget dans les
 * paramètres.
 *
 *  1. rafraîchit la copie du mois en cours à partir des réglages ;
 *  2. fige les mois révolus qui n'ont pas encore de copie.
 *
 * Sans effet si rien n'a changé : on peut l'appeler à chaque lancement.
 */
export async function syncMonthlyBudgets(): Promise<SyncReport> {
  const settings = await db.settings.get(1)
  if (settings === undefined) return { frozen: [] }

  const month = currentMonth()
  const timestamp = new Date().toISOString()

  return db.transaction('rw', [db.monthlyBudgets, db.transactions], async () => {
    // 1. Le mois en cours suit les réglages. On conserve sa date de création
    //    d'origine : seule `updatedAt` bouge tant que le mois est en cours.
    const existing = await db.monthlyBudgets.get(month)
    const snapshot = buildBudgetSnapshot(month, settings, timestamp)
    await db.monthlyBudgets.put({ ...snapshot, createdAt: existing?.createdAt ?? timestamp })

    // 2. Les mois révolus depuis la première opération enregistrée. On part de
    //    la plus ancienne opération plutôt que de tout relire : la table
    //    `transactions` est indexée sur `date`, donc c'est une seule lecture.
    const earliest = await db.transactions.orderBy('date').first()
    if (earliest === undefined) return { refreshed: month, frozen: [] }

    const alreadyFrozen = await db.monthlyBudgets.toCollection().primaryKeys()
    const missing = monthsToFreeze(earliest.date.slice(0, 7), month, alreadyFrozen)

    for (const pastMonth of missing) {
      await db.monthlyBudgets.add(buildBudgetSnapshot(pastMonth, settings, timestamp))
    }

    return { refreshed: month, frozen: missing }
  })
}
