/**
 * src/features/dashboard/groups.ts
 *
 * La définition des trois cartes budgétaires, partagée par le Dashboard et
 * par les deux graphiques.
 *
 * Un seul endroit décide qu'« épargne » s'affiche en orange : du coup la
 * couleur d'un groupe est la même dans la carte, dans le graphique en barres
 * et dans le camembert. C'est ce qui permet de relier les trois d'un regard.
 */

import type { CategoryGroup } from '../../db/types'

export interface BudgetGroupDefinition {
  group: Extract<CategoryGroup, 'chargesFixes' | 'epargne' | 'loisirs'>
  title: string
  /** Mot qui accompagne le montant restant : « 325 € disponibles ». */
  remainingWord: string
  /** Variable CSS, pas une couleur en dur : le mode sombre s'adapte tout seul. */
  color: string
}

export const BUDGET_GROUPS: BudgetGroupDefinition[] = [
  {
    group: 'chargesFixes',
    title: 'Charges fixes',
    remainingWord: 'restants à payer',
    color: 'var(--chart-1)',
  },
  {
    group: 'epargne',
    title: 'Épargne & investissement',
    remainingWord: 'restants à verser',
    color: 'var(--chart-2)',
  },
  {
    group: 'loisirs',
    title: 'Loisirs',
    remainingWord: 'disponibles',
    color: 'var(--chart-3)',
  },
]
