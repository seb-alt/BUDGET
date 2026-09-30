/**
 * src/domain/budget/budgetEngine.ts
 *
 * LOGIQUE MÉTIER PURE — la règle de l'enveloppe flexible (cahier des charges §4).
 *
 * ---------------------------------------------------------------------------
 * L'IDÉE
 * ---------------------------------------------------------------------------
 * Tes revenus varient d'un mois à l'autre, mais tes charges fixes, tes loisirs
 * et ton versement assurance-vie, eux, ne bougent pas. Ce serait absurde de
 * rogner sur les courses parce qu'un mois est plus creux.
 *
 * C'est donc l'enveloppe LEP/PEA qui absorbe la variation : elle est la seule
 * variable d'ajustement.
 *
 *   budgetIncompressible = chargesFixes + loisirs + assuranceVie
 *   epargneFlexible      = max(0 ; revenusReels - budgetIncompressible)
 *
 * Avec 800 + 350 + 500 = 1 650 € d'incompressible :
 *   2 000 € de revenus -> 350 € de flexible
 *   1 900 €            -> 250 €
 *   1 800 €            -> 150 €
 *   2 200 €            -> 550 €
 *
 * ---------------------------------------------------------------------------
 * CE QUE LE MOTEUR NE FAIT JAMAIS
 * ---------------------------------------------------------------------------
 * Si les revenus tombent sous l'incompressible, l'épargne flexible tombe à
 * zéro et l'application signale un déficit. Elle ne réduit JAMAIS d'elle-même
 * tes charges fixes, tes loisirs ou ton assurance-vie : c'est à toi de décider
 * quoi couper, pas à un calcul.
 */

import type { BudgetLine, CategoryGroup, Cents, Category } from '../../db/types'

export interface FlexibleSavingsInput {
  /** Revenus personnels RÉELLEMENT encaissés ce mois-ci (hors micro-entreprise). */
  actualIncome: Cents
  /** Budget des charges fixes. */
  fixedCharges: Cents
  /** Budget des loisirs. */
  leisure: Cents
  /** Versement mensuel vers l'assurance-vie. */
  assuranceVie: Cents
}

export interface FlexibleSavingsResult {
  /** Ce qui ne se négocie pas : charges fixes + loisirs + assurance-vie. */
  incompressible: Cents
  /** Ce qui reste pour l'enveloppe LEP / PEA. Jamais négatif. */
  flexible: Cents
  /**
   * Ce qui manque pour couvrir l'incompressible. Vaut 0 quand tout va bien.
   * C'est un chiffre à AFFICHER, pas une consigne : l'app ne coupe rien seule.
   */
  deficit: Cents
}

export function computeFlexibleSavings(input: FlexibleSavingsInput): FlexibleSavingsResult {
  const incompressible = input.fixedCharges + input.leisure + input.assuranceVie
  const remaining = input.actualIncome - incompressible

  return {
    incompressible,
    flexible: Math.max(0, remaining),
    deficit: Math.max(0, -remaining),
  }
}

/* ------------------------------------------------------------------------ */
/* Application de la règle au budget du mois                                 */
/* ------------------------------------------------------------------------ */

/**
 * Remplace le montant de l'enveloppe flexible dans le budget du mois par
 * celui que la règle vient de calculer.
 *
 * Sans ça, l'application se contredirait : la carte Épargne afficherait la
 * ligne fixe du budget (350 €) pendant que le moteur annoncerait autre chose.
 * C'est bien le budget affiché qui doit suivre les revenus réels — c'est tout
 * l'intérêt de la règle.
 *
 * Les charges fixes et les loisirs sont lus depuis le budget du mois lui-même,
 * donc un mois passé utilise ses montants figés (§11) et non ceux d'aujourd'hui.
 */
export function applyFlexibleEnvelope(input: {
  budget: BudgetLine[]
  categories: Category[]
  actualIncome: Cents
  flexibleCategoryId: string
  assuranceVieMonthly: Cents
}): { budget: BudgetLine[]; savings: FlexibleSavingsResult } {
  const groupOf = new Map(input.categories.map((category) => [category.id, category.group]))
  const sumOfGroup = (group: CategoryGroup): Cents =>
    input.budget
      .filter((line) => groupOf.get(line.categoryId) === group)
      .reduce((total, line) => total + line.amount, 0)

  const savings = computeFlexibleSavings({
    actualIncome: input.actualIncome,
    fixedCharges: sumOfGroup('chargesFixes'),
    leisure: sumOfGroup('loisirs'),
    assuranceVie: input.assuranceVieMonthly,
  })

  return {
    budget: input.budget.map((line) =>
      line.categoryId === input.flexibleCategoryId ? { ...line, amount: savings.flexible } : line,
    ),
    savings,
  }
}
