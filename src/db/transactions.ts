/**
 * src/db/transactions.ts
 *
 * Toutes les écritures dans la table `transactions` passent par ici.
 *
 * Pourquoi un fichier dédié plutôt que d'appeler Dexie depuis le formulaire ?
 * Parce que la validation doit être au même endroit que l'écriture. Le jour où
 * une opération sera créée autrement (règle récurrente, import d'une
 * sauvegarde, encaissement d'une facture), elle passera par la même porte et
 * subira les mêmes contrôles.
 */

import { db } from './db'
import type { Cents, IsoDate, Transaction, TransactionType } from './types'

export interface NewTransactionInput {
  type: TransactionType
  /** En centimes, strictement positif. */
  amount: Cents
  date: IsoDate
  categoryId?: string
  accountId?: string
  fromAccountId?: string
  toAccountId?: string
  label?: string
  isMicro?: boolean
}

/**
 * Liste, en français, tout ce qui empêche d'enregistrer l'opération.
 * Tableau vide = tout va bien. Le formulaire s'en sert pour désactiver le
 * bouton Enregistrer et expliquer pourquoi.
 */
export function validateTransaction(input: NewTransactionInput): string[] {
  const problems: string[] = []

  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    problems.push('Le montant doit être supérieur à zéro.')
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    problems.push('La date est invalide.')
  }

  if (input.type === 'transfer') {
    if (!input.fromAccountId) problems.push('Choisis le compte de départ.')
    if (!input.toAccountId) problems.push('Choisis le compte de destination.')
    if (input.fromAccountId && input.fromAccountId === input.toAccountId) {
      problems.push('Les deux comptes doivent être différents.')
    }
    if (input.categoryId) {
      // Règle du cahier des charges §14 : un transfert n'a pas de catégorie.
      problems.push("Un transfert ne prend pas de catégorie.")
    }
  } else {
    if (!input.categoryId) problems.push('Choisis une catégorie.')
    if (!input.accountId) problems.push('Choisis un compte.')
  }

  return problems
}

/**
 * Enregistre une opération et renvoie son identifiant.
 * Lève une erreur si la validation échoue : on ne veut jamais d'une ligne
 * incohérente en base, même si un appel oubliait de vérifier avant.
 */
export async function createTransaction(input: NewTransactionInput): Promise<string> {
  const problems = validateTransaction(input)
  if (problems.length > 0) {
    throw new Error(`Opération invalide : ${problems.join(' ')}`)
  }

  const timestamp = new Date().toISOString()
  const transaction: Transaction = {
    id: crypto.randomUUID(),
    type: input.type,
    amount: input.amount,
    date: input.date,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  // On n'écrit que les champs réellement remplis : une clé à `undefined`
  // encombre inutilement la base et brouille les index.
  if (input.type === 'transfer') {
    transaction.fromAccountId = input.fromAccountId
    transaction.toAccountId = input.toAccountId
  } else {
    transaction.categoryId = input.categoryId
    transaction.accountId = input.accountId
  }
  const label = input.label?.trim()
  if (label) transaction.label = label
  if (input.isMicro) transaction.isMicro = true

  await db.transactions.add(transaction)
  return transaction.id
}

/** Supprime une opération. */
export async function deleteTransaction(id: string): Promise<void> {
  await db.transactions.delete(id)
}
