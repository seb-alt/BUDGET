/**
 * src/features/settings/SettingsSheet.tsx
 *
 * L'écran Paramètres (§10). Tout ce qui se règle sans toucher au code.
 *
 * Les sections sont repliées par défaut : la liste des catégories et des
 * comptes est longue, et on vient presque toujours ne changer qu'une chose.
 *
 * Chaque section enregistre pour son compte. Un seul gros bouton en bas
 * obligerait à relire tout l'écran avant de sauver un simple montant.
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { Sheet } from '../../components/ui/Sheet'
import { db } from '../../db/db'
import { AccountsSection } from './AccountsSection'
import { BackupSection } from './BackupSection'
import { BudgetSection } from './BudgetSection'
import { CategoriesSection } from './CategoriesSection'
import { MicroSection } from './MicroSection'
import { RecurringSection } from './RecurringSection'
import { SavingsSection } from './SavingsSection'
import './Settings.css'

interface SettingsSheetProps {
  onClose: () => void
  onSaved: (message: string) => void
}

export function SettingsSheet({ onClose, onSaved }: SettingsSheetProps) {
  const settings = useLiveQuery(() => db.settings.get(1), [])
  const microSettings = useLiveQuery(() => db.microSettings.get(1), [])
  const categories = useLiveQuery(() => db.categories.orderBy('[group+order]').toArray(), [])
  const accounts = useLiveQuery(() => db.accounts.orderBy('order').toArray(), [])

  if (!settings || !microSettings || !categories || !accounts) {
    return (
      <Sheet title="Paramètres" onClose={onClose}>
        <p className="set-loading">Chargement…</p>
      </Sheet>
    )
  }

  return (
    <Sheet title="Paramètres" onClose={onClose}>
      <div className="set-body">
        <details className="set-card" open>
          <summary>
            <span>Budget mensuel</span>
            <span className="set-caret" aria-hidden="true">
              ›
            </span>
          </summary>
          <BudgetSection settings={settings} categories={categories} onSaved={onSaved} />
        </details>

        <details className="set-card">
          <summary>
            <span>Épargne et prêt</span>
            <span className="set-caret" aria-hidden="true">
              ›
            </span>
          </summary>
          <SavingsSection settings={settings} onSaved={onSaved} />
        </details>

        <details className="set-card">
          <summary>
            <span>Catégories</span>
            <span className="set-caret" aria-hidden="true">
              ›
            </span>
          </summary>
          <CategoriesSection categories={categories} onSaved={onSaved} />
        </details>

        <details className="set-card">
          <summary>
            <span>Comptes</span>
            <span className="set-caret" aria-hidden="true">
              ›
            </span>
          </summary>
          <AccountsSection accounts={accounts} onSaved={onSaved} />
        </details>

        <details className="set-card">
          <summary>
            <span>Opérations récurrentes</span>
            <span className="set-caret" aria-hidden="true">
              ›
            </span>
          </summary>
          <RecurringSection
            settings={settings}
            categories={categories}
            accounts={accounts}
            onSaved={onSaved}
          />
        </details>

        <details className="set-card">
          <summary>
            <span>Micro-entreprise</span>
            <span className="set-caret" aria-hidden="true">
              ›
            </span>
          </summary>
          <MicroSection microSettings={microSettings} onSaved={onSaved} />
        </details>

        <details className="set-card">
          <summary>
            <span>Sauvegarde et export</span>
            <span className="set-caret" aria-hidden="true">
              ›
            </span>
          </summary>
          <BackupSection settings={settings} onSaved={onSaved} />
        </details>

        <p className="set-todo">
          Les clients de la micro-entreprise se règlent depuis l'onglet Micro.
        </p>
      </div>
    </Sheet>
  )
}
