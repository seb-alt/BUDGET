/**
 * src/main.tsx
 *
 * Point d'entrée : c'est le tout premier fichier exécuté par le navigateur.
 *
 * On remplit la base de données AVANT d'afficher React, et volontairement en
 * dehors de React. Raison : en mode développement, React exécute deux fois le
 * code de démarrage des composants pour t'aider à repérer les bugs. Si le seed
 * était déclenché depuis un composant, il partirait deux fois en parallèle.
 * Ici il part une seule fois, proprement, avant le premier affichage.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App.tsx'
import { initTheme } from './app/theme'
import { syncMonthlyBudgets } from './db/budgets'
import { applyAutomaticRules } from './db/recurring'
import { seedInitialData } from './db/seed'
import './index.css'

async function start() {
  // Avant tout le reste : le script d'index.html a déjà posé le thème pour
  // éviter le clignement, on le reprend ici pour que React le connaisse.
  initTheme()

  try {
    const report = await seedInitialData()
    // Fige les mois révolus et remet la copie du mois en cours à jour (§11).
    const budgets = await syncMonthlyBudgets()
    // Crée les échéances automatiques en retard (§7). Sans effet si tout est
    // à jour : le moteur ne propose que ce qui manque réellement.
    const recurring = await applyAutomaticRules()
    console.info('[budget] base prête', report, budgets, recurring)
  } catch (error) {
    // On affiche quand même l'application : mieux vaut un écran vide qu'un écran blanc.
    console.error('[budget] échec du remplissage initial', error)
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void start()
