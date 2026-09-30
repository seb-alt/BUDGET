/**
 * src/features/micro/InvoiceSheet.tsx
 *
 * Saisie d'une facture (§9).
 *
 * Changer de client recalcule l'échéance à partir de SON délai de paiement,
 * et propose son tarif horaire : c'est tout l'intérêt de la fiche client.
 * Tant que tu n'as pas touché à l'échéance, elle suit ; dès que tu la
 * modifies à la main, on ne l'écrase plus.
 *
 * « En retard » n'est pas proposé dans la liste des statuts : il se déduit de
 * la date du jour. L'enregistrer le rendrait faux dès le lendemain.
 */

import { useState } from 'react'
import { AmountField } from '../../components/ui/AmountField'
import { Field } from '../../components/ui/Field'
import { Sheet } from '../../components/ui/Sheet'
import { deleteInvoice, saveInvoice, validateInvoice } from '../../db/micro'
import type { InvoiceStatus, MicroClient, MicroInvoice } from '../../db/types'
import { computeDueDate } from '../../domain/micro/invoices'
import { today } from '../../utils/date'
import { fromCents, parseBalanceInput } from '../../utils/money'

const STATUS_OPTIONS: { value: InvoiceStatus; label: string }[] = [
  { value: 'draft', label: 'Brouillon' },
  { value: 'issued', label: 'Émise' },
  { value: 'awaiting', label: 'À recevoir' },
  { value: 'paid', label: 'Payée' },
  { value: 'cancelled', label: 'Annulée' },
]

const toInput = (cents?: number) => (cents === undefined ? '' : String(fromCents(cents)).replace('.', ','))

interface InvoiceSheetProps {
  invoice?: MicroInvoice
  clients: MicroClient[]
  suggestedNumber: string
  defaultTermDays: number
  onClose: () => void
  onSaved: (message: string) => void
}

export function InvoiceSheet({
  invoice,
  clients,
  suggestedNumber,
  defaultTermDays,
  onClose,
  onSaved,
}: InvoiceSheetProps) {
  const [number, setNumber] = useState(invoice?.number ?? suggestedNumber)
  const [clientId, setClientId] = useState(invoice?.clientId ?? clients[0]?.id ?? '')
  const [issueDate, setIssueDate] = useState(invoice?.issueDate ?? today())
  const [amount, setAmount] = useState(toInput(invoice?.amount))
  const [hours, setHours] = useState(invoice?.hours === undefined ? '' : String(invoice.hours))
  const [status, setStatus] = useState<InvoiceStatus>(invoice?.status ?? 'draft')
  const [paymentDate, setPaymentDate] = useState(invoice?.paymentDate ?? today())
  const [paidAmount, setPaidAmount] = useState(toInput(invoice?.paidAmount))
  const [notes, setNotes] = useState(invoice?.notes ?? '')
  const [error, setError] = useState<string>()
  const [isSaving, setIsSaving] = useState(false)
  const [isConfirmingDelete, setConfirmingDelete] = useState(false)

  /** Échéance déduite, tant que tu ne l'as pas fixée toi-même. */
  const [manualDueDate, setManualDueDate] = useState(invoice?.dueDate)

  const termFor = (id: string) =>
    clients.find((client) => client.id === id)?.paymentTermDays ?? defaultTermDays
  const dueDate = manualDueDate ?? computeDueDate(issueDate, termFor(clientId))

  const parsedAmount = parseBalanceInput(amount)
  const parsedPaid = paidAmount.trim() === '' ? undefined : parseBalanceInput(paidAmount)
  const parsedHours = hours.trim() === '' ? undefined : Number(hours.replace(',', '.'))

  const draft = {
    number,
    clientId,
    issueDate,
    amount: parsedAmount ?? 0,
    dueDate,
    status,
    paymentDate: status === 'paid' ? paymentDate : undefined,
    paidAmount: status === 'paid' ? (parsedPaid ?? parsedAmount ?? undefined) : undefined,
    hours: Number.isFinite(parsedHours) ? parsedHours : undefined,
    notes: notes.trim() === '' ? undefined : notes.trim(),
  }
  const problems = validateInvoice(draft)
  const canSave = problems.length === 0 && !isSaving

  /** Le tarif du client permet de proposer un montant à partir des heures. */
  function applyHours(value: string) {
    setHours(value)
    const rate = clients.find((client) => client.id === clientId)?.hourlyRate
    const parsed = Number(value.replace(',', '.'))
    if (rate !== undefined && Number.isFinite(parsed) && parsed > 0) {
      setAmount(String(fromCents(Math.round(parsed * rate))).replace('.', ','))
    }
  }

  async function run(action: () => Promise<unknown>, message: string) {
    setIsSaving(true)
    setError(undefined)
    try {
      await action()
      onSaved(message)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "L'opération a échoué.")
      setIsSaving(false)
    }
  }

  return (
    <Sheet title={invoice ? 'Modifier la facture' : 'Nouvelle facture'} onClose={onClose}>
      <div className="mic-form">
        <div className="mic-form-row">
          <Field label="Numéro">
            {({ id }) => (
              <input
                id={id}
                type="text"
                value={number}
                onChange={(event) => setNumber(event.target.value)}
              />
            )}
          </Field>

          <Field label="Client">
            {({ id }) => (
              <select
                id={id}
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
              >
                {clients.length === 0 && <option value="">Aucun client</option>}
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        <div className="mic-form-row">
          <Field label="Date d'émission">
            {({ id }) => (
              <input
                id={id}
                type="date"
                value={issueDate}
                onChange={(event) => setIssueDate(event.target.value)}
              />
            )}
          </Field>

          <Field
            label="Échéance"
            hint={
              manualDueDate === undefined
                ? `Déduite du délai de ${termFor(clientId)} jours.`
                : 'Fixée à la main.'
            }
          >
            {({ id, describedBy }) => (
              <input
                id={id}
                type="date"
                aria-describedby={describedBy}
                value={dueDate}
                onChange={(event) => setManualDueDate(event.target.value)}
              />
            )}
          </Field>
        </div>

        <div className="mic-form-row">
          <AmountField
            label="Heures"
            value={hours}
            suffix="h"
            onChange={applyHours}
            hint="Renseigne le montant à partir du tarif du client."
          />
          <AmountField
            label="Montant HT"
            value={amount}
            invalid={parsedAmount === null || parsedAmount <= 0}
            onChange={setAmount}
          />
        </div>

        <Field
          label="Statut"
          hint="« En retard » n'est pas un choix : il se déduit de l'échéance."
        >
          {({ id, describedBy }) => (
            <select
              id={id}
              aria-describedby={describedBy}
              value={status}
              onChange={(event) => setStatus(event.target.value as InvoiceStatus)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </Field>

        {status === 'paid' && (
          <div className="mic-form-row">
            <Field label="Payée le">
              {({ id }) => (
                <input
                  id={id}
                  type="date"
                  value={paymentDate}
                  onChange={(event) => setPaymentDate(event.target.value)}
                />
              )}
            </Field>
            <AmountField
              label="Montant encaissé"
              value={paidAmount}
              invalid={parsedPaid === null}
              onChange={setPaidAmount}
              hint="Vide = le montant facturé."
            />
          </div>
        )}

        <Field label="Notes">
          {({ id }) => (
            <input
              id={id}
              type="text"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          )}
        </Field>

        {(error !== undefined || problems.length > 0) && (
          <p className="mic-error">{error ?? problems[0]}</p>
        )}

        {invoice !== undefined &&
          (isConfirmingDelete ? (
            <div className="mic-danger">
              <p>Supprimer définitivement la facture {invoice.number} ?</p>
              <div className="mic-danger-actions">
                <button type="button" onClick={() => setConfirmingDelete(false)}>
                  Annuler
                </button>
                <button
                  type="button"
                  className="is-danger"
                  onClick={() => void run(() => deleteInvoice(invoice.id), 'Facture supprimée.')}
                >
                  Supprimer
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="mic-delete" onClick={() => setConfirmingDelete(true)}>
              Supprimer cette facture
            </button>
          ))}
      </div>

      <div className="mic-footer">
        <button
          type="button"
          className="mic-submit"
          disabled={!canSave}
          onClick={() =>
            void run(
              () => saveInvoice(draft, invoice?.id),
              invoice ? 'Facture modifiée.' : 'Facture créée.',
            )
          }
        >
          {isSaving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </Sheet>
  )
}
