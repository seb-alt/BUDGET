/**
 * src/db/types.ts
 *
 * Le "dictionnaire" de l'application : la forme exacte de chaque donnée stockée.
 * Ce fichier ne contient aucun code qui s'exécute, uniquement des définitions
 * que TypeScript utilise pour nous empêcher d'écrire des données incohérentes.
 *
 * Deux conventions valables partout dans le projet :
 *  - les montants sont des ENTIERS en CENTIMES (24,50 € -> 2450) ;
 *  - les dates sont des chaînes ISO ('2026-09-16'), triables telles quelles.
 */

/** Montant en centimes. Toujours un entier, toujours positif dans une transaction. */
export type Cents = number

/** Date au format 'AAAA-MM-JJ'. */
export type IsoDate = string

/** Mois au format 'AAAA-MM'. Sert de clé aux budgets mensuels. */
export type IsoMonth = string

/** Horodatage complet ISO ('2026-09-16T10:30:00.000Z'), pour createdAt/updatedAt. */
export type IsoTimestamp = string

/* ------------------------------------------------------------------ */
/* Comptes                                                             */
/* ------------------------------------------------------------------ */

export type AccountKind =
  | 'checking' /* compte courant  : CIC */
  | 'savings' /* épargne         : LEP */
  | 'investment' /* placement       : Assurance-vie, PEA */
  | 'micro' /* micro-entreprise */

export interface Account {
  id: string
  name: string
  kind: AccountKind
  /**
   * Règle métier centrale (cahier des charges §5 et §14) :
   * un virement vers un compte marqué ici est traité comme de l'ÉPARGNE,
   * jamais comme une dépense. C'est ce drapeau — et non une catégorie —
   * qui permet au moteur budgétaire de classer un transfert.
   */
  countsAsSavings: boolean
  /** Plafond éventuel du compte (LEP : 8 000 €). Sert à l'affichage "6 720 € / 8 000 €". */
  ceiling?: Cents
  /** Ordre d'affichage, modifiable dans les paramètres. */
  order: number
  active: boolean
}

/* ------------------------------------------------------------------ */
/* Catégories                                                          */
/* ------------------------------------------------------------------ */

export type CategoryKind =
  | 'expense' /* sortie d'argent */
  | 'income' /* entrée d'argent */
  | 'saving' /* enveloppe d'épargne planifiée (assurance-vie, flexible LEP/PEA) */

/**
 * Le "groupe" pilote l'affichage du Dashboard (une carte repliable par groupe)
 * et le calcul du budget.
 *  - 'divers' regroupe les dépenses qui n'appartiennent à aucune enveloppe
 *    budgétée (la catégorie "Autre" de l'écran de saisie). Budget = 0.
 */
export type CategoryGroup =
  | 'chargesFixes'
  | 'epargne'
  | 'loisirs'
  | 'revenuPerso'
  | 'micro'
  | 'divers'

export interface Category {
  id: string
  name: string
  kind: CategoryKind
  group: CategoryGroup
  order: number
  active: boolean
  /** Dépense de la micro-entreprise (cahier des charges §14 : pas de table séparée). */
  isMicro?: boolean
  /**
   * Uniquement pour les catégories `kind: 'saving'` : les comptes alimentés par
   * cette enveloppe. L'enveloppe flexible pointe vers le LEP et le PEA, celle
   * de l'assurance-vie vers le compte assurance-vie.
   *
   * Grâce à ça, le Dashboard n'a besoin de connaître AUCUN identifiant de
   * catégorie en dur : il lit la correspondance depuis la base.
   */
  savingAccountIds?: string[]
  /** Affichée comme bouton d'accès rapide dans l'écran "Nouvelle opération". */
  quickPick?: boolean
}

/* ------------------------------------------------------------------ */
/* Transactions                                                        */
/* ------------------------------------------------------------------ */

export type TransactionType = 'expense' | 'income' | 'transfer'

/**
 * Une ligne d'opération réelle.
 *
 * Selon `type`, les champs utilisés diffèrent :
 *  - 'expense' / 'income' : categoryId + accountId
 *  - 'transfer'           : fromAccountId + toAccountId, JAMAIS de categoryId
 *
 * IndexedDB stocke des objets plats, donc tous les champs sont optionnels ici ;
 * les fonctions de garde plus bas permettent de retrouver la certitude côté code.
 */
export interface Transaction {
  id: string
  date: IsoDate
  type: TransactionType
  /** Toujours POSITIF. Le sens (entrée/sortie) est porté par `type`, pas par le signe. */
  amount: Cents

  /** 'expense' | 'income' uniquement. */
  categoryId?: string
  /** 'expense' | 'income' uniquement : le compte impacté. */
  accountId?: string

  /** 'transfer' uniquement. */
  fromAccountId?: string
  /** 'transfer' uniquement. Si ce compte a countsAsSavings, c'est de l'épargne. */
  toAccountId?: string

  label?: string

  /** Rattache l'opération à la micro-entreprise (dépense pro, encaissement client). */
  isMicro?: boolean
  /** Si l'opération correspond à l'encaissement d'une facture. */
  microInvoiceId?: string
  /** Si l'opération a été générée par une règle récurrente. */
  recurringRuleId?: string

  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

/** Garde de type : cette transaction est-elle une dépense ou un revenu catégorisé ? */
export function isCategorised(
  t: Transaction,
): t is Transaction & { categoryId: string; accountId: string } {
  return t.type !== 'transfer' && t.categoryId !== undefined && t.accountId !== undefined
}

/** Garde de type : cette transaction est-elle un transfert entre deux comptes ? */
export function isTransfer(
  t: Transaction,
): t is Transaction & { fromAccountId: string; toAccountId: string } {
  return t.type === 'transfer' && t.fromAccountId !== undefined && t.toAccountId !== undefined
}

/* ------------------------------------------------------------------ */
/* Budgets mensuels figés                                              */
/* ------------------------------------------------------------------ */

export interface BudgetLine {
  categoryId: string
  amount: Cents
}

/**
 * Photo FIGÉE du budget au moment où le mois a été ouvert (cahier des charges §11).
 * Si tu changes ton budget en 2027, septembre 2026 garde ses chiffres d'origine :
 * c'est cette table qui le garantit, jamais `settings`.
 */
export interface MonthlyBudget {
  /** Clé primaire = le mois ('2026-09'). */
  id: IsoMonth
  month: IsoMonth
  lines: BudgetLine[]
  /** Copies figées des réglages qui influencent les calculs de ce mois-là. */
  referenceIncome: Cents
  lepThreshold: Cents
  assuranceVieMonthly: Cents
  createdAt: IsoTimestamp
  /**
   * Dernière mise à jour de la photo. Tant que le mois est EN COURS, elle suit
   * les réglages et cette date bouge. Une fois le mois révolu, elle ne bouge
   * plus : c'est la date à laquelle le budget a été figé.
   */
  updatedAt: IsoTimestamp
}

/* ------------------------------------------------------------------ */
/* Opérations récurrentes                                              */
/* ------------------------------------------------------------------ */

export type Frequency = 'monthly' | 'weekly' | 'yearly'

/** 'auto' : créée toute seule. 'confirm' : proposée, il faut cliquer sur Confirmer. */
export type RecurringMode = 'auto' | 'confirm'

export interface RecurringRule {
  id: string
  name: string
  type: TransactionType
  amount: Cents
  categoryId?: string
  accountId?: string
  fromAccountId?: string
  toAccountId?: string
  frequency: Frequency
  /** Jour du mois (1-31) pour une règle mensuelle. */
  dayOfMonth: number
  startDate: IsoDate
  endDate?: IsoDate
  active: boolean
  mode: RecurringMode
  isMicro?: boolean
  /**
   * Échéances que tu as explicitement écartées, en mode « à confirmer ».
   * Sans cette liste, une proposition refusée reviendrait à chaque ouverture
   * de l'application : impossible de s'en débarrasser.
   */
  skippedDates?: IsoDate[]
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

/* ------------------------------------------------------------------ */
/* Patrimoine                                                          */
/* ------------------------------------------------------------------ */

export interface SnapshotBalance {
  accountId: string
  balance: Cents
}

/**
 * Relevé daté des soldes réels, saisi manuellement via "Actualiser mes soldes".
 * C'est la matière première des courbes historiques du Patrimoine.
 */
export interface PatrimonySnapshot {
  id: string
  date: IsoDate
  balances: SnapshotBalance[]
  /** Capital restant dû du prêt étudiant à cette date (pour la courbe de dette). */
  loanRemaining?: Cents
  note?: string
  createdAt: IsoTimestamp
}

/* ------------------------------------------------------------------ */
/* Micro-entreprise                                                    */
/* ------------------------------------------------------------------ */

export interface MicroClient {
  id: string
  name: string
  /** Tarif horaire HT, pré-remplit une nouvelle facture. */
  hourlyRate?: Cents
  /** Délai de paiement propre à ce client ; sinon celui de microSettings. */
  paymentTermDays?: number
  active: boolean
  notes?: string
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type InvoiceStatus =
  | 'draft' /* Brouillon */
  | 'issued' /* Émise */
  | 'awaiting' /* À recevoir */
  | 'paid' /* Payée */
  | 'late' /* En retard */
  | 'cancelled' /* Annulée */

export interface MicroInvoice {
  id: string
  number: string
  clientId: string
  issueDate: IsoDate
  /** Montant HT facturé. */
  amount: Cents
  dueDate: IsoDate
  status: InvoiceStatus
  paymentDate?: IsoDate
  /** Montant réellement encaissé (peut différer en cas de paiement partiel). */
  paidAmount?: Cents
  hours?: number
  notes?: string
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

/**
 * Prévisionnel d'heures par client et par mois (planning ESAIL du cahier des charges §9).
 * Alimente la comparaison Prévu / Facturé / Encaissé.
 */
export interface MicroForecast {
  id: string
  clientId: string
  month: IsoMonth
  plannedHours: number
  /** Tarif retenu pour ce mois-là (peut évoluer indépendamment du client). */
  hourlyRate: Cents
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

/* ------------------------------------------------------------------ */
/* Réglages                                                            */
/* ------------------------------------------------------------------ */

export interface StudentLoan {
  initialAmount: Cents
  monthlyPayment: Cents
  remainingCapital: Cents
  lastUpdated: IsoDate
}

/**
 * Table à UNE SEULE LIGNE (id vaut toujours 1).
 * Tout ce qui est réglable sans toucher au code vit ici : aucune valeur métier
 * ne doit jamais être écrite en dur dans un composant React.
 */
export interface Settings {
  id: 1
  /** Revenu mensuel de référence servant à bâtir le budget type. */
  referenceIncome: Cents
  /** Budget courant par sous-catégorie. Recopié dans monthlyBudgets à l'ouverture d'un mois. */
  budgetTemplate: BudgetLine[]
  /** Seuil au-delà duquel le LEP est considéré comme plein (8 000 € par défaut). */
  lepThreshold: Cents
  /** Versement mensuel incompressible vers l'assurance-vie. */
  assuranceVieMonthly: Cents

  /**
   * La catégorie dont le budget n'est PAS fixe : son montant est recalculé
   * chaque mois par la règle de l'enveloppe flexible (§4), à partir des
   * revenus réellement encaissés. Toutes les autres lignes restent stables.
   */
  flexibleSavingsCategoryId: string

  /* Comptes utilisés par le moteur de répartition LEP / PEA. */
  lepAccountId: string
  peaAccountId: string
  assuranceVieAccountId: string
  /** Compte proposé par défaut à la saisie d'une opération (CIC). */
  defaultAccountId: string

  studentLoan: StudentLoan

  /** Date de la dernière sauvegarde complète, pour le rappel discret (§12). */
  lastBackupAt?: IsoTimestamp
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

/** Table à une seule ligne également (id vaut toujours 1). */
export interface MicroSettings {
  id: 1
  /** Taux URSSAF, jamais codé en dur. 0.256 = 25,6 %. */
  urssafRate: number
  /** Pas d'ACRE actuellement, mais le champ existe pour plus tard. */
  acreEnabled: boolean
  /** Délai de paiement par défaut, en jours. */
  defaultPaymentTermDays: number
  /** Compte sur lequel arrivent les encaissements micro. */
  microAccountId: string
  /**
   * Catégorie qui enregistre les versements RÉELLEMENT faits à l'URSSAF.
   * Les distinguer de la provision calculée est indispensable : sans ça,
   * impossible de savoir ce qu'il reste à payer.
   */
  urssafCategoryId: string
  invoiceNumberPrefix: string
  nextInvoiceNumber: number
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}
