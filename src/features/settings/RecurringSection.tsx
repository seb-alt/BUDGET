/**
 * src/features/settings/RecurringSection.tsx
 *
 * La liste des règles récurrentes (§7).
 *
 * Désactiver plutôt que supprimer reste le geste normal : une règle
 * désactivée ne produit plus rien, mais reste là pour être réactivée — et les
 * opérations qu'elle a déjà créées ne bougent pas, ce sont de vraies dépenses.
 */

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { setRuleActive } from '../../db/recurring'
import type { Account, Category, RecurringRule, Settings } from '../../db/types'
import { formatEurosCompact } from '../../utils/money'
import { RecurringRuleSheet } from './RecurringRuleSheet'

const FREQUENCY_LABELS: Record<RecurringRule['frequency'], string> = {
  monthly: 'chaque mois',
  weekly: 'chaque semaine',
  yearly: 'chaque année',
}

interface RecurringSectionProps {
  settings: Settings
  categories: Category[]
  accounts: Account[]
  onSaved: (message: string) => void
}

export function RecurringSection({
  settings,
  categories,
  accounts,
  onSaved,
}: RecurringSectionProps) {
  const rules = useLiveQuery(() => db.recurringRules.toArray(), [])
  const [sheet, setSheet] = useState<{ rule?: RecurringRule }>()
  const [error, setError] = useState<string>()

  const nameOf = (id?: string) =>
    [...categories, ...accounts].find((entry) => entry.id === id)?.name ?? ''

  return (
    <div className="set-section">
      {error !== undefined && <p className="set-error">{error}</p>}

      {rules === undefined || rules.length === 0 ? (
        <p className="ui-field-hint">
          Aucune règle. Crées-en une pour ton loyer ou tes abonnements : l'opération se créera
          toute seule, ou te sera proposée, selon le mode choisi.
        </p>
      ) : (
        <ul className="set-list">
          {[...rules]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((rule) => (
              <li key={rule.id} className={rule.active ? undefined : 'is-inactive'}>
                <button
                  type="button"
                  className="set-rule"
                  onClick={() => setSheet({ rule })}
                  aria-label={`Modifier ${rule.name}`}
                >
                  <span className="set-rule-name">{rule.name}</span>
                  <span className="set-rule-meta">
                    {formatEurosCompact(rule.amount)} · {FREQUENCY_LABELS[rule.frequency]}
                    {rule.frequency !== 'weekly' && ` le ${rule.dayOfMonth}`}
                    {' · '}
                    {rule.type === 'transfer'
                      ? `${nameOf(rule.fromAccountId)} → ${nameOf(rule.toAccountId)}`
                      : nameOf(rule.categoryId)}
                    {' · '}
                    {rule.mode === 'auto' ? 'automatique' : 'à confirmer'}
                  </span>
                </button>

                <div className="set-row-actions">
                  <button
                    type="button"
                    className={rule.active ? 'is-on' : undefined}
                    aria-pressed={rule.active}
                    aria-label={`${rule.active ? 'Désactiver' : 'Activer'} ${rule.name}`}
                    onClick={() =>
                      void setRuleActive(rule.id, !rule.active).catch((cause: unknown) =>
                        setError(cause instanceof Error ? cause.message : 'Échec.'),
                      )
                    }
                  >
                    {rule.active ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </li>
            ))}
        </ul>
      )}

      <button type="button" className="set-outline" onClick={() => setSheet({})}>
        + Nouvelle règle
      </button>

      {sheet !== undefined && (
        <RecurringRuleSheet
          key={sheet.rule?.id ?? 'nouvelle'}
          rule={sheet.rule}
          categories={categories}
          accounts={accounts}
          defaultAccountId={settings.defaultAccountId}
          onClose={() => setSheet(undefined)}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}
