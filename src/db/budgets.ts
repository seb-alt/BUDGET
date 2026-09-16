/**
 * src/db/budgets.ts
 *
 * Quel budget s'applique à un mois donné ?
 *
 * Règle du cahier des charges §11 : les statistiques d'un mois passé ne
 * doivent jamais changer rétroactivement. On lit donc d'abord la table
 * `monthlyBudgets`, qui contient des copies FIGÉES ; à défaut seulement, on
 * prend le budget courant des paramètres.
 *
 * À DÉCIDER ENSEMBLE : le moment exact où un mois se fige (à sa première
 * opération ? à sa clôture ? sur commande ?). Tant que ce n'est pas tranché,
 * rien ne se fige : tous les mois utilisent le budget courant, et le jour où
 * on écrira des lignes dans `monthlyBudgets`, cette fonction les utilisera
 * sans qu'on touche au Dashboard.
 */

import { db } from './db'
import type { BudgetLine, IsoMonth } from './types'

export async function resolveBudgetForMonth(month: IsoMonth): Promise<BudgetLine[]> {
  const frozen = await db.monthlyBudgets.get(month)
  if (frozen !== undefined) return frozen.lines

  const settings = await db.settings.get(1)
  return settings?.budgetTemplate ?? []
}
