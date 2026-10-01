/**
 * src/domain/budget/budgetEngine.ts
 *
 * LOGIQUE MÉTIER PURE — ce que le budget laisse sur le compte.
 *
 * ---------------------------------------------------------------------------
 * CE QUI A CHANGÉ, ET POURQUOI
 * ---------------------------------------------------------------------------
 * Ce fichier calculait d'abord une « enveloppe flexible » : tout ce qui
 * dépassait les charges fixes, les loisirs et l'assurance-vie était d'office
 * affecté au LEP/PEA, et le montant saisi dans le budget pour cette ligne était
 * ignoré au profit du calcul.
 *
 * Deux défauts à l'usage :
 *
 *  1. Écrire 350 € dans son budget et en voir 550 € affichés est déroutant.
 *     Un budget qu'on ne peut pas fixer n'est plus vraiment un budget.
 *
 *  2. Le modèle supposait que TOUT le surplus devait être épargné. En pratique,
 *     on garde volontiers un matelas sur le compte courant — et ce matelas
 *     n'apparaissait nulle part, puisqu'il était compté comme de l'épargne à
 *     venir.
 *
 * Désormais l'enveloppe LEP/PEA est une ligne de budget comme une autre, et
 * c'est le SURPLUS qui devient un chiffre affiché :
 *
 *   budgété       = charges fixes + épargne + loisirs
 *   non affecté   = max(0 ; revenus réels − budgété)
 *   déficit       = max(0 ; budgété − revenus réels)
 *
 * Avec 800 + 850 + 350 = 2 000 € budgétés :
 *   2 000 € de revenus -> 0 € non affecté
 *   2 200 €            -> 200 € non affecté
 *   1 800 €            -> 200 € de déficit
 *
 * ---------------------------------------------------------------------------
 * CE QUE LE MOTEUR NE FAIT JAMAIS
 * ---------------------------------------------------------------------------
 * Il ne déplace pas un centime. Aucune ligne de cette application ne crée de
 * virement de sa propre initiative : l'épargne n'est comptée que lorsqu'un
 * virement est ENREGISTRÉ. Et en cas de déficit, le moteur signale le manque
 * sans jamais rogner lui-même sur une enveloppe : c'est à toi de décider quoi
 * couper, pas à un calcul.
 */

import type { BudgetLine, CategoryGroup, Cents, Category } from '../../db/types'

export interface MonthBalanceInput {
  /** Revenus personnels RÉELLEMENT encaissés ce mois-ci (hors micro-entreprise). */
  actualIncome: Cents
  /** Budget du mois, toutes lignes confondues. */
  budget: BudgetLine[]
  /** Sert à rattacher chaque ligne du budget à son groupe. */
  categories: Category[]
}

export interface MonthBalanceResult {
  /** Ce que le budget prévoit : charges fixes + épargne + loisirs. */
  budgeted: Cents
  /**
   * Ce que les revenus laissent au-delà du budget — le matelas qui reste sur
   * le compte courant. Jamais négatif.
   */
  unallocated: Cents
  /**
   * Ce qui manque pour couvrir le budget. Vaut 0 quand tout va bien.
   * C'est un chiffre à AFFICHER, pas une consigne : l'app ne coupe rien seule.
   */
  deficit: Cents
}

/** Les trois groupes qui composent le budget mensuel. Les autres n'en sont pas. */
const BUDGETED_GROUPS: CategoryGroup[] = ['chargesFixes', 'epargne', 'loisirs']

export function computeMonthBalance(input: MonthBalanceInput): MonthBalanceResult {
  const groupOf = new Map(input.categories.map((category) => [category.id, category.group]))

  const budgeted = input.budget
    .filter((line) => {
      const group = groupOf.get(line.categoryId)
      return group !== undefined && BUDGETED_GROUPS.includes(group)
    })
    .reduce((total, line) => total + line.amount, 0)

  const remaining = input.actualIncome - budgeted

  return {
    budgeted,
    unallocated: Math.max(0, remaining),
    deficit: Math.max(0, -remaining),
  }
}

/**
 * Le montant budgété pour l'enveloppe répartie entre LEP et PEA.
 *
 * C'est lui que `splitLepPea` répartit ensuite. Zéro si la ligne n'existe pas :
 * l'enveloppe a pu être renommée, vidée, ou ne pas encore avoir de budget.
 */
export function plannedEnvelope(budget: BudgetLine[], envelopeCategoryId: string): Cents {
  return budget.find((line) => line.categoryId === envelopeCategoryId)?.amount ?? 0
}
