/**
 * src/components/ui/Field.tsx
 *
 * Une étiquette, un champ, un texte d'aide — correctement reliés.
 *
 * Ce composant existe parce que l'erreur se répète dès qu'on écrit le balisage
 * à la main : en enveloppant simplement le champ dans un `<label>`, le texte
 * d'aide est absorbé dans le NOM du champ. Un lecteur d'écran annonce alors
 * « Échéance Déduite du délai de 30 jours » comme s'il s'agissait du nom.
 *
 * Ici l'étiquette est reliée par `htmlFor`/`id` et l'aide par
 * `aria-describedby` : le nom reste court, l'aide vient après.
 *
 * Le champ est fourni en fonction pour que le composant puisse lui passer son
 * identifiant, quel que soit son type — liste déroulante, date, texte.
 */

import { useId, type ReactNode } from 'react'
import './ui.css'

interface FieldProps {
  label: string
  hint?: string
  children: (props: { id: string; describedBy: string | undefined }) => ReactNode
}

export function Field({ label, hint, children }: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`

  return (
    <div className="ui-amount-field">
      <label className="ui-field-label" htmlFor={id}>
        {label}
      </label>
      <div className="ui-amount">
        {children({ id, describedBy: hint === undefined ? undefined : hintId })}
      </div>
      {hint !== undefined && (
        <span className="ui-field-hint" id={hintId}>
          {hint}
        </span>
      )}
    </div>
  )
}
