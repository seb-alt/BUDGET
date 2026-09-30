/**
 * src/features/settings/ReportSection.tsx
 *
 * Le rapport d'un mois, à emporter (§12).
 *
 * À ne pas confondre avec la sauvegarde, juste en dessous :
 *
 *  - la SAUVEGARDE sert à remettre l'application d'aplomb. Elle contient tout,
 *    elle n'est pas faite pour être lue, et c'est le seul fichier capable de
 *    restaurer tes données.
 *  - le RAPPORT sert à regarder un mois. Il ne restaure rien, il est fait pour
 *    être ouvert, trié, additionné.
 *
 * Les deux sont utiles ; les confondre ne l'est pas.
 */

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { buildMonthlyReport } from '../../db/monthlyReport'
import { buildMonthlyWorkbook, workbookFileName } from '../../domain/export/monthlyReport'
import { currentMonth, formatMonthLabel } from '../../utils/date'
import { downloadBinaryFile } from '../../utils/download'
import { Field } from '../../components/ui/Field'
import { MonthlyReportSheet } from '../report/MonthlyReportSheet'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** Du mois le plus ancien connu jusqu'au mois en cours, le plus récent d'abord. */
function monthChoices(oldest: string | undefined): string[] {
  const now = currentMonth()
  const months: string[] = []
  let month = now
  // La borne de 60 évite une liste sans fin si une date aberrante traînait
  // dans la base : cinq ans d'historique suffisent largement à choisir.
  while (months.length < 60) {
    months.push(month)
    if (oldest === undefined || month <= oldest) break
    const [year, monthNumber] = month.split('-').map(Number)
    const previous = new Date(year, monthNumber - 2, 1)
    month = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`
  }
  return months
}

export function ReportSection() {
  // La plus ancienne opération borne la liste : proposer des mois où il ne
  // s'est rien passé n'aide personne.
  const oldest = useLiveQuery(
    async () => (await db.transactions.orderBy('date').first())?.date.slice(0, 7),
    [],
  )
  const [chosen, setChosen] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [error, setError] = useState<string>()

  const months = monthChoices(oldest)
  const month = chosen ?? months[0]

  async function exportExcel() {
    setBusy(true)
    setError(undefined)
    try {
      const report = await buildMonthlyReport(month)
      downloadBinaryFile(workbookFileName(month), buildMonthlyWorkbook(report), XLSX_MIME)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "L'export a échoué.")
    }
    setBusy(false)
  }

  return (
    <div className="set-section">
      <p className="ui-field-hint">
        Deux façons de sortir un mois. Le <strong>classeur Excel</strong> pour calculer :
        résumé, opérations, budget par catégorie, soldes de fin de mois, factures. Les montants
        y sont de vrais nombres, additionnables et triables. Le <strong>rapport</strong> pour
        lire et archiver : une page mise en forme, que ton navigateur enregistre en PDF.
      </p>

      <Field label="Mois">
        {({ id }) => (
          <select id={id} value={month} onChange={(event) => setChosen(event.target.value)}>
            {months.map((choice) => (
              <option key={choice} value={choice}>
                {formatMonthLabel(choice)}
              </option>
            ))}
          </select>
        )}
      </Field>

      {error !== undefined && <p className="set-error">{error}</p>}

      <button
        type="button"
        className="set-outline"
        disabled={busy}
        onClick={() => void exportExcel()}
      >
        {busy ? 'Préparation…' : 'Télécharger le classeur Excel'}
      </button>

      <button type="button" className="set-outline" onClick={() => setPreviewing(true)}>
        Voir le rapport et l'enregistrer en PDF
      </button>

      {previewing && <MonthlyReportSheet month={month} onClose={() => setPreviewing(false)} />}
    </div>
  )
}
