/**
 * src/features/report/MonthlyReportSheet.tsx
 *
 * Le rapport en plein écran, avec le bouton d'impression.
 *
 * POURQUOI UN PORTAIL. `window.print()` imprime toute la page. Pour n'imprimer
 * que le rapport, il faut pouvoir écarter tout le reste — or le reste est son
 * PARENT : cacher le parent cacherait aussi le rapport.
 *
 * Le portail règle ça en plaçant le rapport à côté de l'application dans le
 * document, et non dedans. À l'impression, l'application entière disparaît
 * d'un `display: none` sur `#root`, et le rapport se retrouve seul sur la
 * feuille, dans le flux normal — donc correctement réparti sur plusieurs pages,
 * en-têtes de tableau répétés, sans ligne coupée en deux.
 */

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { buildMonthlyReport } from '../../db/monthlyReport'
import { buildMonthlyWorkbook, workbookFileName } from '../../domain/export/monthlyReport'
import type { MonthlyReport } from '../../domain/export/monthlyReport'
import type { IsoMonth } from '../../db/types'
import { downloadBinaryFile } from '../../utils/download'
import { MonthlyReportView } from './MonthlyReportView'
import './Report.css'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

interface MonthlyReportSheetProps {
  month: IsoMonth
  onClose: () => void
}

export function MonthlyReportSheet({ month, onClose }: MonthlyReportSheetProps) {
  const [report, setReport] = useState<MonthlyReport>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    let cancelled = false
    buildMonthlyReport(month)
      .then((built) => {
        if (!cancelled) setReport(built)
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setError(cause instanceof Error ? cause.message : 'Rapport indisponible.')
      })
    return () => {
      cancelled = true
    }
  }, [month])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return createPortal(
    <div className="report-portal">
      <div className="ui-sheet-backdrop">
        <div className="ui-sheet" role="dialog" aria-modal="true" aria-label="Rapport du mois">
          <header className="ui-sheet-header">
            <button
              type="button"
              className="ui-sheet-close"
              onClick={onClose}
              aria-label="Fermer"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M5 5l10 10M15 5L5 15"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <h2 className="ui-sheet-title">Rapport du mois</h2>
          </header>

          <div className="report-screen">
            {error !== undefined && <p className="report-empty">{error}</p>}
            {report === undefined && error === undefined && (
              <p className="report-empty">Préparation du rapport…</p>
            )}
            {report !== undefined && <MonthlyReportView report={report} />}
          </div>

          <div className="report-actions">
            <button
              type="button"
              disabled={report === undefined}
              onClick={() => {
                if (report === undefined) return
                downloadBinaryFile(
                  workbookFileName(month),
                  buildMonthlyWorkbook(report),
                  XLSX_MIME,
                )
              }}
            >
              Excel
            </button>
            <button
              type="button"
              className="is-primary"
              disabled={report === undefined}
              onClick={() => window.print()}
            >
              Imprimer / PDF
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
