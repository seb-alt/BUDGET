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

export function downloadTextFile(name: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })
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
