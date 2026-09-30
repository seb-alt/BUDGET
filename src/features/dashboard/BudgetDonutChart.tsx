/**
 * src/features/dashboard/BudgetDonutChart.tsx
 *
 * Le graphique en secteurs de la répartition du budget.
 *
 * Deux lectures au choix :
 *  - « Prévu »   : comment tes 2 000 € sont répartis entre les trois enveloppes ;
 *  - « Réalisé » : où l'argent est réellement parti ce mois-ci.
 *
 * Il est dessiné à la main en SVG, sans bibliothèque de graphiques. Trois
 * raisons : l'application reste légère (une bibliothèque pèse plus lourd que
 * tout le reste du code réuni), les couleurs suivent les variables du thème
 * donc le mode sombre fonctionne sans effort, et il n'y a aucune dépendance
 * extérieure à maintenir pendant des années.
 */

import { useState } from 'react'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import type { MonthSummary } from '../../domain/budget/monthSummary'
import { DonutChart } from '../../components/charts/DonutChart'
import { BUDGET_GROUPS } from './groups'
import './charts.css'

type DonutMode = 'planned' | 'actual'

const MODE_OPTIONS: { value: DonutMode; label: string }[] = [
  { value: 'planned', label: 'Prévu' },
  { value: 'actual', label: 'Réalisé' },
]

export function BudgetDonutChart({ summary }: { summary: MonthSummary }) {
  const [mode, setMode] = useState<DonutMode>('planned')

  const slices = BUDGET_GROUPS.map((definition) => {
    const group = summary.byGroup[definition.group]
    return {
      key: definition.group,
      label: definition.title,
      color: definition.color,
      value: mode === 'planned' ? group.budget : group.spent,
    }
  })

  return (
    <section className="chart-card">
      <ChartHeader mode={mode} onModeChange={setMode} />
      <DonutChart
        slices={slices}
        centerLabel="Total"
        description={`Répartition ${mode === 'planned' ? 'prévue' : 'réalisée'}`}
        emptyMessage="Rien n'a encore été dépensé ni versé ce mois-ci."
      />
    </section>
  )
}

function ChartHeader({
  mode,
  onModeChange,
}: {
  mode: DonutMode
  onModeChange: (mode: DonutMode) => void
}) {
  return (
    <>
      <h2>Répartition du budget</h2>
      <p className="chart-subtitle">
        {/* « budget du mois » et non « budget de référence » : sur un mois
            révolu, c'est le budget figé de l'époque qui est affiché. */}
        {mode === 'planned'
          ? 'Comment le budget du mois est réparti.'
          : "Où l'argent est réellement allé ce mois-ci."}
      </p>
      <div className="chart-toggle">
        <SegmentedControl
          label="Prévu ou réalisé"
          value={mode}
          options={MODE_OPTIONS}
          onChange={onModeChange}
        />
      </div>
    </>
  )
}
