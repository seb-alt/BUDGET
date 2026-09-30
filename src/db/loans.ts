/**
 * src/db/loans.ts
 *
 * Créer, modifier et supprimer un prêt.
 *
 * Aucun garde-fou de suppression ici, contrairement aux catégories et aux
 * comptes : rien d'autre ne pointe vers un prêt. Une opération de
 * remboursement appartient à sa catégorie budgétaire, pas au prêt — les deux
 * répondent à des questions différentes, et c'est ce qui rend la suppression
 * sans danger.
 */

import { db } from './db'
import type { Loan } from './types'

export type LoanInput = Omit<Loan, 'id' | 'order' | 'createdAt' | 'updatedAt'>

export function validateLoan(input: LoanInput): string[] {
  const problems: string[] = []

  if (input.name.trim() === '') problems.push('Donne un nom à ce prêt.')
  if (input.initialAmount <= 0) problems.push('Le montant emprunté doit être supérieur à zéro.')
  if (input.remainingCapital < 0)
    problems.push('Le capital restant dû ne peut pas être négatif.')
  if (input.monthlyPayment < 0) problems.push('La mensualité ne peut pas être négative.')

  // Devoir plus que ce qu'on a emprunté est possible avec des intérêts
  // capitalisés, mais c'est assez rare pour mériter d'être signalé : dans la
  // plupart des cas, c'est une inversion des deux champs.
  if (input.remainingCapital > input.initialAmount) {
    problems.push(
      'Le capital restant dû dépasse le montant emprunté — vérifie les deux champs.',
    )
  }

  return problems
}

export async function saveLoan(input: LoanInput, id?: string): Promise<string> {
  const problems = validateLoan(input)
  if (problems.length > 0) throw new Error(problems[0])

  const now = new Date().toISOString()

  if (id !== undefined) {
    const existing = await db.loans.get(id)
    if (existing === undefined) throw new Error('Ce prêt n’existe plus.')
    await db.loans.put({ ...existing, ...input, updatedAt: now })
    return id
  }

  const count = await db.loans.count()
  const loan: Loan = {
    ...input,
    id: `loan-${crypto.randomUUID()}`,
    order: count + 1,
    createdAt: now,
    updatedAt: now,
  }
  await db.loans.add(loan)
  return loan.id
}

export async function deleteLoan(id: string): Promise<void> {
  await db.loans.delete(id)
}
