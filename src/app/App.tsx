/**
 * src/app/App.tsx
 *
 * La coquille de l'application : ce qui reste à l'écran quel que soit l'onglet.
 *
 * - une zone de contenu qui change selon l'onglet choisi ;
 * - la barre de navigation basse, avec le bouton + surélevé au centre (§3) ;
 * - le panneau de saisie, qui se superpose au reste.
 *
 * Trois onglets ne sont pas encore construits et l'annoncent clairement :
 * mieux vaut une case honnêtement vide qu'un bouton qui ne fait rien.
 */

import { useEffect, useState, type ReactElement } from 'react'
import { Dashboard } from '../features/dashboard/Dashboard'
import { OperationSheet } from '../features/operations/OperationSheet'
import { OperationsList } from '../features/operations/OperationsList'
import type { Transaction } from '../db/types'
import './App.css'

type Tab = 'accueil' | 'operations' | 'patrimoine' | 'micro'

const TABS: { id: Tab; label: string; icon: ReactElement }[] = [
  {
    id: 'accueil',
    label: 'Accueil',
    icon: (
      <path
        d="M3 9.5 10 4l7 5.5V16a1 1 0 0 1-1 1h-4v-4H8v4H4a1 1 0 0 1-1-1V9.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="none"
      />
    ),
  },
  {
    id: 'operations',
    label: 'Opérations',
    icon: (
      <path
        d="M4 5.5h12M4 10h12M4 14.5h8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    ),
  },
  {
    id: 'patrimoine',
    label: 'Patrimoine',
    icon: (
      <path
        d="M3 15V9m4.667 6V5M12.333 15v-4M17 15V7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    ),
  },
  {
    id: 'micro',
    label: 'Micro',
    icon: (
      <path
        d="M3.5 7.5h13v8a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-8ZM7.5 7.5v-2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="none"
      />
    ),
  },
]

const PLACEHOLDERS: Record<'patrimoine' | 'micro', string> = {
  patrimoine: "L'onglet Patrimoine (soldes, courbes, prêt étudiant) n'est pas encore construit.",
  micro: "L'onglet Micro-entreprise (factures, clients, URSSAF) n'est pas encore construit.",
}

export default function App() {
  const [tab, setTab] = useState<Tab>('accueil')
  /**
   * Le panneau de saisie a trois états : fermé, ouvert en création, ouvert en
   * modification d'une opération précise. Un seul état les porte tous les
   * trois, pour qu'il soit impossible d'être « en création ET en modification ».
   */
  const [sheet, setSheet] = useState<{ transaction?: Transaction } | undefined>()
  const [toast, setToast] = useState<string>()

  // Le message de confirmation disparaît tout seul au bout de 2,5 secondes.
  useEffect(() => {
    if (toast === undefined) return
    const timer = setTimeout(() => setToast(undefined), 2500)
    return () => clearTimeout(timer)
  }, [toast])

  return (
    <div className="app">
      <main className="app-main">
        {tab === 'accueil' && <Dashboard onShowAllOperations={() => setTab('operations')} />}
        {tab === 'operations' && (
          <OperationsList onEdit={(transaction) => setSheet({ transaction })} />
        )}
        {(tab === 'patrimoine' || tab === 'micro') && (
          <div className="app-placeholder">
            <h1>{TABS.find((item) => item.id === tab)?.label}</h1>
            <p>{PLACEHOLDERS[tab]}</p>
          </div>
        )}
      </main>

      {toast !== undefined && (
        <p className="app-toast" role="status">
          {toast}
        </p>
      )}

      <nav className="app-nav" aria-label="Navigation principale">
        {TABS.slice(0, 2).map((item) => (
          <NavButton key={item.id} item={item} current={tab} onSelect={setTab} />
        ))}

        <button
          type="button"
          className="app-add"
          aria-label="Nouvelle opération"
          onClick={() => setSheet({})}
        >
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
            <path d="M13 6v14M6 13h14" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
          </svg>
        </button>

        {TABS.slice(2).map((item) => (
          <NavButton key={item.id} item={item} current={tab} onSelect={setTab} />
        ))}
      </nav>

      {sheet !== undefined && (
        <OperationSheet
          // Remonter l'identifiant dans la clé force React à repartir d'un
          // formulaire neuf quand on passe d'une opération à une autre, au
          // lieu de garder les valeurs de la précédente.
          key={sheet.transaction?.id ?? 'nouvelle'}
          transaction={sheet.transaction}
          onClose={() => setSheet(undefined)}
          onSaved={setToast}
        />
      )}
    </div>
  )
}

function NavButton({
  item,
  current,
  onSelect,
}: {
  item: (typeof TABS)[number]
  current: Tab
  onSelect: (tab: Tab) => void
}) {
  const isCurrent = current === item.id
  return (
    <button
      type="button"
      className="app-nav-button"
      aria-current={isCurrent ? 'page' : undefined}
      onClick={() => onSelect(item.id)}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        {item.icon}
      </svg>
      <span>{item.label}</span>
    </button>
  )
}
