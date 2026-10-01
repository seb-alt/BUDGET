/**
 * src/features/settings/SavingsSection.tsx
 *
 * Les réglages qui pilotent le moteur d'épargne.
 *
 * Les prêts ont leur propre section : une dette n'est pas un réglage, on en
 * contracte et on en solde.
 *
 * Le seuil LEP n'est pas écrit en dur dans le code : si le plafond
 * réglementaire change, tu le mets à jour ici et toute la répartition suit.
 */

import { useState } from 'react'
import { AmountField } from '../../components/ui/AmountField'
import { updateSavingsSettings } from '../../db/settings'
import type { Settings } from '../../db/types'
import { fromCents, parseBalanceInput } from '../../utils/money'

const toInput = (cents: number) => String(fromCents(cents)).replace('.', ',')

interface SavingsSectionProps {
  settings: Settings
  onSaved: (message: string) => void
}

export function SavingsSection({ settings, onSaved }: SavingsSectionProps) {
  const [threshold, setThreshold] = useState(toInput(settings.lepThreshold))
  const [error, setError] = useState<string>()
  const [isSaving, setIsSaving] = useState(false)

  const fields = [threshold]
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
        // Conservé pour les photos de budget déjà figées, mais ce réglage ne
        // pilote plus aucun calcul : le versement assurance-vie est une ligne
        // de budget comme une autre.
        assuranceVieMonthly: settings.assuranceVieMonthly,
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
      </div>

      {error !== undefined && <p className="set-error">{error}</p>}

      <button
        type="button"
        className="set-save"
        disabled={isSaving}
        onClick={() => void handleSave()}
      >
        {isSaving ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </div>
  )
}
