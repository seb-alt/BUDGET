/**
 * src/domain/patrimony/patrimonySeries.ts
 *
 * LOGIQUE MÉTIER PURE — l'évolution du patrimoine, et la question centrale
 * du §8 : distinguer ce que TU as versé de ce que tes placements ont
 * réellement gagné ou perdu.
 *
 * ---------------------------------------------------------------------------
 * COMMENT ON SÉPARE LES DEUX
 * ---------------------------------------------------------------------------
 * Ton assurance-vie passe de 8 000 € à 8 600 € en un mois. Bonne nouvelle ?
 * Impossible à dire sans savoir ce que tu y as mis. Si tu as versé 500 €, elle
 * a gagné 100 €. Si tu as versé 700 €, elle a PERDU 100 € — et la hausse du
 * solde te l'aurait caché.
 *
 *   variationDuSolde = soldeFin - soldeDebut       (lu dans tes relevés)
 *   versements       = somme des mouvements        (lu dans tes opérations)
 *   performance      = variationDuSolde - versements
 *
 * La performance n'est donc pas estimée : c'est ce que le solde réel montre
 * EN PLUS de ce que tu as mis. Elle n'a de sens que si tu saisis tes soldes
 * de temps en temps — sans relevé, le solde calculé n'est que le cumul de tes
 * versements, et la performance vaut mécaniquement zéro. L'écran le dit.
 */

import type { Cents, IsoDate, IsoMonth, PatrimonySnapshot, Transaction } from '../../db/types'
import { addMonths } from '../../utils/date'
import { computeAccountBalances, movement } from './accountBalance'

/* ------------------------------------------------------------------ */
/* Courbe d'évolution                                                  */
/* ------------------------------------------------------------------ */

export interface PatrimonyPoint {
  month: IsoMonth
  /** Dernier jour du mois, date à laquelle le solde est évalué. */
  date: IsoDate
  total: Cents
  byAccount: Record<string, Cents>
}

/** Le dernier jour d'un mois : '2026-02' -> '2026-02-28'. */
export function lastDayOfMonth(month: IsoMonth): IsoDate {
  const [year, monthNumber] = month.split('-').map(Number)
  // Le jour 0 du mois suivant EST le dernier jour du mois courant, années
  // bissextiles comprises — pas besoin de connaître la longueur des mois.
  const date = new Date(year, monthNumber, 0)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

/** La liste des mois de `from` à `to`, bornes comprises. */
export function monthsBetween(from: IsoMonth, to: IsoMonth): IsoMonth[] {
  const months: IsoMonth[] = []
  let month = from
  // 50 ans de garde-fou : une date aberrante ne doit pas figer l'application.
  for (let step = 0; month <= to && step < 600; step += 1) {
    months.push(month)
    month = addMonths(month, 1)
  }
  return months
}

export function buildPatrimonySeries(
  months: IsoMonth[],
  accountIds: string[],
  transactions: Transaction[],
  snapshots: PatrimonySnapshot[],
): PatrimonyPoint[] {
  return months.map((month) => {
    const date = lastDayOfMonth(month)
    const balances = computeAccountBalances(accountIds, transactions, snapshots, date)

    const byAccount: Record<string, Cents> = {}
    let total = 0
    for (const accountId of accountIds) {
      const balance = balances.get(accountId)?.balance ?? 0
      byAccount[accountId] = balance
      total += balance
    }

    return { month, date, total, byAccount }
  })
}

/* ------------------------------------------------------------------ */
/* Versements et performance                                           */
/* ------------------------------------------------------------------ */

export interface ContributionSplit {
  /** Ce que tu as mis de ta poche sur la période demandée. */
  contributions: Cents
  /** Ce que la valeur a gagné ou perdu en plus de tes versements. */
  performance: Cents
  /** La variation brute du solde sur la période demandée. */
  change: Cents
  /**
   * Date depuis laquelle la performance est réellement constatable.
   * Absente quand aucun relevé ne permet de la calculer.
   */
  performanceSince?: IsoDate
}

/** Somme des mouvements d'un compte sur une période, bornes comprises. */
export function netContributions(
  accountIds: string[],
  transactions: Transaction[],
  from: IsoDate,
  to: IsoDate,
): Cents {
  return transactions
    .filter((transaction) => transaction.date >= from && transaction.date <= to)
    .reduce(
      (total, transaction) =>
        total + accountIds.reduce((sum, accountId) => sum + movement(transaction, accountId), 0),
      0,
    )
}

/**
 * Décompose l'évolution d'un ensemble de comptes entre deux dates.
 * `from` est exclue du solde de départ : on part du solde de la VEILLE, pour
 * que les mouvements du premier jour comptent dans les versements.
 *
 * ---------------------------------------------------------------------------
 * LE PIÈGE : LE CAPITAL QUI PRÉEXISTE
 * ---------------------------------------------------------------------------
 * Ton assurance-vie contient déjà 8 000 € le jour où tu commences à utiliser
 * l'application. Si on calculait la performance depuis le 1er janvier alors
 * que le premier relevé date de septembre, le solde de départ serait pris
 * pour zéro — et ces 8 000 € apparaîtraient comme un GAIN de 8 000 €.
 *
 * La performance ne se constate donc qu'à partir du premier relevé, jamais
 * avant. `performanceSince` dit depuis quand, pour que l'écran l'annonce au
 * lieu de laisser croire qu'elle couvre toute la période.
 *
 * Les VERSEMENTS, eux, sont connus sur toute la période : ils viennent des
 * opérations, pas des soldes.
 */
export function splitContributionAndPerformance(
  accountIds: string[],
  transactions: Transaction[],
  snapshots: PatrimonySnapshot[],
  from: IsoDate,
  to: IsoDate,
): ContributionSplit {
  const sumAt = (date: IsoDate) =>
    [...computeAccountBalances(accountIds, transactions, snapshots, date).values()].reduce(
      (total, balance) => total + balance.balance,
      0,
    )

  const change = sumAt(to) - sumAt(previousDay(from))
  const contributions = netContributions(accountIds, transactions, from, to)

  const firstSnapshot = snapshots.map((snapshot) => snapshot.date).sort()[0]
  if (firstSnapshot === undefined || firstSnapshot > to) {
    // Aucun solde constaté sur la période : le solde calculé n'est que le
    // cumul des versements, il n'y a rien de plus à en tirer.
    return { contributions, performance: 0, change }
  }

  // Point de départ fiable : la veille de la période si un relevé la couvre
  // déjà, sinon le premier relevé lui-même.
  const eve = previousDay(from)
  const anchored = eve >= firstSnapshot
  const baseline = anchored ? eve : firstSnapshot
  // Les opérations du JOUR d'un relevé sont déjà comprises dans son solde.
  const contributionsFrom = anchored ? from : dayAfter(firstSnapshot)

  const performance =
    sumAt(to) - sumAt(baseline) - netContributions(accountIds, transactions, contributionsFrom, to)

  return { contributions, performance, change, performanceSince: contributionsFrom }
}

function previousDay(date: IsoDate): IsoDate {
  return shiftDay(date, -1)
}

function dayAfter(date: IsoDate): IsoDate {
  return shiftDay(date, 1)
}

function shiftDay(date: IsoDate, delta: number): IsoDate {
  const [year, month, day] = date.split('-').map(Number)
  const shifted = new Date(year, month - 1, day + delta)
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}-${String(
    shifted.getDate(),
  ).padStart(2, '0')}`
}

/* ------------------------------------------------------------------ */
/* Bilan par année                                                     */
/* ------------------------------------------------------------------ */

export interface YearSummary {
  year: number
  contributions: Cents
  performance: Cents
}

/**
 * Un bilan par année.
 *
 * Les deux séries ne portent volontairement pas sur les mêmes comptes :
 *  - les VERSEMENTS, sur tes poches d'épargne — c'est ton effort d'épargne ;
 *  - la PERFORMANCE, sur tes seuls placements — un livret ne « performe »
 *    pas au sens où on l'entend ici.
 *
 * Sans cette distinction, un virement du compte courant vers le LEP
 * s'annulerait avec lui-même dès qu'on prend les deux comptes ensemble, et
 * l'effort d'épargne afficherait zéro.
 */
export function buildYearlySummaries(
  years: number[],
  contributionAccountIds: string[],
  performanceAccountIds: string[],
  transactions: Transaction[],
  snapshots: PatrimonySnapshot[],
): YearSummary[] {
  return years.map((year) => ({
    year,
    contributions: netContributions(
      contributionAccountIds,
      transactions,
      `${year}-01-01`,
      `${year}-12-31`,
    ),
    performance: splitContributionAndPerformance(
      performanceAccountIds,
      transactions,
      snapshots,
      `${year}-01-01`,
      `${year}-12-31`,
    ).performance,
  }))
}
