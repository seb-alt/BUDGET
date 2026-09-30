/**
 * src/features/settings/LoansSection.tsx
 *
 * Tes prêts : en ajouter, les modifier, les supprimer.
 *
 * Un prêt n'est relié à aucune opération. La mensualité que tu paies chaque
 * mois appartient à sa catégorie budgétaire — « Prêt étudiant », dans les
 * charges fixes — et le prêt, lui, ne sert qu'à répondre à « combien je dois
 * encore ». Les deux questions sont différentes, et c'est pour ça que
 * supprimer un prêt n'abîme jamais ton historique.
 *
 * Le capital restant dû se saisit à la main. L'application pourrait le
 * décrémenter toute seule de la mensualité, mais elle mentirait : une
 * mensualité paie d'abord des intérêts, et la part de capital remboursée varie
 * à chaque échéance. Mieux vaut un chiffre que tu recopies de ton relevé deux
 * fois par an qu'un chiffre faux tous les mois.
 */

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AmountField } from '../../components/ui/AmountField'
import { Field } from '../../components/ui/Field'
import { db } from '../../db/db'
import { deleteLoan, saveLoan, validateLoan } from '../../db/loans'
import type { Loan } from '../../db/types'
import { today } from '../../utils/date'
import { formatEurosCompact, fromCents, parseBalanceInput } from '../../utils/money'

const toInput = (cents?: number) =>
  cents === undefined ? '' : String(fromCents(cents)).replace('.', ',')

const frenchDate = (iso: string) => iso.split('-').reverse().join('/')

interface LoansSectionProps {
  onSaved: (message: string) => void
}

export function LoansSection({ onSaved }: LoansSectionProps) {
  const loans = useLiveQuery(() => db.loans.orderBy('order').toArray(), [])
  const [editing, setEditing] = useState<{ loan?: Loan }>()

  return (
    <div className="set-section">
      {loans === undefined || loans.length === 0 ? (
        <p className="ui-field-hint">
          Aucun prêt. En ajouter un fait apparaître ton capital restant dû dans l’onglet
          Patrimoine, et le déduit de ton patrimoine net.
        </p>
      ) : (
        <ul className="set-list">
          {loans.map((loan) => (
            <li key={loan.id}>
              <button
                type="button"
                className="set-rule"
                onClick={() => setEditing({ loan })}
                aria-label={`Modifier ${loan.name}`}
              >
                <span className="set-rule-name">{loan.name}</span>
                <span className="set-rule-meta">
                  {formatEurosCompact(loan.remainingCapital)} restants sur{' '}
                  {formatEurosCompact(loan.initialAmount)}
                  {loan.monthlyPayment > 0 &&
                    ` · ${formatEurosCompact(loan.monthlyPayment)}/mois`}
                  {` · revu le ${frenchDate(loan.lastUpdated)}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="set-outline" onClick={() => setEditing({})}>
        + Nouveau prêt
      </button>

      {editing !== undefined && (
        <LoanForm
          key={editing.loan?.id ?? 'nouveau'}
          loan={editing.loan}
          onClose={() => setEditing(undefined)}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}

function LoanForm({
  loan,
  onClose,
  onSaved,
}: {
  loan?: Loan
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [name, setName] = useState(loan?.name ?? '')
  const [initial, setInitial] = useState(toInput(loan?.initialAmount))
  const [monthly, setMonthly] = useState(toInput(loan?.monthlyPayment))
  const [remaining, setRemaining] = useState(toInput(loan?.remainingCapital))
  const [error, setError] = useState<string>()
  const [isSaving, setIsSaving] = useState(false)
  const [isConfirmingDelete, setConfirmingDelete] = useState(false)

  const draft = {
    name,
    initialAmount: parseBalanceInput(initial) ?? 0,
    monthlyPayment: parseBalanceInput(monthly) ?? 0,
    remainingCapital: parseBalanceInput(remaining) ?? 0,
    // Toute modification du capital restant dû redate le prêt : c'est cette
    // date qui dit si le chiffre affiché est encore d'actualité.
    lastUpdated: today(),
  }
  const problems = validateLoan(draft)

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
    <div className="set-inline-form">
      <Field label="Nom">
        {({ id }) => (
          <input
            id={id}
            type="text"
            placeholder="Ex. Prêt étudiant"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        )}
      </Field>

      <div className="set-grid">
        <AmountField
          label="Montant emprunté"
          value={initial}
          invalid={(parseBalanceInput(initial) ?? 0) <= 0}
          onChange={setInitial}
        />
        <AmountField
          label="Mensualité"
          value={monthly}
          invalid={parseBalanceInput(monthly) === null}
          onChange={setMonthly}
          hint="Indicative : elle n’entre dans aucun calcul de budget."
        />
        <AmountField
          label="Capital restant dû"
          value={remaining}
          invalid={parseBalanceInput(remaining) === null}
          onChange={setRemaining}
          hint="À recopier de ton relevé de prêt de temps en temps."
        />
      </div>

      {(error !== undefined || problems.length > 0) && (
        <p className="set-error">{error ?? problems[0]}</p>
      )}

      <div className="set-inline-actions">
        <button type="button" onClick={onClose}>
          Annuler
        </button>
        <button
          type="button"
          className="set-save"
          disabled={problems.length > 0 || isSaving}
          onClick={() =>
            void run(() => saveLoan(draft, loan?.id), loan ? 'Prêt modifié.' : 'Prêt ajouté.')
          }
        >
          {isSaving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>

      {loan !== undefined &&
        (isConfirmingDelete ? (
          <div className="mic-danger">
            <p>
              Supprimer « {loan.name} » ? Tes opérations de remboursement ne sont pas touchées :
              elles appartiennent à leur catégorie, pas au prêt.
            </p>
            <div className="mic-danger-actions">
              <button type="button" onClick={() => setConfirmingDelete(false)}>
                Annuler
              </button>
              <button
                type="button"
                className="is-danger"
                onClick={() => void run(() => deleteLoan(loan.id), 'Prêt supprimé.')}
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
            Supprimer ce prêt
          </button>
        ))}
    </div>
  )
}
