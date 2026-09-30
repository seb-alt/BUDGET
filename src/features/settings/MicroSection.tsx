/**
 * src/features/settings/MicroSection.tsx
 *
 * Les réglages de la micro-entreprise (§9).
 * Le taux URSSAF n'est jamais écrit en dur : il change régulièrement.
 */

import { useState } from 'react'
import { AmountField } from '../../components/ui/AmountField'
import { updateMicroSettings } from '../../db/settings'
import type { MicroSettings } from '../../db/types'
import { formatPercent, parsePercent } from '../../domain/settings/settingsRules'

interface MicroSectionProps {
  microSettings: MicroSettings
  onSaved: (message: string) => void
}

export function MicroSection({ microSettings, onSaved }: MicroSectionProps) {
  const [rate, setRate] = useState(formatPercent(microSettings.urssafRate))
  const [term, setTerm] = useState(String(microSettings.defaultPaymentTermDays))
  const [prefix, setPrefix] = useState(microSettings.invoiceNumberPrefix)
  const [acre, setAcre] = useState(microSettings.acreEnabled)
  const [error, setError] = useState<string>()
  const [isSaving, setIsSaving] = useState(false)

  const parsedRate = parsePercent(rate)
  const parsedTerm = /^\d+$/.test(term.trim()) ? Number(term.trim()) : null

  async function handleSave() {
    if (parsedRate === null || parsedTerm === null) {
      setError('Vérifie le taux et le délai de paiement.')
      return
    }

    setIsSaving(true)
    setError(undefined)
    try {
      await updateMicroSettings({
        urssafRate: parsedRate,
        acreEnabled: acre,
        defaultPaymentTermDays: parsedTerm,
        invoiceNumberPrefix: prefix.trim(),
      })
      onSaved('Réglages micro enregistrés.')
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
          label="Taux URSSAF"
          value={rate}
          suffix="%"
          invalid={parsedRate === null}
          onChange={setRate}
          hint="Avant impôt sur le revenu personnel."
        />
        <AmountField
          label="Délai de paiement"
          value={term}
          suffix="jours"
          inputMode="numeric"
          invalid={parsedTerm === null}
          onChange={setTerm}
          hint="Valeur par défaut d'une nouvelle facture."
        />
        <AmountField
          label="Préfixe des factures"
          value={prefix}
          suffix=""
          inputMode="text"
          onChange={setPrefix}
        />
      </div>

      <label className="set-check">
        <input type="checkbox" checked={acre} onChange={(e) => setAcre(e.target.checked)} />
        <span>Bénéficier de l'ACRE (taux réduit)</span>
      </label>

      {error !== undefined && <p className="set-error">{error}</p>}

      <button type="button" className="set-save" disabled={isSaving} onClick={() => void handleSave()}>
        {isSaving ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </div>
  )
}
