/**
 * src/features/dashboard/PendingRecurringCard.tsx
 *
 * Les échéances récurrentes en mode « à confirmer » (§7).
 *
 * Elles ne sont PAS encore des opérations : rien n'est compté dans le budget
 * tant que tu n'as pas dit oui. C'est toute la différence avec le mode
 * automatique, et c'est pour ça que cette carte est en haut de l'accueil
 * plutôt que dans un réglage — une proposition qu'on ne voit pas ne sert à
 * rien.
 *
 * « Écarter » ne supprime pas la règle : elle continue, seule CETTE échéance
 * est abandonnée. Sans ce bouton, une proposition refusée reviendrait à chaque
 * ouverture de l'application.
 */

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { confirmOccurrence, listPendingConfirmations, skipOccurrence } from '../../db/recurring'
import type { PendingOccurrence } from '../../domain/recurring/recurringEngine'
import { formatDayLabel } from '../../utils/date'
import { formatEurosCompact } from '../../utils/money'

export function PendingRecurringCard() {
  const pending = useLiveQuery(() => listPendingConfirmations(), [])
  // Le nom du compte ou de la catégorie rend la proposition lisible : « Loyer,
  // 780 € » sans savoir d'où l'argent part ne suffit pas pour décider.
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const [busy, setBusy] = useState<string>()
  const [error, setError] = useState<string>()

  if (pending === undefined || pending.length === 0) return null

  const keyOf = (occurrence: PendingOccurrence) => `${occurrence.rule.id}|${occurrence.date}`

  async function run(occurrence: PendingOccurrence, action: typeof confirmOccurrence) {
    setBusy(keyOf(occurrence))
    setError(undefined)
    try {
      await action(occurrence)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "L'opération a échoué.")
    }
    setBusy(undefined)
  }

  return (
    <section className="dash-card dash-pending" aria-label="Échéances à confirmer">
      <h2>
        {pending.length === 1
          ? 'Une échéance à confirmer'
          : `${pending.length} échéances à confirmer`}
      </h2>

      {error !== undefined && <p className="dash-pending-error">{error}</p>}

      <ul>
        {pending.map((occurrence) => {
          const { rule, date } = occurrence
          const category = categories?.find((entry) => entry.id === rule.categoryId)
          return (
            <li key={keyOf(occurrence)}>
              <div className="dash-pending-text">
                <span className="dash-pending-name">{rule.name}</span>
                <span className="dash-pending-meta">
                  {formatDayLabel(date)}
                  {category !== undefined && ` · ${category.name}`}
                </span>
              </div>

              <span
                className={`dash-pending-amount${rule.type === 'income' ? ' is-positive' : ''}`}
              >
                {rule.type === 'income' ? '+' : rule.type === 'transfer' ? '' : '−'}
                {formatEurosCompact(rule.amount)}
              </span>

              <div className="dash-pending-actions">
                <button
                  type="button"
                  disabled={busy !== undefined}
                  onClick={() => void run(occurrence, skipOccurrence)}
                >
                  Écarter
                </button>
                <button
                  type="button"
                  className="is-primary"
                  disabled={busy !== undefined}
                  onClick={() => void run(occurrence, confirmOccurrence)}
                >
                  {busy === keyOf(occurrence) ? '…' : 'Confirmer'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
