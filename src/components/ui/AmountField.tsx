/**
 * src/components/ui/AmountField.tsx
 *
 * Un champ de saisie avec son unité et son état d'erreur. Utilisé partout où
 * l'on tape des euros au clavier (réglages, soldes) — l'écran de saisie d'une
 * opération, lui, a son propre clavier intégré.
 *
 * L'étiquette est reliée au champ par `htmlFor`/`id`, et le texte d'aide par
 * `aria-describedby`. Sans cette distinction, un lecteur d'écran annoncerait
 * l'aide COMME SI c'était le nom du champ : « Shopping Sert de repère pour
 * équilibrer ton budget… ». Le nom doit rester court ; l'aide vient après.
 */

import { useId } from 'react'
import './ui.css'

interface AmountFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  /** Bordure rouge tant que la saisie n'est pas valable. */
  invalid?: boolean
  /** Unité affichée à droite. Chaîne vide pour n'en afficher aucune. */
  suffix?: string
  hint?: string
  inputMode?: 'decimal' | 'numeric' | 'text'
}

export function AmountField({
  label,
  value,
  onChange,
  invalid = false,
  suffix = '€',
  hint,
  inputMode = 'decimal',
}: AmountFieldProps) {
  const id = useId()
  const hintId = `${id}-hint`

  return (
    <div className="ui-amount-field">
      <label className="ui-field-label" htmlFor={id}>
        {label}
      </label>
      <div className={`ui-amount${invalid ? ' is-invalid' : ''}`}>
        <input
          id={id}
          type="text"
          inputMode={inputMode}
          value={value}
          aria-describedby={hint === undefined ? undefined : hintId}
          onChange={(event) => onChange(event.target.value)}
        />
        {suffix !== '' && <span aria-hidden="true">{suffix}</span>}
      </div>
      {hint !== undefined && (
        <span className="ui-field-hint" id={hintId}>
          {hint}
        </span>
      )}
    </div>
  )
}
