/**
 * src/features/settings/SavingsSection.tsx
 *
 * Les réglages qui pilotent le moteur d'épargne, et le prêt étudiant.
 *
 * Le seuil LEP n'est pas écrit en dur dans le code : si le plafond
 * réglementaire change, tu le mets à jour ici et toute la répartition suit.
 */

import { useState } from 'react'
import { AmountField } from '../../components/ui/AmountField'
import { updateSavingsSettings } from '../../db/settings'
import type { Settings } from '../../db/types'
import { fromCents, parseBalanceInput } from '../../utils/money'
import { today } from '../../utils/date'

const toInput = (cents: number) => String(fromCents(cents)).replace('.', ',')

interface SavingsSectionProps {
  settings: Settings
  onSaved: (message: string) => void
}

export function SavingsSection({ settings, onSaved }: SavingsSectionProps) {
  const [threshold, setThreshold] = useState(toInput(settings.lepThreshold))
  const [assuranceVie, setAssuranceVie] = useState(toInput(settings.assuranceVieMonthly))
  const [loanInitial, setLoanInitial] = useState(toInput(settings.studentLoan.initialAmount))
  const [loanMonthly, setLoanMonthly] = useState(toInput(settings.studentLoan.monthlyPayment))
  const [loanRemaining, setLoanRemaining] = useState(toInput(settings.studentLoan.remainingCapital))
  const [error, setError] = useState<string>()
  const [isSaving, setIsSaving] = useState(false)

  const fields = [threshold, assuranceVie, loanInitial, loanMonthly, loanRemaining]
  const hasInvalid = fields.some((field) => parseBalanceInput(field) === null)

  async function handleSave() {
    if (hasInvalid) {
      setError('Certains montants ne sont pas valables.')
      return
    }

    setIsSaving(true)
    setError(undefined)
    try {
      await updateSavingsSettings({
        lepThreshold: parseBalanceInput(threshold)!,
        assuranceVieMonthly: parseBalanceInput(assuranceVie)!,
        studentLoan: {
          initialAmount: parseBalanceInput(loanInitial)!,
          monthlyPayment: parseBalanceInput(loanMonthly)!,
          remainingCapital: parseBalanceInput(loanRemaining)!,
          lastUpdated: today(),
        },
      })
      onSaved('Réglages d’épargne enregistrés.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "L'enregistrement a échoué.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="set-section">
      <div className="set-grid">
        <AmountField
          label="Seuil du LEP"
          value={threshold}
          invalid={parseBalanceInput(threshold) === null}
          onChange={setThreshold}
          hint="Tant que le LEP est sous ce seuil, l'épargne flexible l'alimente en priorité."
        />
        <AmountField
          label="Assurance-vie par mois"
          value={assuranceVie}
          invalid={parseBalanceInput(assuranceVie) === null}
          onChange={setAssuranceVie}
          hint="Versement incompressible : il ne varie pas avec tes revenus."
        />
      </div>

      <h3 className="set-subtitle">Prêt étudiant</h3>
      <div className="set-grid">
        <AmountField
          label="Montant initial"
          value={loanInitial}
          invalid={parseBalanceInput(loanInitial) === null}
          onChange={setLoanInitial}
        />
        <AmountField
          label="Mensualité"
          value={loanMonthly}
          invalid={parseBalanceInput(loanMonthly) === null}
          onChange={setLoanMonthly}
        />
        <AmountField
          label="Capital restant dû"
          value={loanRemaining}
          invalid={parseBalanceInput(loanRemaining) === null}
          onChange={setLoanRemaining}
          hint="À recaler de temps en temps depuis ton relevé de prêt."
        />
      </div>

      {error !== undefined && <p className="set-error">{error}</p>}

      <button type="button" className="set-save" disabled={isSaving} onClick={() => void handleSave()}>
        {isSaving ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </div>
  )
}
