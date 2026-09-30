/**
 * src/features/settings/BudgetSection.tsx
 *
 * Le budget mensuel de référence : un montant par sous-catégorie.
 *
 * Deux points à savoir :
 *  - l'enveloppe flexible LEP/PEA n'est PAS saisissable : son montant est
 *    recalculé chaque mois par le moteur (§4) à partir de tes revenus réels ;
 *  - le total est comparé à tes revenus de référence, à titre indicatif. Un
 *    écart n'est pas une erreur : c'est peut-être exactement ce que tu veux.
 */

import { useState } from 'react'
import { AmountField } from '../../components/ui/AmountField'
import { updateBudget } from '../../db/settings'
import type { Category, Settings } from '../../db/types'
import { formatEurosCompact, fromCents, parseBalanceInput } from '../../utils/money'

const toInput = (cents: number) => String(fromCents(cents)).replace('.', ',')

interface BudgetSectionProps {
  settings: Settings
  categories: Category[]
  onSaved: (message: string) => void
}

export function BudgetSection({ settings, categories, onSaved }: BudgetSectionProps) {
  const budgeted = categories.filter(
    (category) =>
      category.active &&
      (category.kind === 'saving' || category.group === 'chargesFixes' || category.group === 'loisirs'),
  )

  const [income, setIncome] = useState(toInput(settings.referenceIncome))
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      budgeted.map((category) => [
        category.id,
        toInput(settings.budgetTemplate.find((l) => l.categoryId === category.id)?.amount ?? 0),
      ]),
    ),
  )
  const [error, setError] = useState<string>()
  const [isSaving, setIsSaving] = useState(false)

  const isFlexible = (id: string) => id === settings.flexibleSavingsCategoryId
  const parsed = (id: string) => parseBalanceInput(amounts[id] ?? '0')

  const total = budgeted
    .filter((category) => !isFlexible(category.id))
    .reduce((sum, category) => sum + (parsed(category.id) ?? 0), 0)
  const parsedIncome = parseBalanceInput(income)

  const hasInvalid =
    parsedIncome === null ||
    budgeted.some((category) => !isFlexible(category.id) && parsed(category.id) === null)

  async function handleSave() {
    if (hasInvalid) {
      setError('Certains montants ne sont pas valables.')
      return
    }

    setIsSaving(true)
    setError(undefined)
    try {
      await updateBudget({
        referenceIncome: parsedIncome,
        lines: budgeted.map((category) => ({
          categoryId: category.id,
          // L'enveloppe flexible garde sa valeur enregistrée : elle sera de
          // toute façon recalculée à l'affichage.
          amount: isFlexible(category.id)
            ? (settings.budgetTemplate.find((l) => l.categoryId === category.id)?.amount ?? 0)
            : (parsed(category.id) ?? 0),
        })),
      })
      onSaved('Budget enregistré.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "L'enregistrement a échoué.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="set-section">
      <AmountField
        label="Revenus de référence"
        value={income}
        invalid={parsedIncome === null}
        onChange={setIncome}
        hint="Sert de repère pour équilibrer ton budget. Le calcul réel utilise tes revenus encaissés."
      />

      <div className="set-grid">
        {budgeted.map((category) =>
          isFlexible(category.id) ? (
            <div key={category.id} className="set-computed">
              <span className="ui-field-label">{category.name}</span>
              <p>
                Calculé chaque mois : ce qui reste après les charges fixes, les loisirs et
                l'assurance-vie.
              </p>
            </div>
          ) : (
            <AmountField
              key={category.id}
              label={category.name}
              value={amounts[category.id] ?? ''}
              invalid={parsed(category.id) === null}
              onChange={(value) => setAmounts((current) => ({ ...current, [category.id]: value }))}
            />
          ),
        )}
      </div>

      <p className="set-total">
        Total hors enveloppe flexible : <strong>{formatEurosCompact(total)}</strong>
        {parsedIncome !== null && (
          <>
            {' · '}
            {total === parsedIncome
              ? 'égal à tes revenus de référence'
              : total < parsedIncome
                ? `${formatEurosCompact(parsedIncome - total)} iront à l'enveloppe flexible`
                : `${formatEurosCompact(total - parsedIncome)} au-dessus de tes revenus de référence`}
          </>
        )}
      </p>

      {error !== undefined && <p className="set-error">{error}</p>}

      <button type="button" className="set-save" disabled={isSaving} onClick={() => void handleSave()}>
        {isSaving ? 'Enregistrement…' : 'Enregistrer le budget'}
      </button>
    </div>
  )
}
