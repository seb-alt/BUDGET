/**
 * src/features/operations/OperationSheet.tsx
 *
 * L'écran de saisie d'une opération — le plus critique en ergonomie (§5).
 *
 * Le même écran sert à CRÉER et à MODIFIER : on lui passe une opération
 * existante, ou rien. Un second écran presque identique aurait divergé au
 * premier changement, et les deux formulaires n'auraient plus validé la même
 * chose.
 *
 * Principe : montant d'abord, au clavier numérique intégré. Un clavier maison
 * plutôt que celui du téléphone, pour deux raisons : il ne recouvre pas le
 * formulaire, et il ne peut produire que des montants valides.
 *
 * Tout le reste a une valeur par défaut raisonnable (aujourd'hui, compte CIC),
 * donc une dépense courante se saisit en : montant, catégorie, Enregistrer.
 */

import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChoiceGrid } from '../../components/ui/ChoiceGrid'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { Sheet } from '../../components/ui/Sheet'
import { db } from '../../db/db'
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
  validateTransaction,
} from '../../db/transactions'
import type { CategoryGroup, Transaction, TransactionType } from '../../db/types'
import { today } from '../../utils/date'
import { appendAmountKey, formatEurosCompact, parseAmountInput } from '../../utils/money'
import './OperationSheet.css'

/**
 * Ordre d'apparition des catégories dans la saisie : les loisirs d'abord,
 * parce que ce sont les dépenses les plus fréquentes au quotidien.
 * Déplacera vers les paramètres quand on construira l'écran Réglages (§10).
 */
const QUICK_PICK_GROUP_ORDER: CategoryGroup[] = [
  'loisirs',
  'chargesFixes',
  'divers',
  'revenuPerso',
  'epargne',
  'micro',
]

const TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: 'expense', label: 'Dépense' },
  { value: 'income', label: 'Entrée' },
  { value: 'transfer', label: 'Transfert' },
]

const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'backspace']

/** Le montant stocké en centimes redevient du texte modifiable : 2450 -> '24,50'. */
function amountToText(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',').replace(/,00$/, '')
}

interface OperationSheetProps {
  /** Opération à modifier. Absent = création. */
  transaction?: Transaction
  onClose: () => void
  /** Appelé après un enregistrement ou une suppression réussis. */
  onSaved: (message: string) => void
}

export function OperationSheet({ transaction, onClose, onSaved }: OperationSheetProps) {
  const isEditing = transaction !== undefined

  const accounts = useLiveQuery(() => db.accounts.orderBy('order').toArray(), [])
  const categories = useLiveQuery(() => db.categories.orderBy('[group+order]').toArray(), [])
  const settings = useLiveQuery(() => db.settings.get(1), [])

  const [type, setType] = useState<TransactionType>(transaction?.type ?? 'expense')
  const [amountText, setAmountText] = useState(
    transaction ? amountToText(transaction.amount) : '',
  )
  const [categoryId, setCategoryId] = useState(transaction?.categoryId)
  const [accountId, setAccountId] = useState(transaction?.accountId)
  const [fromAccountId, setFromAccountId] = useState(transaction?.fromAccountId)
  const [toAccountId, setToAccountId] = useState(transaction?.toAccountId)
  const [date, setDate] = useState(transaction?.date ?? today())
  const [label, setLabel] = useState(transaction?.label ?? '')
  const [error, setError] = useState<string>()
  const [isSaving, setIsSaving] = useState(false)
  /** La suppression demande une confirmation : un geste de trop, volontairement. */
  const [isConfirmingDelete, setConfirmingDelete] = useState(false)

  const activeAccounts = useMemo(
    () => (accounts ?? []).filter((account) => account.active),
    [accounts],
  )

  // Comptes par défaut : tant que tu n'as rien choisi, on retombe sur le compte
  // défini dans les paramètres (CIC). On le DÉDUIT au moment de l'affichage
  // plutôt que de l'écrire dans l'état depuis un effet — ça évite un rendu
  // supplémentaire et un état qui peut se désynchroniser des réglages.
  const effectiveAccountId = accountId ?? settings?.defaultAccountId
  const effectiveFromAccountId = fromAccountId ?? settings?.defaultAccountId

  /**
   * Changer de type remet la catégorie à zéro : celles d'une dépense n'ont rien
   * à voir avec celles d'une entrée, et un transfert n'en a pas du tout.
   * On le fait dans le gestionnaire de l'événement qui en est la cause.
   */
  function changeType(nextType: TransactionType) {
    setType(nextType)
    setCategoryId(undefined)
    setError(undefined)
  }

  const categoryOptions = useMemo(() => {
    if (!categories) return []
    const kind = type === 'income' ? 'income' : 'expense'
    return categories
      .filter(
        (category) =>
          category.active &&
          category.kind === kind &&
          // En modification, on garde visible la catégorie déjà choisie même si
          // elle n'est pas dans les accès rapides : sinon elle disparaîtrait du
          // formulaire et une simple correction de montant l'effacerait.
          (category.quickPick === true || category.id === transaction?.categoryId),
      )
      .sort(
        (a, b) =>
          QUICK_PICK_GROUP_ORDER.indexOf(a.group) - QUICK_PICK_GROUP_ORDER.indexOf(b.group) ||
          a.order - b.order,
      )
      .map((category) => ({ value: category.id, label: category.name }))
  }, [categories, type, transaction?.categoryId])

  const amount = parseAmountInput(amountText)

  const draft = {
    type,
    amount: amount ?? 0,
    date,
    label,
    ...(type === 'transfer'
      ? { fromAccountId: effectiveFromAccountId, toAccountId }
      : { categoryId, accountId: effectiveAccountId }),
  }
  const problems = validateTransaction(draft)
  const canSave = amount !== null && problems.length === 0 && !isSaving

  const destinationAccount = activeAccounts.find((account) => account.id === toAccountId)

  // Clavier physique (ordinateur). On ignore les frappes destinées à un champ
  // de saisie, sinon taper « 3 » dans le libellé modifierait le montant.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return

      if (/^\d$/.test(event.key))
        setAmountText((current) => appendAmountKey(current, event.key))
      else if (event.key === ',' || event.key === '.')
        setAmountText((c) => appendAmountKey(c, ','))
      else if (event.key === 'Backspace') setAmountText((c) => appendAmountKey(c, 'backspace'))
      else return

      event.preventDefault()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  async function handleSubmit() {
    if (amount === null) {
      setError('Saisis un montant.')
      return
    }
    if (problems.length > 0) {
      setError(problems[0])
      return
    }

    setIsSaving(true)
    setError(undefined)
    try {
      if (transaction) {
        await updateTransaction(transaction.id, { ...draft, amount })
        onSaved('Opération modifiée.')
      } else {
        await createTransaction({ ...draft, amount })
        onSaved('Opération enregistrée.')
      }
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "L'enregistrement a échoué.")
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!transaction) return
    setIsSaving(true)
    try {
      await deleteTransaction(transaction.id)
      onSaved('Opération supprimée.')
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La suppression a échoué.')
      setIsSaving(false)
    }
  }

  return (
    <Sheet title={isEditing ? "Modifier l'opération" : 'Nouvelle opération'} onClose={onClose}>
      <div className="op-amount">
        <output className="op-amount-value tabular" aria-live="polite">
          {amountText === '' ? <span className="op-amount-placeholder">0</span> : amountText}
          <span className="op-amount-currency"> €</span>
        </output>
      </div>

      <div className="op-body">
        <SegmentedControl
          label="Type d'opération"
          value={type}
          options={TYPE_OPTIONS}
          onChange={changeType}
        />

        {type === 'transfer' ? (
          <>
            <div className="op-field-row">
              <label className="op-field">
                <span className="op-field-label">Depuis</span>
                <select
                  value={effectiveFromAccountId ?? ''}
                  onChange={(event) => setFromAccountId(event.target.value)}
                >
                  {activeAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="op-field">
                <span className="op-field-label">Vers</span>
                <select
                  value={toAccountId ?? ''}
                  onChange={(event) => setToAccountId(event.target.value)}
                >
                  <option value="">Choisir…</option>
                  {activeAccounts
                    .filter((account) => account.id !== effectiveFromAccountId)
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>

            {destinationAccount?.countsAsSavings === true && (
              <p className="op-hint">Compté comme épargne, jamais comme une dépense.</p>
            )}
          </>
        ) : (
          <>
            <div className="op-section">
              <span className="op-field-label">Catégorie</span>
              <ChoiceGrid
                label="Catégorie"
                value={categoryId}
                options={categoryOptions}
                onChange={setCategoryId}
              />
            </div>

            <label className="op-field">
              <span className="op-field-label">Compte</span>
              <select
                value={effectiveAccountId ?? ''}
                onChange={(event) => setAccountId(event.target.value)}
              >
                {activeAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        <div className="op-field-row">
          <label className="op-field">
            <span className="op-field-label">Date</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>

          <label className="op-field">
            <span className="op-field-label">Libellé (facultatif)</span>
            <input
              type="text"
              value={label}
              placeholder="Ex. Décathlon"
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
        </div>

        {error !== undefined && <p className="op-error">{error}</p>}

        {isEditing && !isConfirmingDelete && (
          <button type="button" className="op-delete" onClick={() => setConfirmingDelete(true)}>
            Supprimer cette opération
          </button>
        )}
      </div>

      {/* La confirmation prend la place du clavier plutôt que de s'ajouter au
          formulaire : le clavier ne sert à rien à ce moment-là, et surtout, un
          bloc ajouté en bas d'une zone qui défile peut se retrouver hors de
          l'écran — avec ses boutons inaccessibles. */}
      <div className="op-footer">
        {isConfirmingDelete && transaction !== undefined ? (
          <div className="op-delete-confirm">
            <p>
              Supprimer définitivement cette opération de{' '}
              {formatEurosCompact(transaction.amount)} ?
            </p>
            <div className="op-delete-actions">
              <button type="button" onClick={() => setConfirmingDelete(false)}>
                Annuler
              </button>
              <button type="button" className="is-danger" onClick={() => void handleDelete()}>
                Supprimer
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="op-keypad" role="group" aria-label="Clavier numérique">
              {KEYPAD_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  className="op-key"
                  aria-label={key === 'backspace' ? 'Effacer' : key}
                  onClick={() => setAmountText((current) => appendAmountKey(current, key))}
                >
                  {key === 'backspace' ? '⌫' : key}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="op-submit"
              disabled={!canSave}
              onClick={() => void handleSubmit()}
            >
              {isSaving
                ? 'Enregistrement…'
                : isEditing
                  ? 'Enregistrer les modifications'
                  : 'Enregistrer'}
            </button>
          </>
        )}
      </div>
    </Sheet>
  )
}
