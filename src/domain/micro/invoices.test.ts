/**
 * Tests du cycle de vie des factures.
 * Le retard se déduit de la date du jour : ces tests fixent « aujourd'hui »
 * pour que le résultat ne dépende pas du moment où on les lance.
 */

import { describe, expect, it } from 'vitest'
import type { MicroInvoice } from '../../db/types'
import {
  computeDueDate,
  daysBetween,
  effectiveStatus,
  formatInvoiceNumber,
  invoiceAlerts,
} from './invoices'

const TODAY = '2026-09-30'

let sequence = 0
function invoice(partial: Partial<MicroInvoice> = {}): MicroInvoice {
  sequence += 1
  return {
    id: `f${sequence}`,
    number: `F2026-${String(sequence).padStart(3, '0')}`,
    clientId: 'esail',
    issueDate: '2026-09-01',
    amount: 77000,
    dueDate: '2026-10-01',
    status: 'awaiting',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...partial,
  }
}

describe('daysBetween', () => {
  it('compte les jours entiers', () => {
    expect(daysBetween('2026-09-30', '2026-10-05')).toBe(5)
    expect(daysBetween('2026-10-05', '2026-09-30')).toBe(-5)
    expect(daysBetween('2026-09-30', '2026-09-30')).toBe(0)
  })

  it('traverse les mois et les années', () => {
    expect(daysBetween('2026-12-28', '2027-01-04')).toBe(7)
  })
})

describe('computeDueDate', () => {
  it('ajoute le délai de paiement', () => {
    expect(computeDueDate('2026-09-01', 30)).toBe('2026-10-01')
  })

  it('gère un délai qui change d’année', () => {
    expect(computeDueDate('2026-12-15', 30)).toBe('2027-01-14')
  })

  it('accepte un paiement comptant', () => {
    expect(computeDueDate('2026-09-01', 0)).toBe('2026-09-01')
  })
})

describe('effectiveStatus : le retard se déduit, il ne se stocke pas', () => {
  it('une facture à recevoir dont l’échéance est passée est en retard', () => {
    expect(effectiveStatus(invoice({ dueDate: '2026-09-24' }), TODAY)).toBe('late')
  })

  it('une facture dont l’échéance est aujourd’hui n’est pas encore en retard', () => {
    expect(effectiveStatus(invoice({ dueDate: TODAY }), TODAY)).toBe('awaiting')
  })

  it('un brouillon ne bascule jamais en retard', () => {
    // Un brouillon n'a pas été envoyé : personne ne te doit rien.
    expect(effectiveStatus(invoice({ status: 'draft', dueDate: '2026-01-01' }), TODAY)).toBe('draft')
  })

  it('une facture payée ou annulée non plus', () => {
    expect(effectiveStatus(invoice({ status: 'paid', dueDate: '2026-01-01' }), TODAY)).toBe('paid')
    expect(effectiveStatus(invoice({ status: 'cancelled', dueDate: '2026-01-01' }), TODAY)).toBe(
      'cancelled',
    )
  })
})

describe('invoiceAlerts', () => {
  it('annonce un paiement attendu dans les jours qui viennent', () => {
    const alerts = invoiceAlerts([invoice({ dueDate: '2026-10-05' })], TODAY)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].kind).toBe('soon')
    expect(alerts[0].days).toBe(5)
  })

  it('annonce un retard en jours écoulés', () => {
    const alerts = invoiceAlerts([invoice({ dueDate: '2026-09-24' })], TODAY)
    expect(alerts[0].kind).toBe('late')
    expect(alerts[0].days).toBe(6)
  })

  it('ignore une échéance encore lointaine', () => {
    expect(invoiceAlerts([invoice({ dueDate: '2026-11-30' })], TODAY)).toHaveLength(0)
  })

  it('ignore les brouillons, les payées et les annulées', () => {
    const invoices = [
      invoice({ status: 'draft', dueDate: '2026-09-01' }),
      invoice({ status: 'paid', dueDate: '2026-09-01' }),
      invoice({ status: 'cancelled', dueDate: '2026-09-01' }),
    ]
    expect(invoiceAlerts(invoices, TODAY)).toHaveLength(0)
  })

  it('met les retards en premier, le plus ancien en tête', () => {
    const alerts = invoiceAlerts(
      [
        invoice({ dueDate: '2026-10-02' }), // dans 2 jours
        invoice({ dueDate: '2026-09-28' }), // 2 jours de retard
        invoice({ dueDate: '2026-09-20' }), // 10 jours de retard
      ],
      TODAY,
    )

    expect(alerts.map((alert) => `${alert.kind}-${alert.days}`)).toEqual([
      'late-10',
      'late-2',
      'soon-2',
    ])
  })
})

describe('formatInvoiceNumber', () => {
  it('compose un numéro lisible et triable', () => {
    expect(formatInvoiceNumber('F', 2026, 1)).toBe('F2026-001')
    expect(formatInvoiceNumber('F', 2026, 42)).toBe('F2026-042')
    expect(formatInvoiceNumber('FA-', 2027, 128)).toBe('FA-2027-128')
  })
})
