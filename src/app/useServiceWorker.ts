/**
 * src/app/useServiceWorker.ts
 *
 * Installe le service worker et prévient quand une nouvelle version est prête.
 *
 * Pourquoi une bannière plutôt qu'un rechargement automatique : recharger la
 * page sans prévenir ferait disparaître une saisie en cours. C'est toi qui
 * décides du moment.
 *
 * L'identifiant de build est injecté à la compilation (voir vite.config.ts).
 * Il fait partie de l'adresse du service worker : un nouveau build produit une
 * nouvelle adresse, donc un nouveau service worker, donc un cache neuf et la
 * suppression des anciens. C'est ce qui évite qu'une application installée
 * reste figée sur une vieille version.
 */

import { useEffect, useState } from 'react'


export interface ServiceWorkerState {
  /** Une nouvelle version attend d'être activée. */
  updateReady: boolean
  /** Active la nouvelle version et recharge la page. */
  applyUpdate: () => void
}

export function useServiceWorker(): ServiceWorkerState {
  const [waiting, setWaiting] = useState<ServiceWorker>()

  useEffect(() => {
    // En développement, le service worker masquerait les modifications en
    // cours : on ne l'installe qu'en production.
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

    let cancelled = false

    void navigator.serviceWorker
      .register(`/sw.js?v=${__BUILD_ID__}`)
      .then((registration) => {
        if (cancelled) return

        // Une version déjà en attente au chargement de la page.
        if (registration.waiting !== null && navigator.serviceWorker.controller !== null) {
          setWaiting(registration.waiting)
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing
          if (installing === null) return

          installing.addEventListener('statechange', () => {
            // `controller` est nul à la toute première installation : il n'y a
            // alors rien à « mettre à jour », c'est la version initiale.
            if (installing.state === 'installed' && navigator.serviceWorker.controller !== null) {
              setWaiting(installing)
            }
          })
        })
      })
      .catch(() => {
        // Un service worker indisponible n'empêche rien : l'application
        // fonctionne, elle ne sera simplement pas utilisable hors connexion.
      })

    return () => {
      cancelled = true
    }
  }, [])

  return {
    updateReady: waiting !== undefined,
    applyUpdate: () => {
      if (waiting === undefined) return

      let reloaded = false
      const reload = () => {
        if (reloaded) return
        reloaded = true
        window.location.reload()
      }

      // Le rechargement suit l'activation, pas l'inverse : recharger trop tôt
      // rechargerait l'ancienne version.
      navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true })
      waiting.postMessage('SKIP_WAITING')

      // Filet de sécurité : si l'activation ne se signale pas (un service
      // worker déjà actif, par exemple), le bouton doit quand même faire
      // quelque chose plutôt que de rester mort sous le doigt.
      setTimeout(reload, 3000)
    },
  }
}
