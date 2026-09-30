/**
 * src/db/patrimony.ts
 *
 * Enregistrement des relevés de soldes (§8).
 *
 * L'application ne se connecte à aucune banque. C'est toi qui saisis tes
 * soldes de temps en temps ; chaque saisie devient un point daté, qui sert à
 * la fois à recaler les calculs et à tracer les courbes historiques.
 *
 * L'identifiant est la DATE : ressaisir un relevé le même jour corrige celui
 * du jour au lieu d'en empiler un second.
 */

import { db } from './db'
import type { IsoDate, PatrimonySnapshot, SnapshotBalance } from './types'

export interface BalanceSnapshotInput {
  date: IsoDate
  balances: SnapshotBalance[]
  /** Capital restant dû du prêt étudiant à cette date, si tu le connais. */
  loanRemaining?: number
  note?: string
}

export async function saveBalanceSnapshot(input: BalanceSnapshotInput): Promise<void> {
  if (input.balances.length === 0) {
    throw new Error('Saisis au moins un solde.')
  }

  const snapshot: PatrimonySnapshot = {
    id: input.date,
    date: input.date,
    balances: input.balances,
    createdAt: new Date().toISOString(),
  }
  if (input.loanRemaining !== undefined) snapshot.loanRemaining = input.loanRemaining
  if (input.note) snapshot.note = input.note

  await db.patrimonySnapshots.put(snapshot)
}
