/**
 * src/components/ui/Sheet.tsx
 *
 * Le panneau qui se superpose à l'application : plein écran sur mobile,
 * fenêtre centrée sur ordinateur.
 *
 * Il gère aussi les détails d'accessibilité qu'on oublie facilement :
 * fermeture avec la touche Échap, clic sur le fond, et blocage du défilement
 * de la page derrière.
 */

import { useEffect, type ReactNode } from 'react'
import './ui.css'

interface SheetProps {
  title: string
  onClose: () => void
  children: ReactNode
}

export function Sheet({ title, onClose, children }: SheetProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <div
      className="ui-sheet-backdrop"
      // Un clic sur le fond ferme ; un clic à l'intérieur ne doit pas fermer,
      // d'où la comparaison entre la cible et l'élément courant.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="ui-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <header className="ui-sheet-header">
          <button type="button" className="ui-sheet-close" onClick={onClose} aria-label="Fermer">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <h2 className="ui-sheet-title">{title}</h2>
        </header>
        {children}
      </div>
    </div>
  )
}
