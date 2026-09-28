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
  }
}

/**
 * L'unique instance utilisée partout dans l'application.
 * On l'importe ainsi :  import { db } from '../db/db'
 */
export const db = new BudgetDatabase()
