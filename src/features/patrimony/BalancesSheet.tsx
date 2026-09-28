/**
 * src/features/patrimony/BalancesSheet.tsx
 *
 * « Actualiser mes soldes » (§8).
 *
 * Pas de connexion bancaire : tu recopies les soldes lus sur tes comptes, et
 * l'application enregistre un point daté. C'est ce point qui recale les
 * calculs — notamment le solde du LEP, dont dépend toute la répartition de ton
 * épargne — et qui alimentera les courbes du Patrimoine.
 *
 * Les champs sont pré-remplis avec le solde calculé : en usage courant tu n'as
 * qu'à corriger ce qui a dérivé, pas tout retaper.
 */

import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AmountField } from '../../components/ui/AmountField'
import { Sheet } from '../../components/ui/Sheet'
import { db } from '../../db/db'
import { saveBalanceSnapshot } from '../../db/patrimony'
import type { SnapshotBalance } from '../../db/types'
import { computeAccountBalances } from '../../domain/patrimony/accountBalance'
import { today } from '../../utils/date'
import { fromCents, parseBalanceInput } from '../../utils/money'
import './BalancesSheet.css'

interface BalancesSheetProps {
  onClose: () => void
  onSaved: (message: string) => void
}

export function BalancesSheet({ onClose, onSaved }: BalancesSheetProps) {
  const accounts = useLiveQuery(() => db.accounts.orderBy('order').toArray(), [])
  const transactions = useLiveQuery(() => db.transactions.toArray(), [])
  const snapshots = useLiveQuery(() => db.patrimonySnapshots.toArray(), [])

  const [date, setDate] = useState(today())
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState<string>()
  const [isSaving, setIsSaving] = useState(false)

  /** Les comptes à saisir : tout sauf la micro-entreprise, qui a son onglet. */
  const editableAccounts = useMemo(
    () => (accounts ?? []).filter((account) => account.active && account.kind !== 'micro'),
    [accounts],
  )

  const computed = useMemo(
    () =>
      computeAccountBalances(
        editableAccounts.map((account) => account.id),
        transactions ?? [],
        snapshots ?? [],
      ),
    [editableAccounts, transactions, snapshots],
  )

  if (!accounts || !transactions || !snapshots) {
    return (
      <Sheet title="Actualiser mes soldes" onClose={onClose}>
        <p className="bal-loading">Chargement…</p>
      </Sheet>
    )
  }

  /** La valeur affichée : ta saisie en cours, sinon le solde calculé. */
  const valueFor = (accountId: string): string => {
    const draft = drafts[accountId]
    if (draft !== undefined) return draft
    const balance = computed.get(accountId)?.balance ?? 0
    return String(fromCents(balance)).replace('.', ',')
  }

  async function handleSubmit() {
    const balances: SnapshotBalance[] = []
    for (const account of editableAccounts) {
      const cents = parseBalanceInput(valueFor(account.id))
      if (cents === null) {
        setError(`Le solde du compte ${account.name} n'est pas un montant valable.`)
        return
      }
      balances.push({ accountId: account.id, balance: cents })
    }

    setIsSaving(true)
    setError(undefined)
    try {
      await saveBalanceSnapshot({ date, balances })
      onSaved('Soldes enregistrés.')
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "L'enregistrement a échoué.")
      setIsSaving(false)
    }
  }

  return (
    <Sheet title="Actualiser mes soldes" onClose={onClose}>
      <div className="bal-body">
        <p className="bal-intro">
          Recopie les soldes lus sur tes comptes. Ils serviront de point de départ aux
          calculs : les opérations enregistrées après cette date viendront s'y ajouter.
        </p>

        <label className="bal-field">
          <span className="bal-label">Date du relevé</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>

        {editableAccounts.map((account) => {
          const raw = valueFor(account.id)
          return (
            <AmountField
              key={account.id}
              label={account.name}
              value={raw}
              invalid={parseBalanceInput(raw) === null}
              onChange={(next) =>
                setDrafts((current) => ({ ...current, [account.id]: next }))
              }
            />
          )
        })}

        {error !== undefined && <p className="bal-error">{error}</p>}
      </div>

      <div className="bal-footer">
        <button
          type="button"
          className="bal-submit"
          disabled={isSaving}
          onClick={() => void handleSubmit()}
        >
          {isSaving ? 'Enregistrement…' : 'Enregistrer mes soldes'}
        </button>
      </div>
    </Sheet>
  )
}
