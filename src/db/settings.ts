/**
 * src/db/settings.ts
 *
 * Toutes les modifications de réglages passent par ici.
 *
 * Deux responsabilités qu'on ne veut pas voir éparpillées dans l'interface :
 *
 *  1. LES GARDE-FOUS. Supprimer une catégorie utilisée par douze opérations
 *     les laisserait orphelines, affichées « Sans catégorie » pour toujours.
 *     On refuse, et l'écran propose de désactiver à la place — la catégorie
 *     disparaît alors de la saisie sans abîmer l'historique.
 *
 *  2. LA PROPAGATION. Changer le budget doit rafraîchir la copie du mois en
 *     cours (§11), sinon le Dashboard continuerait d'afficher l'ancien.
 */

import { syncMonthlyBudgets } from './budgets'
import { db } from './db'
import {
  countAccountUses,
  countCategoryUses,
  moveInOrder,
} from '../domain/settings/settingsRules'
import type {
  Account,
  AccountKind,
  BudgetLine,
  Category,
  CategoryGroup,
  CategoryKind,
  Cents,
} from './types'

const now = () => new Date().toISOString()

/* ------------------------------------------------------------------ */
/* Budget                                                              */
/* ------------------------------------------------------------------ */

export interface BudgetUpdate {
  referenceIncome: Cents
  lines: BudgetLine[]
}

export async function updateBudget(update: BudgetUpdate): Promise<void> {
  if (update.lines.some((line) => line.amount < 0)) {
    throw new Error('Un budget ne peut pas être négatif.')
  }

  await db.settings.update(1, {
    referenceIncome: update.referenceIncome,
    budgetTemplate: update.lines,
    updatedAt: now(),
  })

  // Le mois en cours suit les réglages : sans ce rappel, sa copie figée
  // garderait l'ancien budget jusqu'au prochain lancement de l'application.
  await syncMonthlyBudgets()
}

/* ------------------------------------------------------------------ */
/* Épargne et prêt                                                     */
/* ------------------------------------------------------------------ */

export interface SavingsUpdate {
  lepThreshold: Cents
  assuranceVieMonthly: Cents
}

export async function updateSavingsSettings(update: SavingsUpdate): Promise<void> {
  if (update.lepThreshold < 0 || update.assuranceVieMonthly < 0) {
    throw new Error('Ces montants ne peuvent pas être négatifs.')
  }

  await db.settings.update(1, { ...update, updatedAt: now() })
  await syncMonthlyBudgets()
}

/* ------------------------------------------------------------------ */
/* Micro-entreprise                                                    */
/* ------------------------------------------------------------------ */

export interface MicroUpdate {
  urssafRate: number
  acreEnabled: boolean
  defaultPaymentTermDays: number
  invoiceNumberPrefix: string
}

export async function updateMicroSettings(update: MicroUpdate): Promise<void> {
  if (update.urssafRate < 0 || update.urssafRate > 1) {
    throw new Error('Le taux URSSAF doit être compris entre 0 et 100 %.')
  }
  if (!Number.isInteger(update.defaultPaymentTermDays) || update.defaultPaymentTermDays < 0) {
    throw new Error('Le délai de paiement doit être un nombre de jours positif.')
  }

  await db.microSettings.update(1, { ...update, updatedAt: now() })
}

/* ------------------------------------------------------------------ */
/* Catégories                                                          */
/* ------------------------------------------------------------------ */

export async function renameCategory(id: string, name: string): Promise<void> {
  const trimmed = name.trim()
  if (trimmed === '') throw new Error('Le nom ne peut pas être vide.')
  await db.categories.update(id, { name: trimmed })
}

export async function setCategoryActive(id: string, active: boolean): Promise<void> {
  await db.categories.update(id, { active })
}

/** Déplace la catégorie d'un cran DANS SON GROUPE : l'ordre est relatif au groupe. */
export async function moveCategory(id: string, direction: -1 | 1): Promise<void> {
  const category = await db.categories.get(id)
  if (category === undefined) return

  const siblings = await db.categories.where('group').equals(category.group).toArray()
  await db.categories.bulkPut(moveInOrder(siblings, id, direction))
}

export interface NewCategory {
  name: string
  kind: CategoryKind
  group: CategoryGroup
  /** Proposée comme bouton d'accès rapide dans l'écran de saisie. */
  quickPick: boolean
  /** Obligatoire pour une enveloppe d'épargne : les comptes qu'elle alimente. */
  savingAccountIds?: string[]
}

/**
 * Vérifie les comptes d'une enveloppe d'épargne.
 *
 * DEUX RÈGLES, ET LA SECONDE EST LA PLUS IMPORTANTE.
 *
 * 1. Un compte ne peut alimenter qu'UNE SEULE enveloppe. Sinon un virement de
 *    300 € vers le LEP serait compté dans les deux, et le total du groupe
 *    Épargne afficherait 600 €. L'erreur serait invisible : aucun message,
 *    juste un chiffre faux. Mieux vaut un refus explicite.
 *
 * 2. Le compte doit être marqué « compte d'épargne ». Un virement vers un
 *    compte courant n'est pas de l'épargne, l'enveloppe resterait à zéro.
 *
 * `requireOne` n'est vrai qu'à la CRÉATION. Le refuser aussi à la modification
 * créerait une impasse : déplacer l'unique compte d'une enveloppe vers une
 * autre deviendrait impossible, puisqu'il faudrait le retirer d'abord. Une
 * enveloppe sans compte n'est pas incohérente, seulement inutile — l'écran le
 * signale au lieu de l'interdire.
 */
async function checkSavingAccounts(
  accountIds: string[],
  categoryId?: string,
  requireOne = false,
): Promise<void> {
  if (requireOne && accountIds.length === 0) {
    throw new Error(
      'Choisis au moins un compte : une enveloppe d’épargne se remplit par virement.',
    )
  }

  const accounts = await db.accounts.bulkGet(accountIds)
  for (const [index, account] of accounts.entries()) {
    if (account === undefined) throw new Error('Un des comptes choisis n’existe plus.')
    if (!account.countsAsSavings) {
      throw new Error(
        `« ${account.name} » n’est pas un compte d’épargne : un virement vers lui ne compterait pas comme de l’épargne.`,
      )
    }
    void index
  }

  const others = (await db.categories.toArray()).filter(
    (category) => category.kind === 'saving' && category.id !== categoryId,
  )
  for (const other of others) {
    const clash = (other.savingAccountIds ?? []).find((id) => accountIds.includes(id))
    if (clash !== undefined) {
      const name = (await db.accounts.get(clash))?.name ?? clash
      throw new Error(
        `« ${name} » alimente déjà l’enveloppe « ${other.name} ». Un compte ne peut en alimenter qu’une, sinon le même virement serait compté deux fois.`,
      )
    }
  }
}

/** Change les comptes alimentant une enveloppe d'épargne existante. */
export async function setCategorySavingAccounts(
  id: string,
  accountIds: string[],
): Promise<void> {
  const category = await db.categories.get(id)
  if (category === undefined) throw new Error('Cette catégorie n’existe plus.')
  if (category.kind !== 'saving')
    throw new Error('Seule une enveloppe d’épargne a des comptes.')

  await checkSavingAccounts(accountIds, id)
  await db.categories.update(id, { savingAccountIds: accountIds })
}

export async function addCategory(input: NewCategory): Promise<string> {
  const name = input.name.trim()
  if (name === '') throw new Error('Donne un nom à la catégorie.')

  if (input.kind === 'saving')
    await checkSavingAccounts(input.savingAccountIds ?? [], undefined, true)

  const siblings = await db.categories.where('group').equals(input.group).toArray()
  const category: Category = {
    id: `cat-${crypto.randomUUID()}`,
    name,
    kind: input.kind,
    group: input.group,
    order: siblings.length + 1,
    active: true,
    quickPick: input.quickPick,
    isMicro: input.group === 'micro' ? true : undefined,
    savingAccountIds: input.kind === 'saving' ? input.savingAccountIds : undefined,
  }

  await db.categories.add(category)
  return category.id
}

/**
 * Supprime une catégorie, mais seulement si RIEN ne s'y rattache.
 * Sinon on lève une erreur explicite : l'écran proposera de désactiver.
 */
export async function deleteCategory(id: string): Promise<void> {
  const settings = await db.settings.get(1)
  if (settings?.flexibleSavingsCategoryId === id) {
    throw new Error("L'enveloppe flexible est utilisée par le moteur d'épargne.")
  }

  const uses = countCategoryUses(id, await db.transactions.toArray())
  if (uses > 0) {
    throw new Error(
      `${uses} opération${uses > 1 ? 's utilisent' : ' utilise'} cette catégorie. ` +
        'Désactive-la plutôt : elle disparaîtra de la saisie sans abîmer ton historique.',
    )
  }

  await db.transaction('rw', [db.categories, db.settings], async () => {
    await db.categories.delete(id)

    // Une ligne de budget orpheline fausserait les totaux sans rien afficher.
    const current = await db.settings.get(1)
    if (current !== undefined) {
      await db.settings.update(1, {
        budgetTemplate: current.budgetTemplate.filter((line) => line.categoryId !== id),
        updatedAt: now(),
      })
    }
  })

  await syncMonthlyBudgets()
}

/* ------------------------------------------------------------------ */
/* Comptes                                                             */
/* ------------------------------------------------------------------ */

export interface AccountUpdate {
  name: string
  /** Plafond éventuel, en centimes. `null` retire le plafond. */
  ceiling: Cents | null
}

export async function updateAccount(id: string, update: AccountUpdate): Promise<void> {
  const name = update.name.trim()
  if (name === '') throw new Error('Le nom ne peut pas être vide.')

  await db.accounts.update(id, {
    name,
    ceiling: update.ceiling ?? undefined,
  })
}

export async function setAccountActive(id: string, active: boolean): Promise<void> {
  const settings = await db.settings.get(1)
  const protectedAccounts = [
    settings?.defaultAccountId,
    settings?.lepAccountId,
    settings?.peaAccountId,
    settings?.assuranceVieAccountId,
  ]

  if (!active && protectedAccounts.includes(id)) {
    throw new Error("Ce compte est utilisé par le moteur d'épargne ou par la saisie.")
  }

  await db.accounts.update(id, { active })
}

export async function moveAccount(id: string, direction: -1 | 1): Promise<void> {
  await db.accounts.bulkPut(moveInOrder(await db.accounts.toArray(), id, direction))
}

export async function addAccount(name: string, kind: AccountKind): Promise<string> {
  const trimmed = name.trim()
  if (trimmed === '') throw new Error('Donne un nom au compte.')

  const accounts = await db.accounts.toArray()
  const account: Account = {
    id: `acc-${crypto.randomUUID()}`,
    name: trimmed,
    kind,
    // Un compte d'épargne ou de placement reçoit de l'épargne ; un compte
    // courant ou micro, non. Modifiable ensuite si besoin.
    countsAsSavings: kind === 'savings' || kind === 'investment',
    order: accounts.length + 1,
    active: true,
  }

  await db.accounts.add(account)
  return account.id
}

export async function deleteAccount(id: string): Promise<void> {
  const settings = await db.settings.get(1)
  if (
    [
      settings?.defaultAccountId,
      settings?.lepAccountId,
      settings?.peaAccountId,
      settings?.assuranceVieAccountId,
    ].includes(id)
  ) {
    throw new Error("Ce compte est utilisé par le moteur d'épargne ou par la saisie.")
  }

  const uses = countAccountUses(id, await db.transactions.toArray())
  if (uses > 0) {
    throw new Error(
      `${uses} opération${uses > 1 ? 's utilisent' : ' utilise'} ce compte. ` +
        'Désactive-le plutôt : il disparaîtra de la saisie sans abîmer ton historique.',
    )
  }

  await db.accounts.delete(id)
}
