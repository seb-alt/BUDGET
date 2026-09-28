/**
 * src/domain/budget/monthlyBudget.ts
 *
 * LOGIQUE MÉTIER PURE — le gel des budgets mensuels (cahier des charges §11).
 *
 * ---------------------------------------------------------------------------
 * LE PROBLÈME
 * ---------------------------------------------------------------------------
 * Si tu changes ton budget Shopping de 200 € à 250 € en 2027, les statistiques
 * de septembre 2026 ne doivent PAS se recalculer avec 250 €. Un mois passé est
 * un fait historique : il ne bouge plus.
 *
 * ---------------------------------------------------------------------------
 * LA RÈGLE RETENUE : GEL À LA FIN DU MOIS
 * ---------------------------------------------------------------------------
 * Le mois EN COURS suit tes réglages en permanence : si tu ajustes ton budget
 * le 15, le mois en cours en tient compte immédiatement. Une copie de ce budget
 * est tenue à jour dans la table `monthlyBudgets`.
 *
 * Dès que le mois est révolu, cette copie cesse d'être mise à jour. Elle
 * devient la photo définitive du budget tel qu'il était à la fin du mois.
 * Rien à cliquer, rien à clôturer : le simple passage du temps fige.
 *
 * ---------------------------------------------------------------------------
 * LA LIMITE, ASSUMÉE
 * ---------------------------------------------------------------------------
 * Si l'application n'est pas ouverte pendant tout un mois, aucune copie n'a pu
 * être prise pendant ce mois-là. Au prochain lancement on la crée quand même,
 * à partir du budget courant : c'est la meilleure information disponible, et
 * c'est toujours mieux que de laisser ce mois dériver à chaque futur
 * changement de budget. En usage normal — l'app ouverte au moins une fois dans
 * le mois — la photo est exacte.
 */

import type { BudgetLine, IsoMonth, MonthlyBudget, Settings } from '../../db/types'
import { addMonths } from '../../utils/date'

/** Garde-fou : 100 ans de mois, pour qu'une date aberrante ne boucle jamais. */
const MAX_MONTHS = 1200

/**
 * Quels mois révolus n'ont pas encore de budget figé ?
 *
 * On balaie du premier mois d'activité jusqu'au mois en cours (exclu) : le mois
 * en cours n'est jamais « à figer », il est simplement tenu à jour.
 */
export function monthsToFreeze(
  firstMonth: IsoMonth,
  currentMonth: IsoMonth,
  alreadyFrozen: IsoMonth[],
): IsoMonth[] {
  const frozen = new Set(alreadyFrozen)
  const missing: IsoMonth[] = []

  let month = firstMonth
  for (let step = 0; month < currentMonth && step < MAX_MONTHS; step += 1) {
    if (!frozen.has(month)) missing.push(month)
    month = addMonths(month, 1)
  }

  return missing
}

/**
 * La photo d'un budget : les montants par sous-catégorie, plus les réglages qui
 * influencent les calculs de ce mois-là.
 *
 * Le seuil LEP et le versement assurance-vie sont recopiés eux aussi : ils
 * pilotent la répartition de l'épargne, donc les chiffres du mois changeraient
 * si on allait les relire dans les réglages actuels.
 */
export function buildBudgetSnapshot(
  month: IsoMonth,
  settings: Settings,
  timestamp: string,
): MonthlyBudget {
  return {
    id: month,
    month,
    // Copie du tableau, pas une référence partagée : une modification ultérieure
    // des réglages ne doit surtout pas se propager dans la photo.
    lines: settings.budgetTemplate.map((line): BudgetLine => ({ ...line })),
    referenceIncome: settings.referenceIncome,
    lepThreshold: settings.lepThreshold,
    assuranceVieMonthly: settings.assuranceVieMonthly,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

/** Un mois est figé dès qu'il est révolu ET qu'une photo existe. */
export function isMonthFrozen(
  month: IsoMonth,
  currentMonth: IsoMonth,
  hasSnapshot: boolean,
): boolean {
  return hasSnapshot && month < currentMonth
}
