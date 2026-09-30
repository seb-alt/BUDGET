/**
 * src/utils/download.ts
 *
 * Provoquer le téléchargement d'un fichier fabriqué dans le navigateur.
 *
 * Il n'existe pas d'API dédiée : on crée une adresse temporaire pointant vers
 * le contenu en mémoire, on clique dessus par programme, puis on libère
 * l'adresse. Sans cette libération, le contenu resterait en mémoire tant que
 * l'onglet est ouvert — gênant pour une sauvegarde complète.
 */

/** Le cœur commun : un contenu déjà emballé dans un Blob. */
function download(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()

  // Le délai laisse au navigateur le temps de démarrer le téléchargement.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadTextFile(name: string, content: string, mimeType: string): void {
  download(name, new Blob([content], { type: `${mimeType};charset=utf-8` }))
}

/**
 * Un fichier binaire — un classeur Excel, par exemple.
 *
 * Pas de `charset` ici : ajouter un encodage à un type binaire ferait croire
 * au navigateur qu'il s'agit de texte, et certains outils refuseraient le
 * fichier.
 */
export function downloadBinaryFile(name: string, data: Uint8Array, mimeType: string): void {
  // La copie via `slice()` donne un ArrayBuffer autonome : sans elle, un
  // tampon partagé ferait échouer la construction du Blob dans TypeScript.
  download(name, new Blob([data.slice().buffer], { type: mimeType }))
}
