/**
 * src/domain/backup/backupFile.ts
 *
 * LOGIQUE PURE — le format du fichier de sauvegarde et sa validation.
 *
 * ---------------------------------------------------------------------------
 * POURQUOI VALIDER SI SÉVÈREMENT
 * ---------------------------------------------------------------------------
 * Restaurer REMPLACE toutes tes données. Si on acceptait un fichier douteux,
 * on effacerait une base saine pour la remplir de n'importe quoi — une
 * sauvegarde absente est un problème, une restauration ratée en est un pire.
 *
 * On vérifie donc avant de toucher à quoi que ce soit : le fichier s'annonce
 * bien comme une sauvegarde de cette application, sa version est connue, et
 * chaque table est bien une liste. Au moindre doute, on refuse et on explique.
 *
 * ---------------------------------------------------------------------------
 * LA VERSION
 * ---------------------------------------------------------------------------
 * `version` est celle du schéma de la base au moment de l'export. Une
 * sauvegarde plus ANCIENNE reste acceptée : Dexie appliquera ses migrations
 * comme sur une base réelle. Une sauvegarde plus RÉCENTE est refusée : cette
 * version de l'application ne sait pas lire un format qu'elle ne connaît pas
 * encore, et devinerait de travers.
 */

export const BACKUP_FORMAT = 'budget-app-backup'

/** Les tables sauvegardées, dans l'ordre où elles sont restaurées. */
export const BACKUP_TABLES = [
  'accounts',
  'categories',
  'transactions',
  'monthlyBudgets',
  'recurringRules',
  'patrimonySnapshots',
  'microClients',
  'microInvoices',
  'microForecasts',
  'settings',
  'microSettings',
] as const

export type BackupTable = (typeof BACKUP_TABLES)[number]

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  /** Version du schéma de la base au moment de l'export. */
  version: number
  exportedAt: string
  data: Record<BackupTable, unknown[]>
}

export type BackupCheck =
  | { ok: true; backup: BackupFile }
  | { ok: false; problem: string }

/**
 * Vérifie qu'un contenu quelconque est bien une sauvegarde utilisable.
 * `currentVersion` est la version du schéma de l'application qui restaure.
 */
export function validateBackup(raw: unknown, currentVersion: number): BackupCheck {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, problem: "Ce fichier n'est pas une sauvegarde lisible." }
  }

  const candidate = raw as Partial<BackupFile>

  if (candidate.format !== BACKUP_FORMAT) {
    return {
      ok: false,
      problem: "Ce fichier ne vient pas de cette application : il n'a pas été restauré.",
    }
  }

  if (typeof candidate.version !== 'number' || !Number.isInteger(candidate.version)) {
    return { ok: false, problem: 'La version de la sauvegarde est illisible.' }
  }

  if (candidate.version > currentVersion) {
    return {
      ok: false,
      problem:
        `Cette sauvegarde vient d'une version plus récente de l'application ` +
        `(${candidate.version} contre ${currentVersion}). Mets l'application à jour avant de la restaurer.`,
    }
  }

  if (typeof candidate.data !== 'object' || candidate.data === null) {
    return { ok: false, problem: 'La sauvegarde ne contient aucune donnée.' }
  }

  const data = candidate.data as Record<string, unknown>
  const missing = BACKUP_TABLES.filter((table) => !Array.isArray(data[table]))
  if (missing.length > 0) {
    return {
      ok: false,
      problem: `La sauvegarde est incomplète : ${missing.join(', ')}.`,
    }
  }

  return { ok: true, backup: candidate as BackupFile }
}

/** Combien de lignes contient chaque table, pour l'annoncer avant de restaurer. */
export function countRows(backup: BackupFile): Record<BackupTable, number> {
  return Object.fromEntries(
    BACKUP_TABLES.map((table) => [table, backup.data[table].length]),
  ) as Record<BackupTable, number>
}

/* ------------------------------------------------------------------ */
/* Rappel de sauvegarde                                                */
/* ------------------------------------------------------------------ */

/** Au-delà de ce délai sans sauvegarde, l'application le rappelle discrètement. */
export const BACKUP_REMINDER_DAYS = 30

/** Nombre de jours entiers écoulés depuis une date, ou `undefined` si absente. */
export function daysSince(iso: string | undefined, now: Date): number | undefined {
  if (iso === undefined) return undefined
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return undefined
  return Math.floor((now.getTime() - then) / 86_400_000)
}

/**
 * Faut-il rappeler de sauvegarder ?
 *
 * Oui si aucune sauvegarde n'a jamais été faite, ou si la dernière est plus
 * vieille que le délai. Le rappel reste discret : ce n'est pas une alerte,
 * c'est un pense-bête.
 */
export function needsBackupReminder(
  lastBackupAt: string | undefined,
  now: Date,
  maxDays: number = BACKUP_REMINDER_DAYS,
): boolean {
  const days = daysSince(lastBackupAt, now)
  return days === undefined || days >= maxDays
}
