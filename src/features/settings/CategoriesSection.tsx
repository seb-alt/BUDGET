/**
 * src/features/settings/CategoriesSection.tsx
 *
 * Renommer, réordonner, activer, ajouter, supprimer les catégories.
 *
 * Les enveloppes d'ÉPARGNE sont un cas à part. Elles ne se remplissent pas de
 * dépenses mais de VIREMENTS vers des comptes précis : créer « LEP / PEA »
 * sans dire quels comptes elle alimente donnerait une enveloppe qui reste à
 * zéro pour toujours. D'où le choix des comptes, obligatoire, juste en dessous
 * du nom — et le fait qu'un compte déjà pris par une autre enveloppe soit
 * affiché grisé, avec le nom de celle qui le détient.
 *
 * Désactiver plutôt que supprimer est le geste normal : une catégorie
 * désactivée disparaît de la saisie mais tes anciennes opérations gardent
 * leur libellé. La suppression n'est possible que si rien ne s'y rattache —
 * la couche `db/settings.ts` refuse le reste, et le message est affiché tel quel.
 */

import { useState } from 'react'
import {
  addCategory,
  deleteCategory,
  moveCategory,
  renameCategory,
  setCategoryActive,
  setCategorySavingAccounts,
} from '../../db/settings'
import type { Account, Category, CategoryGroup } from '../../db/types'

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

/** Les groupes où l'on peut ajouter une catégorie, avec le type qui va avec. */
const ADDABLE: { group: CategoryGroup; kind: 'expense' | 'income' | 'saving' }[] = [
  { group: 'chargesFixes', kind: 'expense' },
  { group: 'epargne', kind: 'saving' },
  { group: 'loisirs', kind: 'expense' },
  { group: 'divers', kind: 'expense' },
  { group: 'revenuPerso', kind: 'income' },
  { group: 'micro', kind: 'expense' },
]

interface CategoriesSectionProps {
  categories: Category[]
  accounts: Account[]
  onSaved: (message: string) => void
}

export function CategoriesSection({ categories, accounts, onSaved }: CategoriesSectionProps) {
  const [error, setError] = useState<string>()
  const [newName, setNewName] = useState('')
  const [newGroup, setNewGroup] = useState<CategoryGroup>('loisirs')
  const [newAccountIds, setNewAccountIds] = useState<string[]>([])

  /*
   * Les cases à cocher d'une enveloppe sont pilotées par la base, mais
   * l'écriture est asynchrone. Sans cette copie locale, la case revient à son
   * état d'avant pendant le court instant qui sépare le clic de l'écriture,
   * puis se recale : un battement visible, et une case qui semble refuser le
   * clic si on enchaîne vite.
   *
   * On retient donc le choix tout de suite, et on l'oublie dès que la base
   * répond — en cas de refus, la valeur de la base reprend la main, avec son
   * message d'erreur.
   */
  const [pending, setPending] = useState<Record<string, string[]>>({})

  const accountsOf = (category: Category) =>
    pending[category.id] ?? category.savingAccountIds ?? []

  async function changeAccounts(category: Category, next: string[]) {
    setPending((current) => ({ ...current, [category.id]: next }))
    await run(() => setCategorySavingAccounts(category.id, next))
    setPending((current) => {
      const { [category.id]: _done, ...rest } = current
      return rest
    })
  }

  /** Seuls les comptes marqués « compte d'épargne » peuvent nourrir une enveloppe. */
  const savingAccounts = accounts.filter((account) => account.active && account.countsAsSavings)

  /** Quelle enveloppe détient déjà ce compte, s'il y en a une. */
  const holderOf = (accountId: string, exceptCategoryId?: string) =>
    categories.find(
      (category) =>
        category.kind === 'saving' &&
        category.id !== exceptCategoryId &&
        accountsOf(category).includes(accountId),
    )

  /** Chaque action passe par ici : une seule place pour afficher les refus. */
  async function run(action: () => Promise<unknown>, message?: string) {
    setError(undefined)
    try {
      await action()
      if (message !== undefined) onSaved(message)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "L'opération a échoué.")
    }
  }

  return (
    <div className="set-section">
      {error !== undefined && <p className="set-error">{error}</p>}

      {GROUP_ORDER.map((group) => {
        const groupCategories = categories
          .filter((category) => category.group === group)
          .sort((a, b) => a.order - b.order)
        if (groupCategories.length === 0) return null

        return (
          <div key={group} className="set-group">
            <h3 className="set-subtitle">{GROUP_LABELS[group]}</h3>
            <ul className="set-list">
              {groupCategories.map((category, index) => (
                <li key={category.id} className={category.active ? undefined : 'is-inactive'}>
                  <input
                    type="text"
                    aria-label={`Nom de ${category.name}`}
                    defaultValue={category.name}
                    // On enregistre à la sortie du champ plutôt qu'à chaque
                    // frappe : une écriture par lettre tapée est inutile.
                    onBlur={(event) => {
                      if (event.target.value.trim() !== category.name) {
                        void run(() => renameCategory(category.id, event.target.value))
                      }
                    }}
                  />

                  {category.kind === 'saving' && (
                    <div className="set-saving-accounts">
                      <span className="ui-field-hint">
                        {accountsOf(category).length === 0
                          ? '⚠ Aucun compte : cette enveloppe restera à zéro.'
                          : 'Alimentée par :'}
                      </span>
                      {savingAccounts.map((account) => {
                        const checked = accountsOf(category).includes(account.id)
                        const holder = holderOf(account.id, category.id)
                        return (
                          <label
                            key={account.id}
                            className={holder === undefined ? undefined : 'is-taken'}
                            title={
                              holder === undefined
                                ? undefined
                                : `Déjà pris par « ${holder.name} »`
                            }
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={holder !== undefined}
                              onChange={(event) =>
                                void changeAccounts(
                                  category,
                                  event.target.checked
                                    ? [...accountsOf(category), account.id]
                                    : accountsOf(category).filter((id) => id !== account.id),
                                )
                              }
                            />
                            {account.name}
                          </label>
                        )
                      })}
                    </div>
                  )}

                  <div className="set-row-actions">
                    <button
                      type="button"
                      aria-label={`Monter ${category.name}`}
                      disabled={index === 0}
                      onClick={() => void run(() => moveCategory(category.id, -1))}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Descendre ${category.name}`}
                      disabled={index === groupCategories.length - 1}
                      onClick={() => void run(() => moveCategory(category.id, 1))}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className={category.active ? 'is-on' : undefined}
                      aria-pressed={category.active}
                      aria-label={`${category.active ? 'Désactiver' : 'Activer'} ${category.name}`}
                      onClick={() =>
                        void run(() => setCategoryActive(category.id, !category.active))
                      }
                    >
                      {category.active ? 'Active' : 'Inactive'}
                    </button>
                    <button
                      type="button"
                      className="is-danger"
                      aria-label={`Supprimer ${category.name}`}
                      onClick={() =>
                        void run(() => deleteCategory(category.id), 'Catégorie supprimée.')
                      }
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )
      })}

      <div className="set-add">
        <h3 className="set-subtitle">Ajouter une catégorie</h3>
        <div className="set-add-row">
          <input
            type="text"
            aria-label="Nom de la nouvelle catégorie"
            placeholder="Nom"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
          <select
            aria-label="Groupe de la nouvelle catégorie"
            value={newGroup}
            onChange={(event) => {
              setNewGroup(event.target.value as CategoryGroup)
              setNewAccountIds([])
            }}
          >
            {ADDABLE.map(({ group }) => (
              <option key={group} value={group}>
                {GROUP_LABELS[group]}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={
              newName.trim() === '' || (newGroup === 'epargne' && newAccountIds.length === 0)
            }
            onClick={() =>
              void run(async () => {
                const kind =
                  ADDABLE.find((entry) => entry.group === newGroup)?.kind ?? 'expense'
                await addCategory({
                  name: newName,
                  kind,
                  group: newGroup,
                  // Une enveloppe d'épargne ne se saisit pas à la main : la
                  // proposer parmi les boutons d'accès rapide induirait en
                  // erreur. Elle se remplit par virement.
                  quickPick: kind !== 'saving',
                  savingAccountIds: kind === 'saving' ? newAccountIds : undefined,
                })
                setNewName('')
                setNewAccountIds([])
              }, 'Catégorie ajoutée.')
            }
          >
            Ajouter
          </button>
        </div>
        {newGroup === 'epargne' && (
          <div className="set-saving-accounts">
            <span className="ui-field-hint">
              Quels comptes cette enveloppe alimente-t-elle ? Obligatoire : une enveloppe
              d’épargne se remplit par virement, pas par dépense.
            </span>
            {savingAccounts.map((account) => {
              const holder = holderOf(account.id)
              return (
                <label
                  key={account.id}
                  className={holder === undefined ? undefined : 'is-taken'}
                  title={holder === undefined ? undefined : `Déjà pris par « ${holder.name} »`}
                >
                  <input
                    type="checkbox"
                    checked={newAccountIds.includes(account.id)}
                    disabled={holder !== undefined}
                    onChange={(event) =>
                      setNewAccountIds((current) =>
                        event.target.checked
                          ? [...current, account.id]
                          : current.filter((id) => id !== account.id),
                      )
                    }
                  />
                  {account.name}
                  {holder !== undefined && <em> — pris par {holder.name}</em>}
                </label>
              )
            })}
          </div>
        )}

        <p className="ui-field-hint">
          Son budget se règle ensuite dans la section Budget mensuel.
        </p>
      </div>
    </div>
  )
}
