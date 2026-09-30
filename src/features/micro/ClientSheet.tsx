/**
 * src/features/micro/ClientSheet.tsx
 *
 * Fiche client (§9). Le tarif horaire et le délai de paiement servent à
 * pré-remplir les nouvelles factures : les saisir une fois ici évite de les
 * retaper à chaque facture, et surtout d'en oublier une.
 */

import { useState } from 'react'
import { AmountField } from '../../components/ui/AmountField'
import { Field } from '../../components/ui/Field'
import { Sheet } from '../../components/ui/Sheet'
import { deleteClient, saveClient } from '../../db/micro'
import type { MicroClient } from '../../db/types'
import { fromCents, parseBalanceInput } from '../../utils/money'

const toInput = (cents?: number) => (cents === undefined ? '' : String(fromCents(cents)).replace('.', ','))

interface ClientSheetProps {
  client?: MicroClient
  defaultTermDays: number
  onClose: () => void
  onSaved: (message: string) => void
}

export function ClientSheet({ client, defaultTermDays, onClose, onSaved }: ClientSheetProps) {
  const [name, setName] = useState(client?.name ?? '')
  const [rate, setRate] = useState(toInput(client?.hourlyRate))
  const [term, setTerm] = useState(String(client?.paymentTermDays ?? defaultTermDays))
  const [error, setError] = useState<string>()
  const [isSaving, setIsSaving] = useState(false)
  const [isConfirmingDelete, setConfirmingDelete] = useState(false)

  const parsedTerm = /^\d+$/.test(term.trim()) ? Number(term.trim()) : null
  const parsedRate = rate.trim() === '' ? undefined : parseBalanceInput(rate)
  const canSave = name.trim() !== '' && parsedTerm !== null && parsedRate !== null && !isSaving

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
    <Sheet title={client ? 'Modifier le client' : 'Nouveau client'} onClose={onClose}>
      <div className="mic-form">
        <Field label="Nom">
          {({ id }) => (
            <input
              id={id}
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>

        <div className="mic-form-row">
          <AmountField
            label="Tarif horaire HT"
            value={rate}
            invalid={parsedRate === null}
            onChange={setRate}
            hint="Facultatif. Pré-remplira les factures."
          />
          <AmountField
            label="Délai de paiement"
            value={term}
            suffix="jours"
            inputMode="numeric"
            invalid={parsedTerm === null}
            onChange={setTerm}
          />
        </div>

        {error !== undefined && <p className="mic-error">{error}</p>}

        {client !== undefined &&
          (isConfirmingDelete ? (
            <div className="mic-danger">
              <p>Supprimer définitivement « {client.name} » ?</p>
              <div className="mic-danger-actions">
                <button type="button" onClick={() => setConfirmingDelete(false)}>
                  Annuler
                </button>
                <button
                  type="button"
                  className="is-danger"
                  onClick={() => void run(() => deleteClient(client.id), 'Client supprimé.')}
                >
                  Supprimer
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="mic-delete" onClick={() => setConfirmingDelete(true)}>
              Supprimer ce client
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
              () =>
                saveClient(
                  {
                    name,
                    hourlyRate: parsedRate ?? undefined,
                    paymentTermDays: parsedTerm ?? undefined,
                  },
                  client?.id,
                ),
              client ? 'Client modifié.' : 'Client ajouté.',
            )
          }
        >
          {isSaving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </Sheet>
  )
}
