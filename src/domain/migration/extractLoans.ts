/**
 * src/domain/migration/extractLoans.ts
 *
 * Sortir le prêt des réglages pour en faire une vraie ligne de table.
 *
 * Au départ, les réglages contenaient un champ `studentLoan` : UN prêt, sans
 * nom, qu'on ne pouvait ni ajouter ni supprimer. Une dette n'est pas un
 * réglage — on en contracte, on en solde, on en a parfois plusieurs.
 *
 * Comme pour le renommage des identifiants, la conversion vit ici, pure et
 * testée, parce qu'elle sert à DEUX endroits : la migration de la base, et la
 * restauration d'une sauvegarde ancienne — qui n'écrit que des lignes et ne
 * rejoue aucune migration.
 */

import type { Cents, IsoDate, Loan } from '../../db/types'

/** La forme qu'avait le prêt dans les réglages, avant la version 6. */
export interface LegacyStudentLoan {
  initialAmount: Cents
  monthlyPayment: Cents
  remainingCapital: Cents
  lastUpdated: IsoDate
}

export const LEGACY_LOAN_ID = 'loan-etudiant'

/**
 * Le prêt hérité, converti — ou rien du tout.
 *
 * Un prêt entièrement à zéro n'est pas un prêt : c'est un champ qu'on n'a
 * jamais rempli. Le convertir créerait une ligne vide que l'utilisateur
 * devrait supprimer lui-même, sans comprendre d'où elle sort.
 */
export function loanFromLegacy(
  legacy: LegacyStudentLoan | undefined,
  now: string,
): Loan | undefined {
  if (legacy === undefined) return undefined

  const { initialAmount = 0, monthlyPayment = 0, remainingCapital = 0 } = legacy
  if (initialAmount === 0 && monthlyPayment === 0 && remainingCapital === 0) return undefined

  return {
    id: LEGACY_LOAN_ID,
    name: 'Prêt étudiant',
    initialAmount,
    monthlyPayment,
    remainingCapital,
    lastUpdated: legacy.lastUpdated ?? now.slice(0, 10),
    order: 1,
    createdAt: now,
    updatedAt: now,
  }
}

/** Les réglages, débarrassés du champ devenu inutile. */
export function settingsWithoutLoan<T extends object>(settings: T): T {
  const { studentLoan: _removed, ...rest } = settings as T & { studentLoan?: unknown }
  return rest as T
}

/**
 * Le contenu d'une sauvegarde d'avant la version 6, mis au format d'aujourd'hui.
 *
 * Si la sauvegarde porte déjà des prêts, on n'y touche pas : elle vient d'une
 * version plus récente que le champ hérité, et écraser serait pire que ne rien
 * faire.
 */
export function extractLoansInBackupData(
  data: Record<string, unknown[]>,
  now: string,
): Record<string, unknown[]> {
  const settingsRows = data.settings ?? []
  const existing = data.loans ?? []

  const converted = settingsRows
    .map((row) => loanFromLegacy((row as { studentLoan?: LegacyStudentLoan }).studentLoan, now))
    .filter((loan): loan is Loan => loan !== undefined)

  return {
    ...data,
    settings: settingsRows.map((row) => settingsWithoutLoan(row as object)),
    loans: existing.length > 0 ? existing : converted,
  }
}
