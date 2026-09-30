/**
 * Tests de la validation des sauvegardes.
 *
 * Restaurer efface tout : ces tests décrivent exactement ce qu'on refuse, et
 * pourquoi. C'est le seul endroit de l'application où une erreur de lecture
 * ferait perdre des données.
 */

import { describe, expect, it } from 'vitest'
import {
  BACKUP_TABLES,
  countRows,
  daysSince,
  needsBackupReminder,
  validateBackup,
} from './backupFile'

const valid = (overrides: Record<string, unknown> = {}) => ({
  format: 'budget-app-backup',
  version: 3,
  exportedAt: '2026-09-28T10:00:00.000Z',
  data: Object.fromEntries(BACKUP_TABLES.map((table) => [table, []])),
  ...overrides,
})

describe('sauvegardes acceptées', () => {
  it('accepte une sauvegarde de la version courante', () => {
    expect(validateBackup(valid(), 3).ok).toBe(true)
  })

  it('accepte une sauvegarde PLUS ANCIENNE : les migrations feront le reste', () => {
    expect(validateBackup(valid({ version: 1 }), 3).ok).toBe(true)
  })
})

describe('sauvegardes refusées', () => {
  const problemOf = (raw: unknown, version = 3) => {
    const result = validateBackup(raw, version)
    return result.ok ? undefined : result.problem
  }

  it('refuse ce qui n’est pas un objet', () => {
    expect(problemOf(null)).toMatch(/pas une sauvegarde/)
    expect(problemOf('texte')).toMatch(/pas une sauvegarde/)
    expect(problemOf(42)).toMatch(/pas une sauvegarde/)
  })

  it('refuse un fichier étranger à l’application', () => {
    // Un JSON parfaitement valide, mais qui n'est pas une sauvegarde.
    expect(problemOf({ hello: 'world' })).toMatch(/ne vient pas de cette application/)
  })

  it('refuse une sauvegarde PLUS RÉCENTE que l’application', () => {
    // On ne devine pas un format qu'on ne connaît pas encore.
    expect(problemOf(valid({ version: 9 }))).toMatch(/plus récente/)
  })

  it('refuse une version illisible', () => {
    expect(problemOf(valid({ version: 'trois' }))).toMatch(/version/)
    expect(problemOf(valid({ version: 1.5 }))).toMatch(/version/)
  })

  it('refuse une sauvegarde sans données', () => {
    expect(problemOf(valid({ data: null }))).toMatch(/aucune donnée/)
  })

  it('nomme précisément les tables manquantes', () => {
    const incomplete = valid()
    delete (incomplete.data as Record<string, unknown>).transactions
    ;(incomplete.data as Record<string, unknown>).accounts = 'pas une liste'

    expect(problemOf(incomplete)).toBe('La sauvegarde est incomplète : accounts, transactions.')
  })
})

describe('countRows', () => {
  it('compte les lignes de chaque table', () => {
    const backup = valid()
    ;(backup.data as Record<string, unknown>).transactions = [{}, {}, {}]
    const result = validateBackup(backup, 3)
    if (!result.ok) throw new Error(result.problem)

    expect(countRows(result.backup).transactions).toBe(3)
    expect(countRows(result.backup).accounts).toBe(0)
  })
})

describe('rappel de sauvegarde', () => {
  const now = new Date('2026-09-28T12:00:00.000Z')

  it('rappelle quand aucune sauvegarde n’a jamais été faite', () => {
    expect(needsBackupReminder(undefined, now)).toBe(true)
  })

  it('ne rappelle pas juste après une sauvegarde', () => {
    expect(needsBackupReminder('2026-09-27T12:00:00.000Z', now)).toBe(false)
  })

  it('rappelle au-delà du délai', () => {
    expect(needsBackupReminder('2026-08-28T12:00:00.000Z', now)).toBe(true)
    expect(needsBackupReminder('2026-08-30T12:00:00.000Z', now)).toBe(false)
  })

  it('rappelle si la date enregistrée est illisible', () => {
    // Mieux vaut un rappel de trop qu'une sauvegarde oubliée.
    expect(needsBackupReminder('pas une date', now)).toBe(true)
  })

  it('compte les jours entiers écoulés', () => {
    expect(daysSince('2026-09-28T00:00:00.000Z', now)).toBe(0)
    expect(daysSince('2026-09-27T00:00:00.000Z', now)).toBe(1)
    expect(daysSince(undefined, now)).toBeUndefined()
  })
})
