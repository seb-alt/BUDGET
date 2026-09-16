/**
 * src/components/ui/ChoiceGrid.tsx
 *
 * Une liste de boutons dont un seul peut être actif — les catégories de
 * l'écran de saisie. Des boutons plutôt qu'un menu déroulant : un seul geste
 * au lieu de trois, et on voit tous les choix d'un coup.
 */

import './ui.css'

interface ChoiceGridProps {
  label: string
  value: string | undefined
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}

export function ChoiceGrid({ label, value, options, onChange }: ChoiceGridProps) {
  return (
    <div className="ui-choices" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="ui-choice"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
