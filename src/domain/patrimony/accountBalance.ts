/**
 * src/domain/patrimony/accountBalance.ts
 *
 * LOGIQUE MÉTIER PURE — le solde d'un compte.
 *
 * ---------------------------------------------------------------------------
 * COMMENT ON CONNAÎT UN SOLDE SANS CONNEXION BANCAIRE
 * ---------------------------------------------------------------------------
 * L'application ne se connecte à aucune banque (§8). Le solde se reconstitue
 * en deux morceaux :
 *
 *   1. le dernier RELEVÉ MANUEL saisi pour ce compte (« Actualiser mes
 *      soldes »), qui sert de point de départ ;
 *   2. tous les MOUVEMENTS enregistrés depuis cette date.
 *
 * Sans relevé, on part de zéro : le chiffre n'est alors qu'un cumul de tes
 * opérations, pas ton vrai solde. C'est le relevé manuel qui recale l'app.
 *
 * Convention : les opérations datées du JOUR du relevé ne sont pas recomptées.
 * Le solde que tu saisis fait foi pour cette date — c'est ce que tu as lu sur
 * ton compte ce jour-là, mouvements du jour compris.
 */

import type { Cents, IsoDate, PatrimonySnapshot, Transaction } from '../../db/types'

export interface AccountBalance {
  accountId: string
  balance: Cents
  /** Date du relevé manuel servant de point de départ, s'il y en a un. */
  since?: IsoDate
}

/** Effet d'une opération sur un compte donné. Zéro si elle ne le concerne pas. */
export function movement(transaction: Transaction, accountId: string): Cents {
  if (transaction.type === 'transfer') {
    if (transaction.fromAccountId === accountId) return -transaction.amount
    if (transaction.toAccountId === accountId) return transaction.amount
    return 0
  }

  if (transaction.accountId !== accountId) return 0
  return transaction.type === 'income' ? transaction.amount : -transaction.amount
}

export function computeAccountBalances(
  accountIds: string[],
  transactions: Transaction[],
  snapshots: PatrimonySnapshot[],
  /**
   * Solde tel qu'il était à CETTE date (incluse). Sans elle, le solde
   * d'aujourd'hui. C'est ce paramètre qui permet de tracer une courbe
   * d'évolution : on redemande le solde à chaque fin de mois.
   */
  asOf?: IsoDate,
): Map<string, AccountBalance> {
  const relevantSnapshots = (
    asOf === undefined ? snapshots : snapshots.filter((snapshot) => snapshot.date <= asOf)
  ).sort((a, b) => a.date.localeCompare(b.date))

  // Le relevé le plus récent gagne, compte par compte : un relevé peut très
  // bien ne concerner qu'une partie des comptes.
  const startingPoints = new Map<string, { balance: Cents; date: IsoDate }>()
  for (const snapshot of relevantSnapshots) {
    for (const entry of snapshot.balances) {
      startingPoints.set(entry.accountId, { balance: entry.balance, date: snapshot.date })
    }
  }

  const balances = new Map<string, AccountBalance>()
  for (const accountId of accountIds) {
    const start = startingPoints.get(accountId)
    let balance = start?.balance ?? 0

    for (const transaction of transactions) {
      if (asOf !== undefined && transaction.date > asOf) continue
      if (start !== undefined && transaction.date <= start.date) continue
      balance += movement(transaction, accountId)
    }

    balances.set(accountId, { accountId, balance, since: start?.date })
  }

  return balances
}

/** Confort : le solde d'un seul compte. */
export function computeAccountBalance(
  accountId: string,
  transactions: Transaction[],
  snapshots: PatrimonySnapshot[],
  asOf?: IsoDate,
): AccountBalance {
  return (
    computeAccountBalances([accountId], transactions, snapshots, asOf).get(accountId) ?? {
      accountId,
      balance: 0,
    }
  )
}
