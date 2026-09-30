/**
 * src/features/settings/RecurringRuleSheet.tsx
 *
 * Création et modification d'une règle récurrente (§7).
 *
 * Le champ le plus important est le MODE :
 *  - automatique : l'opération se crée toute seule, pour ce qui tombe à coup
 *    sûr (loyer, prêt, abonnement) ;
 *  - à confirmer : elle est proposée et attend ton accord, pour ce qui varie
 *    ou peut ne pas avoir lieu.
 */

import { useState } from 'react'
import { AmountField } from '../../components/ui/AmountField'
import { Field } from '../../components/ui/Field'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { Sheet } from '../../components/ui/Sheet'
import { deleteRule, saveRule, validateRule } from '../../db/recurring'
import type {
  Account,
  Category,
  Frequency,
  RecurringMode,
  RecurringRule,
  TransactionType,
} from '../../db/types'
import { today } from '../../utils/date'
import { fromCents, parseBalanceInput } from '../../utils/money'

const TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: 'expense', label: 'Dépense' },
  { value: 'income', label: 'Entrée' },
  { value: 'transfer', label: 'Transfert' },
]

const MODE_OPTIONS: { value: RecurringMode; label: string }[] = [
  { value: 'auto', label: 'Automatique' },
  { value: 'confirm', label: 'À confirmer' },
]

const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'monthly', label: 'Chaque mois' },
  { value: 'weekly', label: 'Chaque semaine' },
  { value: 'yearly', label: 'Chaque année' },
]

const toInput = (cents?: number) =>
  cents === undefined ? '' : String(fromCents(cents)).replace('.', ',')

interface RecurringRuleSheetProps {
  rule?: RecurringRule
  categories: Category[]
  accounts: Account[]
  defaultAccountId: string
  onClose: () => void
  onSaved: (message: string) => void
}

export function RecurringRuleSheet({
  rule,
  categories,
  accounts,
  defaultAccountId,
  onClose,
  onSaved,
}: RecurringRuleSheetProps) {
  const [name, setName] = useState(rule?.name ?? '')
  const [type, setType] = useState<TransactionType>(rule?.type ?? 'expense')
  const [amount, setAmount] = useState(toInput(rule?.amount))
  const [categoryId, setCategoryId] = useState(rule?.categoryId)
  const [accountId, setAccountId] = useState(rule?.accountId ?? defaultAccountId)
  const [fromAccountId, setFromAccountId] = useState(rule?.fromAccountId ?? defaultAccountId)
  const [toAccountId, setToAccountId] = useState(rule?.toAccountId ?? '')
  const [frequency, setFrequency] = useState<Frequency>(rule?.frequency ?? 'monthly')
  const [dayOfMonth, setDayOfMonth] = useState(String(rule?.dayOfMonth ?? 5))
  const [startDate, setStartDate] = useState(rule?.startDate ?? today())
  const [endDate, setEndDate] = useState(rule?.endDate ?? '')
  const [mode, setMode] = useState<RecurringMode>(rule?.mode ?? 'auto')
  const [error, setError] = useState<string>()
  const [isSaving, setIsSaving] = useState(false)
  const [isConfirmingDelete, setConfirmingDelete] = useState(false)

  const activeAccounts = accounts.filter((account) => account.active)
  const categoryOptions = categories.filter(
    (category) =>
      category.active && category.kind === (type === 'income' ? 'income' : 'expense'),
  )

  const draft = {
    name,
    type,
    amount: parseBalanceInput(amount) ?? 0,
    frequency,
    dayOfMonth: Number(dayOfMonth) || 0,
    startDate,
    endDate: endDate === '' ? undefined : endDate,
    active: rule?.active ?? true,
    mode,
    skippedDates: rule?.skippedDates,
    ...(type === 'transfer'
      ? { fromAccountId, toAccountId: toAccountId === '' ? undefined : toAccountId }
      : { categoryId, accountId }),
  }
  const problems = validateRule(draft)

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
    <Sheet title={rule ? 'Modifier la règle' : 'Nouvelle règle'} onClose={onClose}>
      <div className="mic-form">
        <Field label="Nom">
          {({ id }) => (
            <input
              id={id}
              type="text"
              placeholder="Ex. Loyer"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>

        <SegmentedControl
          label="Type d'opération"
          value={type}
          options={TYPE_OPTIONS}
          onChange={(next) => {
            setType(next)
            setCategoryId(undefined)
          }}
        />

        <div className="mic-form-row">
          <AmountField
            label="Montant"
            value={amount}
            invalid={(parseBalanceInput(amount) ?? 0) <= 0}
            onChange={setAmount}
          />
          {type === 'transfer' ? (
            <Field label="Vers">
              {({ id }) => (
                <select
                  id={id}
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                >
                  <option value="">Choisir…</option>
                  {activeAccounts
                    .filter((account) => account.id !== fromAccountId)
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                </select>
              )}
            </Field>
          ) : (
            <Field label="Catégorie">
              {({ id }) => (
                <select
                  id={id}
                  value={categoryId ?? ''}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  <option value="">Choisir…</option>
                  {categoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
        </div>

        <Field label={type === 'transfer' ? 'Depuis' : 'Compte'}>
          {({ id }) => (
            <select
              id={id}
              value={type === 'transfer' ? fromAccountId : accountId}
              onChange={(event) =>
                type === 'transfer'
                  ? setFromAccountId(event.target.value)
                  : setAccountId(event.target.value)
              }
            >
              {activeAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          )}
        </Field>

        <div className="mic-form-row">
          <Field label="Fréquence">
            {({ id }) => (
              <select
                id={id}
                value={frequency}
                onChange={(event) => setFrequency(event.target.value as Frequency)}
              >
                {FREQUENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </Field>

          {frequency === 'weekly' ? (
            <Field label="Jour" hint="Celui de la date de début.">
              {({ id, describedBy }) => (
                <input id={id} type="text" aria-describedby={describedBy} value="—" disabled />
              )}
            </Field>
          ) : (
            <AmountField
              label="Jour du mois"
              value={dayOfMonth}
              suffix=""
              inputMode="numeric"
              invalid={Number(dayOfMonth) < 1 || Number(dayOfMonth) > 31}
              onChange={setDayOfMonth}
              hint="Un 31 devient le dernier jour des mois plus courts."
            />
          )}
        </div>

        <div className="mic-form-row">
          <Field label="À partir du">
            {({ id }) => (
              <input
                id={id}
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            )}
          </Field>
          <Field label="Jusqu'au" hint="Facultatif.">
            {({ id, describedBy }) => (
              <input
                id={id}
                type="date"
                aria-describedby={describedBy}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            )}
          </Field>
        </div>

        <div className="set-section" style={{ padding: 0, gap: 'var(--space-2)' }}>
          <span className="ui-field-label">Mode</span>
          <SegmentedControl
            label="Mode"
            value={mode}
            options={MODE_OPTIONS}
            onChange={setMode}
          />
          <span className="ui-field-hint">
            {mode === 'auto'
              ? "L'opération se crée toute seule, sans rien te demander."
              : "L'opération est proposée sur l'accueil et attend ton accord."}
          </span>
        </div>

        {(error !== undefined || problems.length > 0) && (
          <p className="mic-error">{error ?? problems[0]}</p>
        )}

        {rule !== undefined &&
          (isConfirmingDelete ? (
            <div className="mic-danger">
              <p>
                Supprimer la règle « {rule.name} » ? Les opérations déjà créées sont conservées.
              </p>
              <div className="mic-danger-actions">
                <button type="button" onClick={() => setConfirmingDelete(false)}>
                  Annuler
                </button>
                <button
                  type="button"
                  className="is-danger"
                  onClick={() => void run(() => deleteRule(rule.id), 'Règle supprimée.')}
                >
                  Supprimer
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="mic-delete"
              onClick={() => setConfirmingDelete(true)}
            >
              Supprimer cette règle
            </button>
          ))}
      </div>

      <div className="mic-footer">
        <button
          type="button"
          className="mic-submit"
          disabled={problems.length > 0 || isSaving}
          onClick={() =>
            void run(() => saveRule(draft, rule?.id), rule ? 'Règle modifiée.' : 'Règle créée.')
          }
        >
          {isSaving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </Sheet>
  )
}
