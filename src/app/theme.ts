/**
 * src/app/theme.ts
 *
 * Le choix du thème : automatique, clair ou sombre.
 *
 * TROIS ÉTATS, PAS DEUX. « Automatique » suit le réglage de ton téléphone ou
 * de ton ordinateur — clair le jour, sombre le soir si tu l'as réglé ainsi.
 * C'est l'état de départ, et il faut pouvoir y revenir : un bouton qui ne
 * ferait qu'alterner clair/sombre supprimerait définitivement cette
 * possibilité dès le premier appui.
 *
 * POURQUOI `localStorage` ET PAS LA BASE. Deux raisons.
 *
 * 1. C'est une préférence D'APPAREIL, pas une donnée de budget. Tu peux
 *    vouloir le sombre sur ton téléphone et le clair sur ton ordinateur.
 *    Rangée dans la base, elle partirait dans les sauvegardes et s'imposerait
 *    à l'appareil sur lequel tu restaures.
 *
 * 2. `localStorage` se lit INSTANTANÉMENT, avant même que React démarre. La
 *    base, elle, est asynchrone : l'application s'afficherait en clair pendant
 *    une fraction de seconde avant de basculer. C'est exactement le clignement
 *    désagréable que le petit script d'index.html évite.
 */

import { useSyncExternalStore } from 'react'

export type ThemeChoice = 'auto' | 'light' | 'dark'

/** La même clé que dans le script d'index.html. Les deux doivent rester d'accord. */
const STORAGE_KEY = 'budget-theme'

const THEME_COLORS: Record<'light' | 'dark', string> = {
  light: '#f4f3f1',
  dark: '#141413',
}

function isChoice(value: string | null): value is ThemeChoice {
  return value === 'auto' || value === 'light' || value === 'dark'
}

function read(): ThemeChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isChoice(stored) ? stored : 'auto'
  } catch {
    // Navigation privée, ou stockage refusé : on suit le système.
    return 'auto'
  }
}

const darkQuery = (): MediaQueryList | undefined =>
  typeof window === 'undefined' ? undefined : window.matchMedia('(prefers-color-scheme: dark)')

/** Le thème réellement appliqué, une fois « automatique » résolu. */
export function resolve(choice: ThemeChoice): 'light' | 'dark' {
  if (choice !== 'auto') return choice
  return darkQuery()?.matches === true ? 'dark' : 'light'
}

/**
 * Pose l'attribut lu par index.css, et met à jour la couleur de la barre
 * d'état du téléphone — sans elle, le haut de l'écran resterait clair autour
 * d'une application sombre.
 */
function apply(choice: ThemeChoice): void {
  if (choice === 'auto') {
    delete document.documentElement.dataset.theme
  } else {
    document.documentElement.dataset.theme = choice
  }

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLORS[resolve(choice)])
}

let current: ThemeChoice = 'auto'
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function setThemeChoice(choice: ThemeChoice): void {
  current = choice
  try {
    localStorage.setItem(STORAGE_KEY, choice)
  } catch {
    // Le thème s'applique quand même, il ne sera simplement pas retenu.
  }
  apply(choice)
  emit()
}

/**
 * À appeler une fois au démarrage, avant le rendu.
 *
 * Le script d'index.html a déjà posé l'attribut pour éviter le clignement ;
 * ici on récupère la valeur pour que React la connaisse, et on écoute les
 * changements de réglage du système — utile en mode automatique, quand le
 * téléphone bascule tout seul au coucher du soleil.
 */
export function initTheme(): void {
  current = read()
  apply(current)
  // `emit` suffit : la couleur de la barre d'état est recalculée par `apply`,
  // et les composants qui affichent une icône de soleil ou de lune doivent
  // être prévenus.
  darkQuery()?.addEventListener('change', () => {
    apply(current)
    emit()
  })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => 'auto',
  )
}

export function useResolvedTheme(): 'light' | 'dark' {
  return resolve(useThemeChoice())
}
