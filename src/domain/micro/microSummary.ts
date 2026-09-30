/**
 * src/domain/micro/microSummary.ts
 *
 * LOGIQUE MÉTIER PURE — les indicateurs de la micro-entreprise (§9).
 *
 * ---------------------------------------------------------------------------
 * L'URSSAF SE CALCULE SUR CE QUI EST ENCAISSÉ
 * ---------------------------------------------------------------------------
 * En micro-entreprise, les cotisations portent sur le chiffre d'affaires
 * ENCAISSÉ, pas sur le facturé. Une facture émise mais impayée ne doit donc
 * rien provisionner — sinon l'application te ferait mettre de côté de l'argent
 * que tu n'as pas reçu.
 *
 * ---------------------------------------------------------------------------
 * LE PIÈGE DU DOUBLE COMPTE
 * ---------------------------------------------------------------------------
 * L'URSSAF apparaît à deux endroits : provisionnée (calculée) et payée
 * (une vraie dépense enregistrée). Si le « disponible » retranchait les deux,
 * chaque euro versé à l'URSSAF serait compté deux fois et ton disponible
 * fondrait sans raison.
 *
 *   disponible = encaissé - autresDépenses - max(provisionné ; payé)
 *
 * Tant que tu n'as rien payé, c'est la provision qui est retenue. Dès que tu
 * paies, c'est le versement réel — et s'il dépasse la provision, c'est lui qui
 * compte. Jamais les deux.
 *
 * Tous ces montants s'entendent AVANT impôt sur le revenu personnel.
 */

import type { Cents, MicroInvoice, Transaction } from '../../db/types'

export interface MicroSummaryInput {
  /** Les factures de la période considérée. */
  invoices: MicroInvoice[]
  /** Les dépenses professionnelles de la période (transactions `isMicro`). */
  expenses: Transaction[]
  /** Identifiant de la catégorie qui enregistre les versements à l'URSSAF. */
  urssafCategoryId: string
  /** Taux de cotisation, en fraction (0.256 = 25,6 %). */
  urssafRate: number
}

export interface MicroSummary {
  /** Chiffre d'affaires réellement encaissé. */
  collected: Cents
  /** Facturé mais pas encore payé. */
  awaiting: Cents
  /** Cotisations dues sur l'encaissé. */
  urssafProvisioned: Cents
  /** Cotisations réellement versées. */
  urssafPaid: Cents
  /** Ce qu'il reste à verser. Jamais négatif. */
  urssafRemaining: Cents
  /** Dépenses professionnelles, hors versements URSSAF. */
  expenses: Cents
  /** Ce qui reste réellement disponible, avant impôt sur le revenu. */
  available: Cents
}

/** Ce qu'une facture a effectivement rapporté. */
function collectedAmount(invoice: MicroInvoice): Cents {
  if (invoice.status !== 'paid') return 0
  // Un paiement partiel est possible : le montant encaissé prime sur le
  // montant facturé, sinon un règlement incomplet gonflerait le chiffre.
  return invoice.paidAmount ?? invoice.amount
}

export function computeMicroSummary(input: MicroSummaryInput): MicroSummary {
  const collected = input.invoices.reduce((total, invoice) => total + collectedAmount(invoice), 0)

  const awaiting = input.invoices
    .filter((invoice) => invoice.status === 'issued' || invoice.status === 'awaiting')
    .reduce((total, invoice) => total + invoice.amount, 0)

  const urssafPaid = input.expenses
    .filter((expense) => expense.categoryId === input.urssafCategoryId)
    .reduce((total, expense) => total + expense.amount, 0)

  const otherExpenses = input.expenses
    .filter((expense) => expense.categoryId !== input.urssafCategoryId)
    .reduce((total, expense) => total + expense.amount, 0)

  const urssafProvisioned = Math.round(collected * input.urssafRate)

  return {
    collected,
    awaiting,
    urssafProvisioned,
    urssafPaid,
    urssafRemaining: Math.max(0, urssafProvisioned - urssafPaid),
    expenses: otherExpenses,
    // max() et non une somme : voir « le piège du double compte » plus haut.
    available: collected - otherExpenses - Math.max(urssafProvisioned, urssafPaid),
  }
}

/* ------------------------------------------------------------------ */
/* Prévisionnel                                                        */
/* ------------------------------------------------------------------ */

export interface ForecastRow {
  month: string
  /** Ce que le planning prévoit : heures × tarif. */
  planned: Cents
  /** Ce qui a été facturé ce mois-là. */
  invoiced: Cents
  /** Ce qui a été encaissé ce mois-là. */
  collected: Cents
}

export interface ForecastInput {
  months: string[]
  forecasts: { month: string; plannedHours: number; hourlyRate: Cents }[]
  invoices: MicroInvoice[]
}

/**
 * Comparaison Prévu / Facturé / Encaissé, mois par mois.
 *
 * Attention aux DATES employées : le facturé est rattaché au mois d'ÉMISSION,
 * l'encaissé au mois du PAIEMENT. Les deux ne tombent presque jamais dans le
 * même mois — c'est précisément ce décalage que le prévisionnel doit montrer.
 */
export function buildForecastComparison(input: ForecastInput): ForecastRow[] {
  return input.months.map((month) => ({
    month,
    planned: input.forecasts
      .filter((forecast) => forecast.month === month)
      .reduce((total, forecast) => total + Math.round(forecast.plannedHours * forecast.hourlyRate), 0),
    invoiced: input.invoices
      .filter(
        (invoice) => invoice.status !== 'draft' && invoice.status !== 'cancelled' &&
          invoice.issueDate.slice(0, 7) === month,
      )
      .reduce((total, invoice) => total + invoice.amount, 0),
    collected: input.invoices
      .filter((invoice) => invoice.status === 'paid' && invoice.paymentDate?.slice(0, 7) === month)
      .reduce((total, invoice) => total + collectedAmount(invoice), 0),
  }))
}
