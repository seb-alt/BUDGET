/**
 * src/features/settings/CategoriesSection.tsx
 *
 * Renommer, réordonner, activer, ajouter, supprimer les catégories.
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
} from '../../db/settings'
import type { Category, CategoryGroup } from '../../db/types'

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
const ADDABLE: { group: CategoryGroup; kind: 'expense' | 'income' }[] = [
  { group: 'chargesFixes', kind: 'expense' },
  { group: 'loisirs', kind: 'expense' },
  { group: 'divers', kind: 'expense' },
  { group: 'revenuPerso', kind: 'income' },
  { group: 'micro', kind: 'expense' },
]

interface CategoriesSectionProps {
  categories: Category[]
  onSaved: (message: string) => void
}

export function CategoriesSection({ categories, onSaved }: CategoriesSectionProps) {
  const [error, setError] = useState<string>()
  const [newName, setNewName] = useState('')
  const [newGroup, setNewGroup] = useState<CategoryGroup>('loisirs')

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
                      onClick={() => void run(() => deleteCategory(category.id), 'Catégorie supprimée.')}
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
            onChange={(event) => setNewGroup(event.target.value as CategoryGroup)}
          >
            {ADDABLE.map(({ group }) => (
              <option key={group} value={group}>
                {GROUP_LABELS[group]}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={newName.trim() === ''}
            onClick={() =>
              void run(async () => {
                await addCategory({
                  name: newName,
                  kind: ADDABLE.find((entry) => entry.group === newGroup)?.kind ?? 'expense',
                  group: newGroup,
                  quickPick: true,
                })
                setNewName('')
              }, 'Catégorie ajoutée.')
            }
          >
            Ajouter
          </button>
        </div>
        <p className="ui-field-hint">
          Son budget se règle ensuite dans la section Budget mensuel.
        </p>
      </div>
    </div>
  )
}
