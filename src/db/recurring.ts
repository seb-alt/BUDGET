/**
 * src/db/recurring.ts
 *
 * Règles récurrentes : enregistrement, et matérialisation des échéances (§7).
 *
 * Le calcul de « ce qui devrait exister » vit dans `domain/recurring/`, qui est
 * testé. Ce fichier ne fait que le confronter à la base et écrire le résultat.
 *
 * Toutes les opérations produites portent `recurringRuleId` : c'est ce lien qui
 * empêche les doublons, et qui permettra plus tard de retrouver d'où vient une
 * ligne qu'on ne se souvient pas avoir saisie.
 */

import { db } from './db'
import { createTransaction, type NewTransactionInput } from './transactions'
import {
  pendingOccurrences,
  splitByMode,
  type PendingOccurrence,
} from '../domain/recurring/recurringEngine'
import { today } from '../utils/date'
import type { IsoDate, RecurringRule } from './types'

const now = () => new Date().toISOString()

/* ------------------------------------------------------------------ */
/* Enregistrement des règles                                           */
/* ------------------------------------------------------------------ */

export type RecurringRuleInput = Omit<RecurringRule, 'id' | 'createdAt' | 'updatedAt'>

export function validateRule(input: RecurringRuleInput): string[] {
  const problems: string[] = []

  if (input.name.trim() === '') problems.push('Donne un nom à la règle.')
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    problems.push('Le montant doit être supérieur à zéro.')
  }
  if (input.frequency !== 'weekly' && (input.dayOfMonth < 1 || input.dayOfMonth > 31)) {
    problems.push('Le jour du mois doit être compris entre 1 et 31.')
  }
  if (input.endDate !== undefined && input.endDate < input.startDate) {
    problems.push('La date de fin ne peut pas précéder la date de début.')
  }

  if (input.type === 'transfer') {
    if (!input.fromAccountId) problems.push('Choisis le compte de départ.')
    if (!input.toAccountId) problems.push('Choisis le compte de destination.')
    if (input.fromAccountId && input.fromAccountId === input.toAccountId) {
      problems.push('Les deux comptes doivent être différents.')
    }
  } else {
    if (!input.categoryId) problems.push('Choisis une catégorie.')
    if (!input.accountId) problems.push('Choisis un compte.')
  }

  return problems
}

export async function saveRule(input: RecurringRuleInput, id?: string): Promise<string> {
  const problems = validateRule(input)
  if (problems.length > 0) throw new Error(problems.join(' '))

  if (id !== undefined) {
    const existing = await db.recurringRules.get(id)
    if (existing === undefined) throw new Error("Cette règle n'existe plus.")
    await db.recurringRules.put({ ...existing, ...input, id, updatedAt: now() })
    return id
  }

  const rule: RecurringRule = {
    ...input,
    id: `rec-${crypto.randomUUID()}`,
    createdAt: now(),
    updatedAt: now(),
  }
  await db.recurringRules.add(rule)
  return rule.id
}

/**
 * Supprime une règle. Les opérations qu'elle a déjà produites RESTENT : ce
 * sont de vraies dépenses, déjà passées sur ton compte. Les effacer
 * fausserait l'historique.
 */
export async function deleteRule(id: string): Promise<void> {
  await db.recurringRules.delete(id)
}

export async function setRuleActive(id: string, active: boolean): Promise<void> {
  await db.recurringRules.update(id, { active, updatedAt: now() })
}

/* ------------------------------------------------------------------ */
/* Matérialisation des échéances                                       */
/* ------------------------------------------------------------------ */

/** Transforme une échéance en opération à enregistrer. */
function toTransaction(occurrence: PendingOccurrence): NewTransactionInput {
  const { rule, date } = occurrence
  return {
    type: rule.type,
    amount: rule.amount,
    date,
    label: rule.name,
    isMicro: rule.isMicro,
    recurringRuleId: rule.id,
    ...(rule.type === 'transfer'
      ? { fromAccountId: rule.fromAccountId, toAccountId: rule.toAccountId }
      : { categoryId: rule.categoryId, accountId: rule.accountId }),
  }
}

/** Les échéances qui attendent ton accord (mode « à confirmer »). */
export async function listPendingConfirmations(
  reference: IsoDate = today(),
): Promise<PendingOccurrence[]> {
  const [rules, transactions] = await Promise.all([
    db.recurringRules.toArray(),
    db.transactions.toArray(),
  ])
  return splitByMode(pendingOccurrences(rules, transactions, reference)).toConfirm
}

/**
 * Crée les opérations des règles AUTOMATIQUES qui manquent.
 * Appelée au démarrage ; sans effet si tout est déjà à jour, donc sans risque
 * à relancer.
 */
export async function applyAutomaticRules(
  reference: IsoDate = today(),
): Promise<{ created: number }> {
  const [rules, transactions] = await Promise.all([
    db.recurringRules.toArray(),
    db.transactions.toArray(),
  ])

  const { automatic } = splitByMode(pendingOccurrences(rules, transactions, reference))
  for (const occurrence of automatic) {
    await createTransaction(toTransaction(occurrence))
  }

  return { created: automatic.length }
}

/** Accepte une échéance proposée : elle devient une opération. */
export async function confirmOccurrence(occurrence: PendingOccurrence): Promise<void> {
  await createTransaction(toTransaction(occurrence))
}

/**
 * Écarte une échéance proposée.
 * On l'enregistre : sans ça, la proposition reviendrait à chaque ouverture de
 * l'application et il serait impossible de s'en débarrasser.
 */
export async function skipOccurrence(occurrence: PendingOccurrence): Promise<void> {
  const rule = await db.recurringRules.get(occurrence.rule.id)
  if (rule === undefined) return

  await db.recurringRules.update(rule.id, {
    skippedDates: [...(rule.skippedDates ?? []), occurrence.date],
    updatedAt: now(),
  })
}
