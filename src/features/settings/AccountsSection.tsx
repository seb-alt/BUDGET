/**
 * src/features/settings/AccountsSection.tsx
 *
 * Renommer, réordonner, activer, ajouter, supprimer les comptes.
 *
 * Les comptes utilisés par le moteur d'épargne (LEP, PEA, assurance-vie) et le
 * compte de saisie par défaut sont protégés : on ne peut ni les désactiver ni
 * les supprimer, sinon les calculs perdraient leur point d'appui.
 */

import { useState } from 'react'
import { AmountField } from '../../components/ui/AmountField'
import {
  addAccount,
  deleteAccount,
  moveAccount,
  setAccountActive,
  updateAccount,
} from '../../db/settings'
import type { Account, AccountKind } from '../../db/types'
import { fromCents, parseBalanceInput } from '../../utils/money'

const KIND_LABELS: Record<AccountKind, string> = {
  checking: 'Compte courant',
  savings: 'Épargne',
  investment: 'Placement',
  micro: 'Micro-entreprise',
}

interface AccountsSectionProps {
  accounts: Account[]
  onSaved: (message: string) => void
}

export function AccountsSection({ accounts, onSaved }: AccountsSectionProps) {
  const [error, setError] = useState<string>()
  const [ceilings, setCeilings] = useState<Record<string, string>>({})
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState<AccountKind>('savings')

  async function run(action: () => Promise<unknown>, message?: string) {
    setError(undefined)
    try {
      await action()
      if (message !== undefined) onSaved(message)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "L'opération a échoué.")
    }
  }

  const ceilingValue = (account: Account) =>
    ceilings[account.id] ??
    (account.ceiling === undefined ? '' : String(fromCents(account.ceiling)).replace('.', ','))

  const sorted = [...accounts].sort((a, b) => a.order - b.order)

  return (
    <div className="set-section">
      {error !== undefined && <p className="set-error">{error}</p>}

      <ul className="set-list">
        {sorted.map((account, index) => (
          <li key={account.id} className={account.active ? undefined : 'is-inactive'}>
            <input
              type="text"
              aria-label={`Nom de ${account.name}`}
              defaultValue={account.name}
              onBlur={(event) => {
                if (event.target.value.trim() !== account.name) {
                  void run(() =>
                    updateAccount(account.id, {
                      name: event.target.value,
                      ceiling: account.ceiling ?? null,
                    }),
                  )
                }
              }}
            />

            <div className="set-row-actions">
              <span className="set-kind">{KIND_LABELS[account.kind]}</span>
              <button
                type="button"
                aria-label={`Monter ${account.name}`}
                disabled={index === 0}
                onClick={() => void run(() => moveAccount(account.id, -1))}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Descendre ${account.name}`}
                disabled={index === sorted.length - 1}
                onClick={() => void run(() => moveAccount(account.id, 1))}
              >
                ↓
              </button>
              <button
                type="button"
                className={account.active ? 'is-on' : undefined}
                aria-pressed={account.active}
                aria-label={`${account.active ? 'Désactiver' : 'Activer'} ${account.name}`}
                onClick={() => void run(() => setAccountActive(account.id, !account.active))}
              >
                {account.active ? 'Actif' : 'Inactif'}
              </button>
              <button
                type="button"
                className="is-danger"
                aria-label={`Supprimer ${account.name}`}
                onClick={() => void run(() => deleteAccount(account.id), 'Compte supprimé.')}
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>

      <h3 className="set-subtitle">Plafonds</h3>
      <div className="set-grid">
        {sorted
          .filter((account) => account.kind === 'savings' || account.ceiling !== undefined)
          .map((account) => {
            const raw = ceilingValue(account)
            return (
              <div key={account.id} className="set-ceiling">
                <AmountField
                  label={account.name}
                  value={raw}
                  invalid={raw !== '' && parseBalanceInput(raw) === null}
                  onChange={(value) => setCeilings((c) => ({ ...c, [account.id]: value }))}
                  hint="Vide = pas de plafond."
                />
                <button
                  type="button"
                  onClick={() =>
                    void run(
                      () =>
                        updateAccount(account.id, {
                          name: account.name,
                          ceiling: raw === '' ? null : parseBalanceInput(raw),
                        }),
                      'Plafond enregistré.',
                    )
                  }
                >
                  Enregistrer
                </button>
              </div>
            )
          })}
      </div>

      <div className="set-add">
        <h3 className="set-subtitle">Ajouter un compte</h3>
        <div className="set-add-row">
          <input
            type="text"
            aria-label="Nom du nouveau compte"
            placeholder="Nom"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
          <select
            aria-label="Type du nouveau compte"
            value={newKind}
            onChange={(event) => setNewKind(event.target.value as AccountKind)}
          >
            {(Object.keys(KIND_LABELS) as AccountKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {KIND_LABELS[kind]}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={newName.trim() === ''}
            onClick={() =>
              void run(async () => {
                await addAccount(newName, newKind)
                setNewName('')
              }, 'Compte ajouté.')
            }
          >
            Ajouter
          </button>
        </div>
        <p className="ui-field-hint">
          Un compte d'épargne ou de placement reçoit de l'épargne : un virement vers lui ne
          sera jamais compté comme une dépense.
        </p>
      </div>
    </div>
  )
}
