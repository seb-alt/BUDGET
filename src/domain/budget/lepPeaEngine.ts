/**
 * src/domain/budget/lepPeaEngine.ts
 *
 * LOGIQUE MÉTIER PURE — la répartition LEP / PEA (cahier des charges §4).
 *
 * ---------------------------------------------------------------------------
 * L'IDÉE
 * ---------------------------------------------------------------------------
 * Le LEP est plafonné et bien rémunéré : tant qu'il n'est pas plein, il passe
 * en premier. Le surplus part sur le PEA.
 *
 *   besoinLEP    = max(0 ; seuilLEP - soldeLEP)
 *   versementLEP = min(epargneFlexible ; besoinLEP)
 *   versementPEA = epargneFlexible - versementLEP
 *
 * Exemple : LEP à 7 850 €, seuil 8 000 €, enveloppe flexible 350 €
 *        -> 150 € vers le LEP, 200 € vers le PEA.
 *
 * Le seuil vient des paramètres, jamais du code : il changera si le plafond
 * réglementaire du LEP évolue.
 */

import type { Cents } from '../../db/types'

export interface LepPeaInput {
  /** Le montant à répartir, issu de computeFlexibleSavings. */
  flexible: Cents
  /** Solde actuel du LEP. */
  lepBalance: Cents
  /** Seuil au-delà duquel le LEP est considéré comme plein (paramétrable). */
  lepThreshold: Cents
}

export interface LepPeaResult {
  toLep: Cents
  toPea: Cents
  /** Ce qu'il manquait au LEP pour atteindre le seuil, AVANT ce versement. */
  lepNeed: Cents
  /** Vrai si le LEP a déjà atteint son seuil : tout part alors sur le PEA. */
  lepFull: boolean
}

export function splitLepPea(input: LepPeaInput): LepPeaResult {
  // Un LEP au-dessus de son seuil donne un besoin négatif : on le ramène à 0,
  // sinon le PEA recevrait plus que l'enveloppe disponible.
  const lepNeed = Math.max(0, input.lepThreshold - input.lepBalance)
  const toLep = Math.min(input.flexible, lepNeed)

  return {
    toLep,
    toPea: input.flexible - toLep,
    lepNeed,
    lepFull: lepNeed === 0,
  }
}
