/**
 * src/domain/migration/renameIds.ts
 *
 * Renommer des identifiants de catégories et de comptes, partout où ils
 * apparaissent.
 *
 * ---------------------------------------------------------------------------
 * POURQUOI CE FICHIER EXISTE
 * ---------------------------------------------------------------------------
 * Les identifiants d'origine portaient des noms personnels — celui d'un
 * employeur, celui d'une banque. Ils sont devenus neutres pour que le code
 * puisse être publié sans rien révéler.
 *
 * Changer un identifiant n'est PAS anodin. Il est recopié dans les opérations,
 * dans les budgets, dans les relevés de soldes, dans les réglages. Se contenter
 * de le changer dans le remplissage initial produirait des doublons sur une
 * base existante : l'ancienne catégorie resterait, avec toutes ses opérations,
 * et la nouvelle apparaîtrait vide à côté.
 *
 * ---------------------------------------------------------------------------
 * POURQUOI C'EST UNE FONCTION PURE, ET PAS DU CODE DE MIGRATION
 * ---------------------------------------------------------------------------
 * Le renommage doit avoir lieu à DEUX endroits :
 *
 *  1. sur la base existante, au moment de la migration (db.ts, version 5) ;
 *  2. à la RESTAURATION d'une sauvegarde ancienne — et c'est le piège :
 *     restaurer n'écrit que des lignes, cela ne rejoue aucune migration. Sans
 *     traitement explicite, une sauvegarde de septembre réintroduirait les
 *     anciens identifiants dans une base déjà migrée.
 *
 * Un seul code, testable sans base de données, appelé aux deux endroits.
 */

import type {
  Account,
  Category,
  MicroSettings,
  MonthlyBudget,
  PatrimonySnapshot,
  RecurringRule,
  Settings,
  Transaction,
} from '../../db/types'

/** Ancien identifiant → nouveau. */
export type Renames = Record<string, string>

/**
 * Les renommages du passage à la version 5.
 *
 * Écrits en dur : une migration est une photo du passé. Elle ne doit jamais
 * dépendre du code d'aujourd'hui, sinon elle changerait de sens à chaque fois
 * qu'on modifie le remplissage initial.
 */
export const V5_RENAMES: Renames = {
  'cat-itaxia': 'cat-revenu-1',
  'cat-intermarche': 'cat-revenu-2',
  'acc-cic': 'acc-courant',
}

/** Les nouveaux noms affichés, pour les lignes que la migration renomme. */
export const V5_LABELS: Record<string, string> = {
  'cat-revenu-1': 'Revenu principal',
  'cat-revenu-2': 'Revenu secondaire',
  'acc-courant': 'Compte courant',
}

/** Un identifiant, renommé s'il est concerné. `undefined` reste `undefined`. */
function id<T extends string | undefined>(value: T, renames: Renames): T {
  if (value === undefined) return value
  return (renames[value] ?? value) as T
}

export function renameInAccount(account: Account, renames: Renames): Account {
  const next = id(account.id, renames)
  if (next === account.id) return account
  return { ...account, id: next, name: V5_LABELS[next] ?? account.name }
}

export function renameInCategory(category: Category, renames: Renames): Category {
  const next = id(category.id, renames)
  const savingAccountIds = category.savingAccountIds?.map((accountId) => id(accountId, renames))
  return {
    ...category,
    id: next,
    ...(next === category.id ? {} : { name: V5_LABELS[next] ?? category.name }),
    ...(savingAccountIds === undefined ? {} : { savingAccountIds }),
  }
}

export function renameInTransaction(transaction: Transaction, renames: Renames): Transaction {
  return {
    ...transaction,
    categoryId: id(transaction.categoryId, renames),
    accountId: id(transaction.accountId, renames),
    fromAccountId: id(transaction.fromAccountId, renames),
    toAccountId: id(transaction.toAccountId, renames),
  }
}

export function renameInRecurringRule(rule: RecurringRule, renames: Renames): RecurringRule {
  return {
    ...rule,
    categoryId: id(rule.categoryId, renames),
    accountId: id(rule.accountId, renames),
    fromAccountId: id(rule.fromAccountId, renames),
    toAccountId: id(rule.toAccountId, renames),
  }
}

export function renameInSnapshot(
  snapshot: PatrimonySnapshot,
  renames: Renames,
): PatrimonySnapshot {
  return {
    ...snapshot,
    balances: snapshot.balances.map((balance) => ({
      ...balance,
      accountId: id(balance.accountId, renames),
    })),
  }
}

export function renameInMonthlyBudget(budget: MonthlyBudget, renames: Renames): MonthlyBudget {
  return {
    ...budget,
    lines: budget.lines.map((line) => ({ ...line, categoryId: id(line.categoryId, renames) })),
  }
}

export function renameInSettings(settings: Settings, renames: Renames): Settings {
  return {
    ...settings,
    budgetTemplate: settings.budgetTemplate.map((line) => ({
      ...line,
      categoryId: id(line.categoryId, renames),
    })),
    flexibleSavingsCategoryId: id(settings.flexibleSavingsCategoryId, renames),
    lepAccountId: id(settings.lepAccountId, renames),
    peaAccountId: id(settings.peaAccountId, renames),
    assuranceVieAccountId: id(settings.assuranceVieAccountId, renames),
    defaultAccountId: id(settings.defaultAccountId, renames),
  }
}

export function renameInMicroSettings(
  microSettings: MicroSettings,
  renames: Renames,
): MicroSettings {
  return {
    ...microSettings,
    microAccountId: id(microSettings.microAccountId, renames),
    urssafCategoryId: id(microSettings.urssafCategoryId, renames),
  }
}

/**
 * Le contenu d'une sauvegarde, renommé table par table.
 *
 * Les tables absentes ou vides passent sans bruit : une sauvegarde ancienne
 * peut très bien ne pas contenir toutes les tables d'aujourd'hui.
 */
export function renameInBackupData(
  data: Record<string, unknown[]>,
  renames: Renames,
): Record<string, unknown[]> {
  const map = <T>(name: string, fn: (row: T, renames: Renames) => T): unknown[] =>
    (data[name] ?? []).map((row) => fn(row as T, renames))

  return {
    ...data,
    accounts: map<Account>('accounts', renameInAccount),
    categories: map<Category>('categories', renameInCategory),
    transactions: map<Transaction>('transactions', renameInTransaction),
    recurringRules: map<RecurringRule>('recurringRules', renameInRecurringRule),
    patrimonySnapshots: map<PatrimonySnapshot>('patrimonySnapshots', renameInSnapshot),
    monthlyBudgets: map<MonthlyBudget>('monthlyBudgets', renameInMonthlyBudget),
    settings: map<Settings>('settings', renameInSettings),
    microSettings: map<MicroSettings>('microSettings', renameInMicroSettings),
  }
}
