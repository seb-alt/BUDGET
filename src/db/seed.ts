/**
 * src/db/seed.ts
 *
 * Le "remplissage initial" : au tout premier lancement, crée tes comptes, tes
 * catégories, ton budget de référence et tes réglages micro.
 *
 * ---------------------------------------------------------------------------
 * POURQUOI ÇA NE DUPLIQUE JAMAIS
 * ---------------------------------------------------------------------------
 * Chaque ligne de référence a un identifiant FIXE et lisible ('acc-cic',
 * 'cat-shopping'...). Avant d'insérer, on regarde quels identifiants existent
 * déjà et on n'ajoute que ceux qui manquent.
 *
 * Conséquence importante : si tu renommes "Shopping" en "Fringues" dans les
 * paramètres, un rechargement de page NE remettra PAS "Shopping". Le seed
 * complète, il n'écrase jamais.
 *
 * Effet de bord utile : si on ajoute plus tard une nouvelle catégorie de
 * référence, elle apparaîtra automatiquement chez toi sans rien casser.
 */

import type { Table } from 'dexie'
import { db } from './db'
import type { Account, Category, Cents, MicroSettings, Settings } from './types'

/** Petit confort de lecture : euros(24.5) vaut 2450 centimes. */
const euros = (amount: number): Cents => Math.round(amount * 100)

const now = (): string => new Date().toISOString()

/* ------------------------------------------------------------------ */
/* Identifiants fixes                                                  */
/* ------------------------------------------------------------------ */

export const ACCOUNT_IDS = {
  cic: 'acc-cic',
  lep: 'acc-lep',
  assuranceVie: 'acc-assurance-vie',
  pea: 'acc-pea',
  micro: 'acc-micro',
} as const

export const CATEGORY_IDS = {
  /* Charges fixes */
  abonnements: 'cat-abonnements',
  essence: 'cat-essence',
  pret: 'cat-pret-etudiant',
  impots: 'cat-impots',
  /* Épargne / investissement */
  assuranceVie: 'cat-assurance-vie',
  epargneFlexible: 'cat-epargne-flexible',
  /* Loisirs */
  sorties: 'cat-sorties',
  shopping: 'cat-shopping',
  autresLoisirs: 'cat-autres-loisirs',
  /* Hors enveloppe */
  autre: 'cat-autre',
  /* Revenus personnels */
  itaxia: 'cat-itaxia',
  intermarche: 'cat-intermarche',
  revenuAutre: 'cat-revenu-autre',
  /* Dépenses micro-entreprise */
  microRcPro: 'cat-micro-rc-pro',
  microLogiciels: 'cat-micro-logiciels',
  microMateriel: 'cat-micro-materiel',
  microDeplacements: 'cat-micro-deplacements',
  microAutres: 'cat-micro-autres',
} as const

/* ------------------------------------------------------------------ */
/* Données de référence                                                */
/* ------------------------------------------------------------------ */

const seedAccounts = (): Account[] => [
  {
    id: ACCOUNT_IDS.cic,
    name: 'CIC',
    kind: 'checking',
    countsAsSavings: false,
    order: 1,
    active: true,
  },
  {
    id: ACCOUNT_IDS.lep,
    name: 'LEP',
    kind: 'savings',
    countsAsSavings: true,
    ceiling: euros(8000),
    order: 2,
    active: true,
  },
  {
    id: ACCOUNT_IDS.assuranceVie,
    name: 'Assurance-vie',
    kind: 'investment',
    countsAsSavings: true,
    order: 3,
    active: true,
  },
  {
    id: ACCOUNT_IDS.pea,
    name: 'PEA',
    kind: 'investment',
    countsAsSavings: true,
    order: 4,
    active: true,
  },
  {
    id: ACCOUNT_IDS.micro,
    name: 'Micro',
    kind: 'micro',
    countsAsSavings: false,
    order: 5,
    active: true,
  },
]

const seedCategories = (): Category[] => [
  /* --- CHARGES FIXES : 800 € --------------------------------------- */
  { id: CATEGORY_IDS.abonnements, name: 'Abonnements', kind: 'expense', group: 'chargesFixes', order: 1, active: true, quickPick: true },
  { id: CATEGORY_IDS.essence, name: 'Essence / Transport', kind: 'expense', group: 'chargesFixes', order: 2, active: true, quickPick: true },
  { id: CATEGORY_IDS.pret, name: 'Prêt étudiant', kind: 'expense', group: 'chargesFixes', order: 3, active: true, quickPick: true },
  { id: CATEGORY_IDS.impots, name: 'Impôts', kind: 'expense', group: 'chargesFixes', order: 4, active: true, quickPick: true },

  /* --- ÉPARGNE / INVESTISSEMENT : 850 € ---------------------------- */
  { id: CATEGORY_IDS.assuranceVie, name: 'Assurance-vie', kind: 'saving', group: 'epargne', order: 1, active: true, savingAccountIds: [ACCOUNT_IDS.assuranceVie] },
  { id: CATEGORY_IDS.epargneFlexible, name: 'Enveloppe flexible LEP / PEA', kind: 'saving', group: 'epargne', order: 2, active: true, savingAccountIds: [ACCOUNT_IDS.lep, ACCOUNT_IDS.pea] },

  /* --- LOISIRS : 350 € --------------------------------------------- */
  { id: CATEGORY_IDS.sorties, name: 'Sorties', kind: 'expense', group: 'loisirs', order: 1, active: true, quickPick: true },
  { id: CATEGORY_IDS.shopping, name: 'Shopping', kind: 'expense', group: 'loisirs', order: 2, active: true, quickPick: true },
  { id: CATEGORY_IDS.autresLoisirs, name: 'Autres loisirs', kind: 'expense', group: 'loisirs', order: 3, active: true, quickPick: true },

  /* --- Hors enveloppe budgétée ------------------------------------- */
  { id: CATEGORY_IDS.autre, name: 'Autre', kind: 'expense', group: 'divers', order: 1, active: true, quickPick: true },

  /* --- REVENUS PERSONNELS (pas de budget prévisionnel, §4) ---------- */
  { id: CATEGORY_IDS.itaxia, name: 'ITAXIA', kind: 'income', group: 'revenuPerso', order: 1, active: true, quickPick: true },
  { id: CATEGORY_IDS.intermarche, name: 'INTERMARCHÉ', kind: 'income', group: 'revenuPerso', order: 2, active: true, quickPick: true },
  { id: CATEGORY_IDS.revenuAutre, name: 'AUTRE', kind: 'income', group: 'revenuPerso', order: 3, active: true, quickPick: true },

  /* --- DÉPENSES MICRO-ENTREPRISE (§9) ------------------------------ */
  { id: CATEGORY_IDS.microRcPro, name: 'RC Pro', kind: 'expense', group: 'micro', order: 1, active: true, isMicro: true },
  { id: CATEGORY_IDS.microLogiciels, name: 'Logiciels', kind: 'expense', group: 'micro', order: 2, active: true, isMicro: true },
  { id: CATEGORY_IDS.microMateriel, name: 'Matériel', kind: 'expense', group: 'micro', order: 3, active: true, isMicro: true },
  { id: CATEGORY_IDS.microDeplacements, name: 'Déplacements', kind: 'expense', group: 'micro', order: 4, active: true, isMicro: true },
  { id: CATEGORY_IDS.microAutres, name: 'Autres', kind: 'expense', group: 'micro', order: 5, active: true, isMicro: true },
]

/**
 * Budget mensuel de référence du cahier des charges §4.
 *   CHARGES FIXES 800 € + ÉPARGNE 850 € + LOISIRS 350 € = 2 000 €
 * Modifiable depuis les paramètres : rien de tout cela n'est écrit en dur
 * dans un composant React.
 */
const seedSettings = (): Settings => ({
  id: 1,
  referenceIncome: euros(2000),
  budgetTemplate: [
    { categoryId: CATEGORY_IDS.abonnements, amount: euros(150) },
    { categoryId: CATEGORY_IDS.essence, amount: euros(150) },
    { categoryId: CATEGORY_IDS.pret, amount: euros(350) },
    { categoryId: CATEGORY_IDS.impots, amount: euros(150) },
    { categoryId: CATEGORY_IDS.assuranceVie, amount: euros(500) },
    { categoryId: CATEGORY_IDS.epargneFlexible, amount: euros(350) },
    { categoryId: CATEGORY_IDS.sorties, amount: euros(100) },
    { categoryId: CATEGORY_IDS.shopping, amount: euros(200) },
    { categoryId: CATEGORY_IDS.autresLoisirs, amount: euros(50) },
  ],
  lepThreshold: euros(8000),
  assuranceVieMonthly: euros(500),
  lepAccountId: ACCOUNT_IDS.lep,
  peaAccountId: ACCOUNT_IDS.pea,
  assuranceVieAccountId: ACCOUNT_IDS.assuranceVie,
  defaultAccountId: ACCOUNT_IDS.cic,
  studentLoan: {
    initialAmount: euros(38000),
    monthlyPayment: euros(350),
    /* À recaler depuis l'onglet Patrimoine avec ton vrai capital restant dû. */
    remainingCapital: euros(38000),
    lastUpdated: new Date().toISOString().slice(0, 10),
  },
  createdAt: now(),
  updatedAt: now(),
})

const seedMicroSettings = (): MicroSettings => ({
  id: 1,
  urssafRate: 0.256,
  acreEnabled: false,
  defaultPaymentTermDays: 30,
  microAccountId: ACCOUNT_IDS.micro,
  invoiceNumberPrefix: 'F',
  nextInvoiceNumber: 1,
  createdAt: now(),
  updatedAt: now(),
})

/* ------------------------------------------------------------------ */
/* Insertion                                                           */
/* ------------------------------------------------------------------ */

/** N'insère que les lignes dont l'identifiant est absent. Renvoie le nombre ajouté. */
async function addMissing<T extends { id: string }>(table: Table<T, string>, rows: T[]) {
  const existingIds = new Set(await table.toCollection().primaryKeys())
  const missing = rows.filter((row) => !existingIds.has(row.id))
  if (missing.length > 0) await table.bulkAdd(missing)
  return missing.length
}

export interface SeedReport {
  accountsAdded: number
  categoriesAdded: number
  settingsCreated: boolean
  microSettingsCreated: boolean
}

/**
 * À appeler une fois au démarrage de l'application.
 * Sans effet si les données sont déjà là — on peut donc la lancer à chaque fois.
 */
export async function seedInitialData(): Promise<SeedReport> {
  return db.transaction(
    'rw',
    [db.accounts, db.categories, db.settings, db.microSettings],
    async () => {
      const accountsAdded = await addMissing(db.accounts, seedAccounts())
      const categoriesAdded = await addMissing(db.categories, seedCategories())

      const hasSettings = (await db.settings.get(1)) !== undefined
      if (!hasSettings) await db.settings.add(seedSettings())

      const hasMicroSettings = (await db.microSettings.get(1)) !== undefined
      if (!hasMicroSettings) await db.microSettings.add(seedMicroSettings())

      return {
        accountsAdded,
        categoriesAdded,
        settingsCreated: !hasSettings,
        microSettingsCreated: !hasMicroSettings,
      }
    },
  )
}
