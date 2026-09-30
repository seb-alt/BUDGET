/**
 * src/app/ThemeToggle.tsx
 *
 * Le bouton soleil / lune, en haut de l'écran.
 *
 * DEUX DÉCISIONS QUI MÉRITENT UN MOT.
 *
 * 1. L'ICÔNE MONTRE CE QUE TU VAS OBTENIR, pas ce que tu as. En clair, elle
 *    affiche une lune : « appuie pour passer en sombre ». C'est le geste qui
 *    compte, pas l'état — l'état, tu l'as sous les yeux, c'est l'écran.
 *
 * 2. LE BOUTON N'A QUE DEUX POSITIONS, alors que le réglage en a trois. Un
 *    bouton unique qui ferait défiler automatique → clair → sombre obligerait
 *    à appuyer plusieurs fois pour deviner où on est. Ici il alterne
 *    simplement, et « Automatique » reste accessible dans les Paramètres, avec
 *    son nom écrit en toutes lettres.
 */

import { setThemeChoice, useResolvedTheme } from './theme'

export function ThemeToggle() {
  const resolved = useResolvedTheme()
  const next = resolved === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      className="app-icon-button"
      // Le libellé annonce l'action, pas l'état : c'est ce qu'un lecteur
      // d'écran doit entendre avant d'appuyer.
      aria-label={next === 'dark' ? 'Passer en mode sombre' : 'Passer en mode clair'}
      title={next === 'dark' ? 'Mode sombre' : 'Mode clair'}
      onClick={() => setThemeChoice(next)}
    >
      {next === 'dark' ? (
        // Un croissant, obtenu en creusant un disque : aucune confusion
        // possible avec l'engrenage voisin.
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          <path
            d="M18 13.4A7.6 7.6 0 0 1 8.6 4a7.6 7.6 0 1 0 9.4 9.4Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="4" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M11 1.8v2.4M11 17.8v2.4M20.2 11h-2.4M4.2 11H1.8M17.5 4.5l-1.7 1.7M6.2 15.8l-1.7 1.7M17.5 17.5l-1.7-1.7M6.2 6.2 4.5 4.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  )
}
