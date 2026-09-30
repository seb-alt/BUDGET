/**
 * public/sw.js — le service worker.
 *
 * Un petit programme qui vit à côté de l'application et intercepte ses
 * requêtes réseau. C'est lui qui permet d'ouvrir Budget sans connexion.
 *
 * ---------------------------------------------------------------------------
 * LE PIÈGE CLASSIQUE, ET COMMENT IL EST ÉVITÉ ICI
 * ---------------------------------------------------------------------------
 * Une application installée peut rester figée sur une ancienne version pour
 * toujours, parce que son service worker sert indéfiniment de vieux fichiers.
 * C'est la panne la plus pénible d'une PWA : rien ne signale l'erreur.
 *
 * Deux garde-fous :
 *
 *  1. Le nom du cache vient de l'identifiant de build passé dans l'adresse de
 *     ce fichier (`sw.js?v=...`). Un nouveau build change cette adresse, donc
 *     le navigateur installe un NOUVEAU service worker, qui crée un nouveau
 *     cache et supprime tous les anciens.
 *
 *  2. La page elle-même est servie RÉSEAU D'ABORD. Dès que tu as du réseau, tu
 *     obtiens la dernière version ; le cache ne sert que de filet hors ligne.
 *
 * Les fichiers de `/assets/` portent une empreinte dans leur nom : leur contenu
 * ne change jamais à nom égal. Ils peuvent donc être servis depuis le cache
 * sans risque, et c'est ce qui rend le démarrage instantané.
 */

const BUILD = new URL(self.location.href).searchParams.get('v') ?? 'dev'
const CACHE = `budget-${BUILD}`

/** Le strict minimum pour afficher quelque chose hors ligne. */
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png']

self.addEventListener('install', (event) => {
  // On prépare le nouveau cache, puis on ATTEND.
  //
  // Volontairement pas de `skipWaiting()` ici : prendre la main tout de suite
  // remplacerait les fichiers sous les pieds de la page déjà ouverte, qui
  // continuerait de tourner avec l'ancien code. L'application affiche une
  // bannière et n'active la nouvelle version que lorsque tu l'acceptes — d'où
  // le `skipWaiting()` déclenché par message, plus bas.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    // L'ORDRE COMPTE. On prend d'abord la main sur les pages ouvertes, ET
    // SEULEMENT ENSUITE on supprime les anciens caches.
    //
    // Dans l'autre sens, l'ancien service worker contrôle encore les pages
    // pendant le nettoyage : la moindre requête qu'il traite rouvre son propre
    // cache, que l'on vient d'effacer, et il se recrée aussitôt. On se
    // retrouve alors avec des caches périmés qui s'accumulent build après
    // build — ce qu'on cherchait justement à éviter.
    self.clients
      .claim()
      .then(() => caches.keys())
      .then((names) =>
        Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))),
      ),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // La page : réseau d'abord, cache en secours. C'est ce qui empêche
  // l'application de rester bloquée sur une version périmée.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          void caches.open(CACHE).then((cache) => cache.put('/', copy))
          return response
        })
        .catch(() => caches.match('/').then((cached) => cached ?? Response.error())),
    )
    return
  }

  // Les fichiers empreintés : cache d'abord, puisqu'ils ne changent jamais.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached !== undefined) return cached

      return fetch(request).then((response) => {
        // On ne met en cache que les réponses complètes et valides : une
        // erreur mise en cache resterait servie longtemps.
        if (response.ok && response.type === 'basic') {
          const copy = response.clone()
          void caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return response
      })
    }),
  )
})

/** Déclenché par l'application quand tu acceptes de recharger. */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') void self.skipWaiting()
})
