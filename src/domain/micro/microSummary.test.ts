/**
 * Tests des indicateurs micro.
 * Le point sensible : l'URSSAF, qui apparaît à deux endroits et pourrait
 * facilement être retranchée deux fois du disponible.
 */

import { describe, expect, it } from 'vitest'
import type { MicroInvoice, Transaction } from '../../db/types'
import { buildForecastComparison, computeMicroSummary } from './microSummary'

let sequence = 0
const invoice = (partial: Partial<MicroInvoice> = {}): MicroInvoice => {
  sequence += 1
  return {
    id: `f${sequence}`,
    number: `F${sequence}`,
    clientId: 'client-1',
    issueDate: '2026-09-01',
    amount: 77000,
    dueDate: '2026-10-01',
    status: 'awaiting',
    createdAt: '',
    updatedAt: '',
    ...partial,
  }
}

const expense = (amount: number, categoryId: string): Transaction => {
  sequence += 1
  return {
    id: `e${sequence}`,
    type: 'expense',
    amount,
    date: '2026-09-15',
    categoryId,
    accountId: 'micro',
    isMicro: true,
    createdAt: '',
    updatedAt: '',
  }
}

const summarise = (invoices: MicroInvoice[], expenses: Transaction[] = []) =>
  computeMicroSummary({ invoices, expenses, urssafCategoryId: 'urssaf', urssafRate: 0.256 })

describe('chiffre d’affaires', () => {
  it('n’encaisse que les factures payées', () => {
    const summary = summarise([
      invoice({ status: 'paid', amount: 100000 }),
      invoice({ status: 'awaiting', amount: 77000 }),
      invoice({ status: 'draft', amount: 50000 }),
    ])

    expect(summary.collected).toBe(100000)
    expect(summary.awaiting).toBe(77000)
  })

  it('retient le montant réellement reçu en cas de paiement partiel', () => {
    const summary = summarise([invoice({ status: 'paid', amount: 100000, paidAmount: 90000 })])
    expect(summary.collected).toBe(90000)
  })

  it('ignore les factures annulées', () => {
    const summary = summarise([invoice({ status: 'cancelled', amount: 100000 })])
    expect(summary.collected).toBe(0)
    expect(summary.awaiting).toBe(0)
  })
})

describe('URSSAF', () => {
  it('provisionne sur l’ENCAISSÉ, pas sur le facturé', () => {
    // 1 000 € encaissés et 5 000 € en attente : on ne provisionne que sur 1 000 €.
    const summary = summarise([
      invoice({ status: 'paid', amount: 100000 }),
      invoice({ status: 'awaiting', amount: 500000 }),
    ])

    expect(summary.urssafProvisioned).toBe(25600)
  })

  it('distingue provisionné et réellement payé', () => {
    const summary = summarise([invoice({ status: 'paid', amount: 100000 })], [expense(10000, 'urssaf')])

    expect(summary.urssafProvisioned).toBe(25600)
    expect(summary.urssafPaid).toBe(10000)
    expect(summary.urssafRemaining).toBe(15600)
  })

  it('ne réclame rien de plus quand tu as trop versé', () => {
    const summary = summarise([invoice({ status: 'paid', amount: 100000 })], [expense(30000, 'urssaf')])
    expect(summary.urssafRemaining).toBe(0)
  })
})

describe('le piège du double compte', () => {
  const paid = [invoice({ status: 'paid', amount: 100000 })]

  it('sans versement, la provision est retenue', () => {
    // 1 000 € - 256 € de provision = 744 €.
    expect(summarise(paid).available).toBe(74400)
  })

  it('après un versement partiel, le disponible NE BOUGE PAS', () => {
    // Payer 100 € d'URSSAF ne t'appauvrit pas : cet argent était déjà mis de
    // côté. Si on retranchait provision ET versement, on tomberait à 644 €.
    const summary = summarise(paid, [expense(10000, 'urssaf')])
    expect(summary.available).toBe(74400)
  })

  it('après le versement complet non plus', () => {
    const summary = summarise(paid, [expense(25600, 'urssaf')])
    expect(summary.available).toBe(74400)
  })

  it('un trop-versé, lui, se voit bien', () => {
    const summary = summarise(paid, [expense(30000, 'urssaf')])
    expect(summary.available).toBe(70000)
  })

  it('les autres dépenses professionnelles se retranchent normalement', () => {
    const summary = summarise(paid, [expense(10000, 'urssaf'), expense(5000, 'logiciels')])
    expect(summary.expenses).toBe(5000)
    expect(summary.available).toBe(69400)
  })
})

describe('prévisionnel', () => {
  it('rattache le facturé au mois d’ÉMISSION et l’encaissé au mois du PAIEMENT', () => {
    // Une facture émise en septembre et payée en octobre apparaît dans les
    // deux mois, mais pas dans la même colonne : c'est tout l'intérêt.
    const rows = buildForecastComparison({
      months: ['2026-09', '2026-10'],
      forecasts: [{ month: '2026-09', plannedHours: 14, hourlyRate: 5500 }],
      invoices: [
        invoice({ status: 'paid', amount: 77000, issueDate: '2026-09-30', paymentDate: '2026-10-15' }),
      ],
    })

    expect(rows[0]).toEqual({ month: '2026-09', planned: 77000, invoiced: 77000, collected: 0 })
    expect(rows[1]).toEqual({ month: '2026-10', planned: 0, invoiced: 0, collected: 77000 })
  })

  it('calcule le prévu en heures × tarif', () => {
    const [row] = buildForecastComparison({
      months: ['2026-10'],
      forecasts: [{ month: '2026-10', plannedHours: 24, hourlyRate: 5500 }],
      invoices: [],
    })
    expect(row.planned).toBe(132000)
  })

  it('additionne plusieurs plannings sur le même mois', () => {
    const [row] = buildForecastComparison({
      months: ['2026-10'],
      forecasts: [
        { month: '2026-10', plannedHours: 24, hourlyRate: 5500 },
        { month: '2026-10', plannedHours: 10, hourlyRate: 6000 },
      ],
      invoices: [],
    })
    expect(row.planned).toBe(192000)
  })

  it('ne compte ni les brouillons ni les annulées dans le facturé', () => {
    const [row] = buildForecastComparison({
      months: ['2026-09'],
      forecasts: [],
      invoices: [
        invoice({ status: 'draft', amount: 50000 }),
        invoice({ status: 'cancelled', amount: 50000 }),
        invoice({ status: 'awaiting', amount: 77000 }),
      ],
    })
    expect(row.invoiced).toBe(77000)
  })
})
