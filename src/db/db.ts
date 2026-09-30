/**
 * src/db/db.ts
 *
 * Le "classeur" : déclare la base IndexedDB et ses tables.
 *
 * IndexedDB est la base de données intégrée à ton navigateur. Elle vit sur ta
 * machine, personne d'autre n'y a accès, et elle fonctionne hors connexion.
 * Dexie est une surcouche qui rend son utilisation lisible.
 *
 * ---------------------------------------------------------------------------
 * COMMENT LIRE UN SCHÉMA DEXIE
 * ---------------------------------------------------------------------------
 * Chaque ligne de `.stores({...})` s'écrit :  nomDeTable: 'cléPrimaire, index1, index2'
 *
 * La clé primaire identifie la ligne de façon unique. Les autres noms sont des
 * INDEX : ils ne changent rien à ce qui est stocké, ils permettent seulement de
 * chercher rapidement dessus (comme l'index d'un livre). `[type+date]` est un
 * index composé, utile pour "toutes les dépenses de septembre 2026".
 *
 * Les champs qui ne sont PAS listés sont quand même enregistrés — ils ne sont
 * simplement pas indexés. On n'indexe volontairement pas les booléens :
 * IndexedDB ne sait pas les indexer.
 *
 * ---------------------------------------------------------------------------
 * RÈGLE ABSOLUE SUR LES VERSIONS
 * ---------------------------------------------------------------------------
 * Une version publiée ne se modifie JAMAIS. Pour faire évoluer le schéma, on
 * ajoute un `.version(2)` en dessous, avec au besoin un `.upgrade()` qui
 * transforme les données existantes. Comme ça une base déjà remplie sur ton
 * téléphone se met à jour au lieu d'être effacée.
 */

import Dexie, { type Table } from 'dexie'
import {
  V5_LABELS,
  V5_RENAMES,
  renameInCategory,
  renameInMicroSettings,
  renameInMonthlyBudget,
  renameInRecurringRule,
  renameInSettings,
  renameInSnapshot,
  renameInTransaction,
} from '../domain/migration/renameIds'
import type {
  Account,
  Category,
  MicroClient,
  MicroForecast,
  MicroInvoice,
  MicroSettings,
  MonthlyBudget,
  PatrimonySnapshot,
  RecurringRule,
  Settings,
  Transaction,
} from './types'

export class BudgetDatabase extends Dexie {
  accounts!: Table<Account, string>
  categories!: Table<Category, string>
  transactions!: Table<Transaction, string>
  monthlyBudgets!: Table<MonthlyBudget, string>
  recurringRules!: Table<RecurringRule, string>
  patrimonySnapshots!: Table<PatrimonySnapshot, string>
  microClients!: Table<MicroClient, string>
  microInvoices!: Table<MicroInvoice, string>
  microForecasts!: Table<MicroForecast, string>
  settings!: Table<Settings, number>
  microSettings!: Table<MicroSettings, number>

  constructor() {
    // 'budgetDB' est le nom visible dans les outils développeur du navigateur.
    super('budgetDB')

    // --- VERSION 1 : ne plus jamais toucher à ce bloc une fois l'app utilisée.
    this.version(1).stores({
      accounts: 'id, kind, order',
      categories: 'id, kind, group, order, [group+order]',
      transactions:
        'id, date, type, categoryId, accountId, fromAccountId, toAccountId, ' +
        '[type+date], [categoryId+date], [accountId+date], recurringRuleId, microInvoiceId',
      monthlyBudgets: 'id, month',
      recurringRules: 'id, type, frequency, mode, startDate',
      patrimonySnapshots: 'id, date',
      microClients: 'id, name',
      microInvoices: 'id, number, clientId, status, issueDate, dueDate, [status+dueDate]',
      microForecasts: 'id, clientId, month, [clientId+month]',
      settings: 'id',
      microSettings: 'id',
    })

    // --- VERSION 2 : ajout du champ `savingAccountIds` sur les catégories
    // d'épargne. Aucun index ne change, donc pas de nouveau `.stores()` : la
    // version 2 hérite du schéma de la version 1.
    //
    // `upgrade()` ne s'exécute QUE sur une base déjà existante en version 1.
    // Sur une base neuve, c'est `seed.ts` qui pose directement la bonne valeur.
    // Les identifiants sont écrits en dur ici volontairement : une migration
    // est une photo du passé, elle ne doit pas dépendre du code d'aujourd'hui.
    this.version(2).upgrade(async (transaction) => {
      const backfill: Record<string, string[]> = {
        'cat-assurance-vie': ['acc-assurance-vie'],
        'cat-epargne-flexible': ['acc-lep', 'acc-pea'],
      }

      const categories = transaction.table<Category>('categories')
      for (const [categoryId, savingAccountIds] of Object.entries(backfill)) {
        const existing = await categories.get(categoryId)
        if (existing !== undefined && existing.savingAccountIds === undefined) {
          await categories.update(categoryId, { savingAccountIds })
        }
      }
    })

    // --- VERSION 3 : désignation de l'enveloppe flexible dans les réglages.
    // Jusqu'ici, son montant était une ligne fixe du budget ; il est désormais
    // recalculé chaque mois par le moteur d'épargne (§4). Il faut donc savoir
    // QUELLE catégorie joue ce rôle.
    //
    // Là encore aucun index ne change : la version 3 hérite du schéma.
    this.version(3).upgrade(async (transaction) => {
      const settings = transaction.table<Settings>('settings')
      const existing = await settings.get(1)
      if (existing !== undefined && existing.flexibleSavingsCategoryId === undefined) {
        await settings.update(1, { flexibleSavingsCategoryId: 'cat-epargne-flexible' })
      }
    })

    // --- VERSION 4 : catégorie des versements URSSAF.
    // L'onglet Micro doit distinguer les cotisations PROVISIONNÉES (un calcul)
    // de celles RÉELLEMENT VERSÉES (une dépense enregistrée). Ces versements
    // ont donc besoin de leur propre catégorie.
    this.version(4).upgrade(async (transaction) => {
      const categories = transaction.table<Category>('categories')
      if ((await categories.get('cat-micro-urssaf')) === undefined) {
        await categories.add({
          id: 'cat-micro-urssaf',
          name: 'URSSAF',
          kind: 'expense',
          group: 'micro',
          order: 6,
          active: true,
          isMicro: true,
        })
      }

      const microSettings = transaction.table<MicroSettings>('microSettings')
      const existing = await microSettings.get(1)
      if (existing !== undefined && existing.urssafCategoryId === undefined) {
        await microSettings.update(1, { urssafCategoryId: 'cat-micro-urssaf' })
      }
    })

    // --- VERSION 5 : des identifiants neutres.
    //
    // Les identifiants d'origine portaient des noms personnels — un employeur,
    // une banque. Ils sont devenus neutres pour que le code puisse être publié
    // sans rien révéler.
    //
    // Un identifiant n'est pas qu'une étiquette : il est recopié dans les
    // opérations, les budgets figés, les relevés de soldes, les règles
    // récurrentes et les réglages. Le changer à un seul endroit produirait des
    // doublons — l'ancienne catégorie resterait avec toutes ses opérations, et
    // la nouvelle apparaîtrait vide à côté.
    //
    // La logique du renommage vit dans domain/migration/renameIds.ts, testée
    // sans base de données, parce qu'elle sert AUSSI à la restauration d'une
    // sauvegarde ancienne — qui n'écrit que des lignes et ne rejoue aucune
    // migration.
    this.version(5).upgrade(async (transaction) => {
      const renames = V5_RENAMES

      // Les tables dont seul le CONTENU change : une simple réécriture.
      const rewrite = async <T extends { id: string | number }>(
        name: string,
        fn: (row: T, renames: typeof V5_RENAMES) => T,
      ) => {
        const table = transaction.table<T>(name)
        const rows = await table.toArray()
        const next = rows.map((row) => fn(row, renames))
        await table.bulkPut(next)
      }

      await rewrite<Transaction>('transactions', renameInTransaction)
      await rewrite<RecurringRule>('recurringRules', renameInRecurringRule)
      await rewrite<PatrimonySnapshot>('patrimonySnapshots', renameInSnapshot)
      await rewrite<MonthlyBudget>('monthlyBudgets', renameInMonthlyBudget)
      await rewrite<Settings>('settings', renameInSettings)
      await rewrite<MicroSettings>('microSettings', renameInMicroSettings)

      // Les catégories et les comptes, eux, changent de CLÉ. Une clé ne se
      // modifie pas sur place : on écrit la nouvelle ligne, puis on efface
      // l'ancienne. Dans cet ordre — l'inverse perdrait la ligne si quelque
      // chose échouait entre les deux.
      const categories = transaction.table<Category>('categories')
      for (const category of await categories.toArray()) {
        const next = renameInCategory(category, renames)
        if (next.id === category.id) {
          // Pas de changement de clé, mais peut-être des comptes d'épargne à suivre.
          if (JSON.stringify(next) !== JSON.stringify(category)) await categories.put(next)
          continue
        }
        await categories.put(next)
        await categories.delete(category.id)
      }

      const accounts = transaction.table<Account>('accounts')
      for (const account of await accounts.toArray()) {
        const nextId = renames[account.id]
        if (nextId === undefined) continue
        await accounts.put({ ...account, id: nextId, name: V5_LABELS[nextId] ?? account.name })
        await accounts.delete(account.id)
      }
    })
  }
}

/**
 * L'unique instance utilisée partout dans l'application.
 * On l'importe ainsi :  import { db } from '../db/db'
 */
export const db = new BudgetDatabase()
