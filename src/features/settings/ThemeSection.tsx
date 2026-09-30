/**
 * src/features/settings/ThemeSection.tsx
 *
 * Le réglage complet du thème, avec ses trois choix nommés.
 *
 * Le bouton soleil / lune du haut de l'écran ne fait qu'alterner clair et
 * sombre. C'est ici qu'on revient à « Automatique » — et c'est pour ça que
 * cette section existe : sans elle, le premier appui sur le bouton retirerait
 * définitivement la possibilité de suivre le réglage du téléphone.
 */

import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { setThemeChoice, useThemeChoice, type ThemeChoice } from '../../app/theme'

const OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: 'auto', label: 'Automatique' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
]

export function ThemeSection() {
  const choice = useThemeChoice()

  return (
    <div className="set-section">
      <SegmentedControl
        label="Thème"
        value={choice}
        options={OPTIONS}
        onChange={setThemeChoice}
      />

      <p className="ui-field-hint">
        {choice === 'auto'
          ? 'L’application suit le réglage de ton téléphone : elle passera en sombre en même temps que lui.'
          : 'Ce choix ne concerne que cet appareil. Il n’est pas emporté par les sauvegardes — tu peux garder le sombre sur ton téléphone et le clair ailleurs.'}
      </p>
    </div>
  )
}
