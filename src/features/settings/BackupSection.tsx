/**
 * src/features/settings/BackupSection.tsx
 *
 * Sauvegarde, export et restauration (§12).
 *
 * C'est le seul écran de l'application capable de DÉTRUIRE des données, d'où
 * la restauration en deux temps : on lit d'abord le fichier, on annonce ce
 * qu'il contient, et on ne remplace qu'après une confirmation explicite.
 *
 * La distinction à retenir :
 *  - `backup.json` contient tout et sait restaurer l'application ;
 *  - les CSV servent à consulter et à archiver, jamais à restaurer — ils
 *    perdent les réglages et les liens entre les tables.
 */

import { useRef, useState } from 'react'
import {
  SCHEMA_VERSION,
  buildCsvFiles,
  exportBackup,
  markBackupDone,
  restoreBackup,
  type CsvFile,
} from '../../db/backup'
import { countRows, validateBackup, type BackupFile } from '../../domain/backup/backupFile'
import { withBom } from '../../domain/backup/csv'
import type { Settings } from '../../db/types'
import { daysSince } from '../../domain/backup/backupFile'
import { downloadTextFile } from '../../utils/download'

interface BackupSectionProps {
  settings: Settings
  onSaved: (message: string) => void
}

export function BackupSection({ settings, onSaved }: BackupSectionProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [csvFiles, setCsvFiles] = useState<CsvFile[]>()
  const [pending, setPending] = useState<BackupFile>()
  const [error, setError] = useState<string>()
  const [isWorking, setIsWorking] = useState(false)

  const elapsed = daysSince(settings.lastBackupAt, new Date())

  async function handleExport() {
    setIsWorking(true)
    setError(undefined)
    try {
      const backup = await exportBackup()
      const stamp = backup.exportedAt.slice(0, 10)
      downloadTextFile(
        `budget-backup-${stamp}.json`,
        JSON.stringify(backup, null, 2),
        'application/json',
      )
      await markBackupDone()
      onSaved('Sauvegarde téléchargée.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "L'export a échoué.")
    } finally {
      setIsWorking(false)
    }
  }

  async function handlePrepareCsv() {
    setIsWorking(true)
    setError(undefined)
    try {
      setCsvFiles(await buildCsvFiles())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "La préparation a échoué.")
    } finally {
      setIsWorking(false)
    }
  }

  /** Lit le fichier choisi et le vérifie, SANS rien modifier. */
  async function handleFileChosen(file: File) {
    setError(undefined)
    setPending(undefined)
    try {
      const result = validateBackup(JSON.parse(await file.text()), SCHEMA_VERSION)
      if (!result.ok) {
        setError(result.problem)
        return
      }
      setPending(result.backup)
    } catch {
      setError("Ce fichier n'est pas lisible : il n'a pas été restauré.")
    }
  }

  async function handleRestore() {
    if (pending === undefined) return
    setIsWorking(true)
    try {
      await restoreBackup(pending)
      // On recharge : tout l'écran doit repartir des données restaurées, y
      // compris le remplissage initial et la mise à jour des budgets figés.
      window.location.reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La restauration a échoué.')
      setIsWorking(false)
    }
  }

  return (
    <div className="set-section">
      <p className="set-backup-state">
        {elapsed === undefined ? (
          <>Aucune sauvegarde n'a encore été faite.</>
        ) : (
          <>
            Dernière sauvegarde :{' '}
            <strong>
              {elapsed === 0 ? "aujourd'hui" : elapsed === 1 ? 'hier' : `il y a ${elapsed} jours`}
            </strong>
          </>
        )}
      </p>

      <div className="set-backup-actions">
        <button type="button" className="set-save" disabled={isWorking} onClick={() => void handleExport()}>
          Télécharger la sauvegarde complète
        </button>
        <p className="ui-field-hint">
          Un seul fichier <code>.json</code>, qui contient tout et sait tout remettre en place.
          Range-le ailleurs que sur cet appareil.
        </p>
      </div>

      <div>
        <h3 className="set-subtitle">Exports CSV</h3>
        {csvFiles === undefined ? (
          <button type="button" className="set-outline" disabled={isWorking} onClick={() => void handlePrepareCsv()}>
            Préparer les fichiers CSV
          </button>
        ) : (
          <ul className="set-files">
            {csvFiles.map((file) => (
              <li key={file.name}>
                <span>{file.name}</span>
                <button
                  type="button"
                  onClick={() => downloadTextFile(file.name, withBom(file.content), 'text/csv')}
                >
                  Télécharger
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="ui-field-hint">
          Pour consulter et archiver, dans un tableur. Un CSV ne permet pas de restaurer.
        </p>
      </div>

      <div>
        <h3 className="set-subtitle">Restaurer</h3>

        {pending === undefined ? (
          <>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              aria-label="Choisir un fichier de sauvegarde"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleFileChosen(file)
              }}
            />
            <p className="ui-field-hint">
              Choisis un fichier <code>.json</code> exporté depuis cette application. Rien ne sera
              remplacé avant ta confirmation.
            </p>
          </>
        ) : (
          /* Le contenu est annoncé AVANT de remplacer quoi que ce soit : c'est
             la seule occasion de repérer qu'on a ouvert le mauvais fichier. */
          <div className="set-restore">
            <p>
              Sauvegarde du <strong>{pending.exportedAt.slice(0, 10)}</strong> :{' '}
              {countRows(pending).transactions} opérations, {countRows(pending).accounts} comptes,{' '}
              {countRows(pending).categories} catégories.
            </p>
            <p className="set-restore-warning">
              Restaurer <strong>remplacera toutes tes données actuelles</strong>. C'est irréversible.
            </p>
            <div className="set-restore-actions">
              <button
                type="button"
                onClick={() => {
                  setPending(undefined)
                  if (fileInput.current) fileInput.current.value = ''
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                className="is-danger"
                disabled={isWorking}
                onClick={() => void handleRestore()}
              >
                {isWorking ? 'Restauration…' : 'Remplacer mes données'}
              </button>
            </div>
          </div>
        )}
      </div>

      {error !== undefined && <p className="set-error">{error}</p>}
    </div>
  )
}
