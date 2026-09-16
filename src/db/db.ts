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
  }
}

/**
 * L'unique instance utilisée partout dans l'application.
 * On l'importe ainsi :  import { db } from '../db/db'
 */
export const db = new BudgetDatabase()
