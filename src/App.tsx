/**
 * src/App.tsx
 *
 * ÉCRAN TEMPORAIRE DE VÉRIFICATION — sera remplacé par la vraie application.
 *
 * Il ne fait qu'une chose : lire la base de données et l'afficher, pour que tu
 * puisses vérifier d'un coup d'œil que le socle fonctionne.
 *
 * `useLiveQuery` est le lien entre Dexie et React : il relance la lecture et
 * rafraîchit l'écran automatiquement dès qu'une donnée change en base. Tant que
 * la lecture n'est pas finie, il renvoie `undefined` — d'où les gardes plus bas.
 */

import { useLiveQuery } from 'dexie-react-hooks'
import './App.css'
import { db } from './db/db'
import type { CategoryGroup } from './db/types'
import { formatEuros, sumCents } from './utils/money'

const GROUP_LABELS: Record<CategoryGroup, string> = {
  chargesFixes: 'Charges fixes',
  epargne: 'Épargne & investissement',
  loisirs: 'Loisirs',
  divers: 'Hors enveloppe budgétée',
  revenuPerso: 'Revenus personnels',
  micro: 'Dépenses micro-entreprise',
}

const GROUP_ORDER: CategoryGroup[] = [
  'chargesFixes',
  'epargne',
  'loisirs',
  'divers',
  'revenuPerso',
  'micro',
]

function App() {
  const accounts = useLiveQuery(() => db.accounts.orderBy('order').toArray(), [])
  const categories = useLiveQuery(() => db.categories.orderBy('[group+order]').toArray(), [])
  const settings = useLiveQuery(() => db.settings.get(1), [])
  const microSettings = useLiveQuery(() => db.microSettings.get(1), [])
  const transactionCount = useLiveQuery(() => db.transactions.count(), [])

  if (!accounts || !categories || !settings || !microSettings) {
    return (
      <main className="page">
        <p className="muted">Lecture de la base…</p>
      </main>
    )
  }

  const budgetByCategory = new Map(
    settings.budgetTemplate.map((line) => [line.categoryId, line.amount]),
  )
  const budgetTotal = sumCents(settings.budgetTemplate.map((line) => line.amount))

  return (
    <main className="page">
      <header className="page-header">
        <p className="eyebrow">Étape 1 — socle technique</p>
        <h1>Vérification de la base</h1>
        <p className="muted">
          Écran temporaire. Il lit directement IndexedDB et se met à jour tout seul.
        </p>
      </header>

      <section className="card">
        <h2>
          Comptes <span className="badge">{accounts.length}</span>
        </h2>
        <ul className="rows">
          {accounts.map((account) => (
            <li key={account.id} className="row">
              <span className="row-name">{account.name}</span>
              <span className="row-meta">
                {account.kind}
                {account.countsAsSavings ? ' · épargne' : ''}
                {account.ceiling ? ` · plafond ${formatEuros(account.ceiling, { showCents: false })}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>
          Catégories <span className="badge">{categories.length}</span>
        </h2>
        {GROUP_ORDER.map((group) => {
          const groupCategories = categories.filter((category) => category.group === group)
          if (groupCategories.length === 0) return null

          const groupBudget = sumCents(
            groupCategories.map((category) => budgetByCategory.get(category.id) ?? 0),
          )

          return (
            <div key={group} className="group">
              <h3>
                {GROUP_LABELS[group]}
                {groupBudget > 0 && (
                  <span className="group-total">{formatEuros(groupBudget, { showCents: false })}</span>
                )}
              </h3>
              <ul className="rows">
                {groupCategories.map((category) => {
                  const budget = budgetByCategory.get(category.id)
                  return (
                    <li key={category.id} className="row">
                      <span className="row-name">{category.name}</span>
                      <span className="row-meta">
                        {budget === undefined
                          ? 'pas de budget'
                          : formatEuros(budget, { showCents: false })}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </section>

      <section className="card">
        <h2>Réglages</h2>
        <ul className="rows">
          <li className="row">
            <span className="row-name">Revenus de référence</span>
            <span className="row-meta">{formatEuros(settings.referenceIncome, { showCents: false })}</span>
          </li>
          <li className="row">
            <span className="row-name">Total du budget</span>
            <span className="row-meta">
              {formatEuros(budgetTotal, { showCents: false })}
              {budgetTotal === settings.referenceIncome ? ' ✓' : ' ⚠ écart'}
            </span>
          </li>
          <li className="row">
            <span className="row-name">Seuil LEP</span>
            <span className="row-meta">{formatEuros(settings.lepThreshold, { showCents: false })}</span>
          </li>
          <li className="row">
            <span className="row-name">Assurance-vie mensuelle</span>
            <span className="row-meta">{formatEuros(settings.assuranceVieMonthly, { showCents: false })}</span>
          </li>
          <li className="row">
            <span className="row-name">Prêt étudiant — capital restant</span>
            <span className="row-meta">
              {formatEuros(settings.studentLoan.remainingCapital, { showCents: false })}
            </span>
          </li>
          <li className="row">
            <span className="row-name">Taux URSSAF</span>
            <span className="row-meta">
              {(microSettings.urssafRate * 100).toLocaleString('fr-FR')} %
            </span>
          </li>
          <li className="row">
            <span className="row-name">Délai de paiement par défaut</span>
            <span className="row-meta">{microSettings.defaultPaymentTermDays} jours</span>
          </li>
          <li className="row">
            <span className="row-name">Opérations enregistrées</span>
            <span className="row-meta">{transactionCount ?? 0}</span>
          </li>
        </ul>
      </section>

      <p className="muted footnote">
        Recharge la page : les nombres ci-dessus ne doivent pas bouger.
      </p>
    </main>
  )
}

export default App
