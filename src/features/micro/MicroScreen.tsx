/**
 * src/features/micro/MicroScreen.tsx
 *
 * L'onglet Micro-entreprise (§9), clairement séparé du budget personnel.
 *
 * L'année est l'unité naturelle ici : les seuils et les déclarations de la
 * micro-entreprise se raisonnent par année civile, pas par mois.
 *
 * Tous les montants s'entendent AVANT impôt sur le revenu personnel — c'est
 * écrit à l'écran, parce que confondre les deux conduit à se croire plus riche
 * qu'on ne l'est.
 */

import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { GroupedBarChart } from '../../components/charts/GroupedBarChart'
import { db } from '../../db/db'
import { markInvoicePaid, nextInvoiceNumber, setForecast } from '../../db/micro'
import type { MicroClient, MicroInvoice, Transaction } from '../../db/types'
import { effectiveStatus, invoiceAlerts } from '../../domain/micro/invoices'
import { buildForecastComparison, computeMicroSummary } from '../../domain/micro/microSummary'
import { formatPercent } from '../../domain/settings/settingsRules'
import { today } from '../../utils/date'
import { formatEurosCompact } from '../../utils/money'
import { Field } from '../../components/ui/Field'
import { ClientSheet } from './ClientSheet'
import { InvoiceSheet } from './InvoiceSheet'
import './Micro.css'

const STATUS_LABELS: Record<MicroInvoice['status'], string> = {
  draft: 'Brouillon',
  issued: 'Émise',
  awaiting: 'À recevoir',
  paid: 'Payée',
  late: 'En retard',
  cancelled: 'Annulée',
}

const MONTH_LABEL = new Intl.DateTimeFormat('fr-FR', { month: 'short' })

interface MicroScreenProps {
  onAddExpense: () => void
}

export function MicroScreen({ onAddExpense }: MicroScreenProps) {
  const [year, setYear] = useState(Number(today().slice(0, 4)))
  const [invoiceSheet, setInvoiceSheet] = useState<{ invoice?: MicroInvoice; number: string }>()
  const [clientSheet, setClientSheet] = useState<{ client?: MicroClient }>()
  const [toast, setToast] = useState<string>()

  const microSettings = useLiveQuery(() => db.microSettings.get(1), [])
  const clients = useLiveQuery(() => db.microClients.toArray(), [])
  const allInvoices = useLiveQuery(() => db.microInvoices.toArray(), [])
  const forecasts = useLiveQuery(() => db.microForecasts.toArray(), [])
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const microExpenses = useLiveQuery(
    () => db.transactions.filter((t) => t.isMicro === true && t.type === 'expense').toArray(),
    [],
  )

  /** Une facture appartient à l'année de son émission. */
  const invoices = useMemo(
    () => (allInvoices ?? []).filter((invoice) => invoice.issueDate.startsWith(String(year))),
    [allInvoices, year],
  )

  const expenses = useMemo(
    () => (microExpenses ?? []).filter((expense) => expense.date.startsWith(String(year))),
    [microExpenses, year],
  )

  const summary = useMemo(
    () =>
      computeMicroSummary({
        invoices,
        expenses,
        urssafCategoryId: microSettings?.urssafCategoryId ?? '',
        urssafRate: microSettings?.urssafRate ?? 0,
      }),
    [invoices, expenses, microSettings],
  )

  const alerts = useMemo(() => invoiceAlerts(allInvoices ?? [], today()), [allInvoices])

  const months = useMemo(
    () => Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`),
    [year],
  )

  const forecastRows = useMemo(
    () =>
      buildForecastComparison({
        months,
        forecasts: (forecasts ?? []).filter((forecast) => forecast.month.startsWith(String(year))),
        invoices,
      }),
    [months, forecasts, invoices, year],
  )

  /** On n'affiche que les mois où il se passe quelque chose. */
  const activeForecastRows = forecastRows.filter(
    (row) => row.planned > 0 || row.invoiced > 0 || row.collected > 0,
  )

  const clientName = (id: string) =>
    (clients ?? []).find((client) => client.id === id)?.name ?? 'Client inconnu'
  const categoryName = (id?: string) =>
    (categories ?? []).find((category) => category.id === id)?.name ?? 'Sans catégorie'

  if (!microSettings || !clients || !allInvoices || !forecasts || !microExpenses || !categories) {
    return <p className="mic-loading">Chargement…</p>
  }

  async function openNewInvoice() {
    setInvoiceSheet({ number: await nextInvoiceNumber(year) })
  }

  const sortedInvoices = [...invoices].sort((a, b) => b.issueDate.localeCompare(a.issueDate))

  return (
    <div className="mic">
      <div className="mic-head">
        <h1 className="mic-title">Micro-entreprise</h1>
        <div className="mic-year">
          <button type="button" aria-label="Année précédente" onClick={() => setYear(year - 1)}>
            ‹
          </button>
          <span className="tabular">{year}</span>
          <button type="button" aria-label="Année suivante" onClick={() => setYear(year + 1)}>
            ›
          </button>
        </div>
      </div>

      <section className="mic-indicators" aria-label="Indicateurs de la micro-entreprise">
        <Indicator label="CA encaissé" amount={summary.collected} strong />
        <Indicator label="À recevoir" amount={summary.awaiting} />
        <Indicator label="URSSAF provisionnée" amount={summary.urssafProvisioned} />
        <Indicator label="Disponible estimé" amount={summary.available} strong />
      </section>
      <p className="mic-caveat">
        Avant impôt sur le revenu personnel. Les cotisations sont provisionnées sur le chiffre
        d'affaires <strong>encaissé</strong>, jamais sur le facturé.
      </p>

      {alerts.length > 0 && (
        <section className="mic-alerts" aria-label="Factures à surveiller">
          {alerts.slice(0, 4).map((alert) => (
            <button
              key={alert.invoice.id}
              type="button"
              className={`mic-alert${alert.kind === 'late' ? ' is-late' : ''}`}
              onClick={() => setInvoiceSheet({ invoice: alert.invoice, number: alert.invoice.number })}
            >
              <span className="mic-alert-text">
                {alert.kind === 'late'
                  ? `Facture en retard de ${alert.days} jour${alert.days > 1 ? 's' : ''}`
                  : alert.days === 0
                    ? "Paiement attendu aujourd'hui"
                    : `Paiement attendu dans ${alert.days} jour${alert.days > 1 ? 's' : ''}`}
                <span className="mic-alert-sub">
                  {alert.invoice.number} · {clientName(alert.invoice.clientId)}
                </span>
              </span>
              <span className="tabular">{formatEurosCompact(alert.invoice.amount)}</span>
            </button>
          ))}
        </section>
      )}

      <section className="mic-card">
        <div className="mic-card-head">
          <h2>Factures</h2>
          <button type="button" className="mic-add" onClick={() => void openNewInvoice()}>
            + Facture
          </button>
        </div>

        {sortedInvoices.length === 0 ? (
          <p className="mic-empty">Aucune facture en {year}.</p>
        ) : (
          <ul className="mic-list">
            {sortedInvoices.map((invoice) => {
              const status = effectiveStatus(invoice, today())
              return (
                <li key={invoice.id}>
                  <button
                    type="button"
                    onClick={() => setInvoiceSheet({ invoice, number: invoice.number })}
                  >
                    <span className="mic-row-text">
                      <span className="mic-row-title">
                        {invoice.number} · {clientName(invoice.clientId)}
                      </span>
                      <span className="mic-row-meta">
                        Émise le {invoice.issueDate.split('-').reverse().join('/')} · échéance{' '}
                        {invoice.dueDate.split('-').reverse().join('/')}
                      </span>
                    </span>
                    <span className="mic-row-right">
                      <span className="tabular">{formatEurosCompact(invoice.amount)}</span>
                      {/* Le statut est écrit en toutes lettres : la couleur
                          seule ne dirait rien à qui ne la distingue pas. */}
                      <span className={`mic-status is-${status}`}>{STATUS_LABELS[status]}</span>
                    </span>
                  </button>

                  {(status === 'awaiting' || status === 'issued' || status === 'late') && (
                    <button
                      type="button"
                      className="mic-mark-paid"
                      onClick={() =>
                        void markInvoicePaid(invoice.id, today()).then(() =>
                          setToast('Facture encaissée.'),
                        )
                      }
                    >
                      Marquer encaissée
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="mic-card">
        <h2>URSSAF</h2>
        <dl className="mic-urssaf">
          <div>
            <dt>Provisionnée ({formatPercent(microSettings.urssafRate)} %)</dt>
            <dd className="tabular">{formatEurosCompact(summary.urssafProvisioned)}</dd>
          </div>
          <div>
            <dt>Déjà versée</dt>
            <dd className="tabular">{formatEurosCompact(summary.urssafPaid)}</dd>
          </div>
          <div className="mic-urssaf-total">
            <dt>Reste à verser</dt>
            <dd className="tabular">{formatEurosCompact(summary.urssafRemaining)}</dd>
          </div>
        </dl>
        <p className="mic-hint">
          Enregistre un versement comme une dépense professionnelle, catégorie URSSAF.
        </p>
      </section>

      <section className="mic-card">
        <h2>Prévisionnel</h2>
        <p className="mic-subtitle">
          Le facturé est rattaché au mois d'émission, l'encaissé au mois du paiement : le
          décalage entre les deux est normal.
        </p>
        <GroupedBarChart
          groups={activeForecastRows.map((row) => ({
            label: MONTH_LABEL.format(new Date(`${row.month}-01T12:00:00`)),
            values: [row.planned, row.invoiced, row.collected],
          }))}
          series={[
            { name: 'Prévu', color: 'var(--chart-1)' },
            { name: 'Facturé', color: 'var(--chart-2)' },
            { name: 'Encaissé', color: 'var(--chart-3)' },
          ]}
          description="Prévu, facturé et encaissé par mois"
          emptyMessage="Renseigne un planning d'heures ci-dessous pour voir le prévisionnel."
        />

        <ForecastEditor clients={clients} year={year} forecasts={forecasts} onSaved={setToast} />
      </section>

      <section className="mic-card">
        <div className="mic-card-head">
          <h2>Dépenses professionnelles</h2>
          <button type="button" className="mic-add" onClick={onAddExpense}>
            + Dépense
          </button>
        </div>
        {expenses.length === 0 ? (
          <p className="mic-empty">Aucune dépense professionnelle en {year}.</p>
        ) : (
          <ul className="mic-expenses">
            {[...expenses]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((expense: Transaction) => (
                <li key={expense.id}>
                  <span>
                    {categoryName(expense.categoryId)}
                    {expense.label !== undefined && <em> · {expense.label}</em>}
                  </span>
                  <span className="tabular">−{formatEurosCompact(expense.amount)}</span>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="mic-card">
        <div className="mic-card-head">
          <h2>Clients</h2>
          <button type="button" className="mic-add" onClick={() => setClientSheet({})}>
            + Client
          </button>
        </div>
        {clients.length === 0 ? (
          <p className="mic-empty">Aucun client. Commence par en créer un.</p>
        ) : (
          <ul className="mic-list">
            {clients.map((client) => (
              <li key={client.id}>
                <button type="button" onClick={() => setClientSheet({ client })}>
                  <span className="mic-row-text">
                    <span className="mic-row-title">{client.name}</span>
                    <span className="mic-row-meta">
                      {client.hourlyRate === undefined
                        ? 'Pas de tarif horaire'
                        : `${formatEurosCompact(client.hourlyRate)} / heure`}
                      {' · '}
                      {client.paymentTermDays ?? microSettings.defaultPaymentTermDays} jours
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {toast !== undefined && (
        <p className="mic-toast" role="status">
          {toast}
        </p>
      )}

      {invoiceSheet !== undefined && (
        <InvoiceSheet
          key={invoiceSheet.invoice?.id ?? 'nouvelle'}
          invoice={invoiceSheet.invoice}
          clients={clients}
          suggestedNumber={invoiceSheet.number}
          defaultTermDays={microSettings.defaultPaymentTermDays}
          onClose={() => setInvoiceSheet(undefined)}
          onSaved={setToast}
        />
      )}

      {clientSheet !== undefined && (
        <ClientSheet
          key={clientSheet.client?.id ?? 'nouveau'}
          client={clientSheet.client}
          defaultTermDays={microSettings.defaultPaymentTermDays}
          onClose={() => setClientSheet(undefined)}
          onSaved={setToast}
        />
      )}
    </div>
  )
}

function Indicator({
  label,
  amount,
  strong = false,
}: {
  label: string
  amount: number
  strong?: boolean
}) {
  return (
    <div className={`mic-indicator${strong ? ' is-strong' : ''}`}>
      <span className="mic-indicator-label">{label}</span>
      <strong className="mic-indicator-value tabular">{formatEurosCompact(amount)}</strong>
    </div>
  )
}

/**
 * Saisie du planning d'heures, client par client et mois par mois.
 * Une grille plutôt qu'un formulaire : on remplit un planning d'un trait,
 * pas une ligne à la fois.
 */
function ForecastEditor({
  clients,
  year,
  forecasts,
  onSaved,
}: {
  clients: MicroClient[]
  year: number
  forecasts: { clientId: string; month: string; plannedHours: number }[]
  onSaved: (message: string) => void
}) {
  /**
   * Le client choisi est DÉDUIT, pas figé dans l'état.
   *
   * Écrire `useState(clients[0]?.id)` calculerait la valeur une seule fois, au
   * premier rendu — c'est-à-dire avant même que le premier client existe. Le
   * sélecteur resterait alors bloqué sur une valeur vide, et le planning
   * s'enregistrerait sans client.
   */
  const [chosenId, setChosenId] = useState<string>()
  const clientId = chosenId ?? clients[0]?.id ?? ''

  if (clients.length === 0) return null

  const rate = clients.find((client) => client.id === clientId)?.hourlyRate ?? 0
  const hoursFor = (month: string) =>
    forecasts.find((forecast) => forecast.clientId === clientId && forecast.month === month)
      ?.plannedHours ?? ''

  return (
    <div className="mic-forecast">
      <Field
        label="Planning d'heures"
        hint={
          rate === 0
            ? 'Renseigne un tarif horaire sur la fiche client pour chiffrer le prévisionnel.'
            : `Chiffré à ${formatEurosCompact(rate)} de l'heure.`
        }
      >
        {({ id, describedBy }) => (
          <select
            id={id}
            aria-describedby={describedBy}
            value={clientId}
            onChange={(event) => setChosenId(event.target.value)}
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        )}
      </Field>

      <div className="mic-forecast-grid">
        {Array.from({ length: 12 }, (_, index) => {
          const month = `${year}-${String(index + 1).padStart(2, '0')}`
          return (
            <label key={month}>
              <span>{MONTH_LABEL.format(new Date(`${month}-01T12:00:00`))}</span>
              <input
                type="text"
                inputMode="numeric"
                aria-label={`Heures prévues en ${MONTH_LABEL.format(new Date(`${month}-01T12:00:00`))}`}
                defaultValue={hoursFor(month)}
                onBlur={(event) => {
                  const value = Number(event.target.value.replace(',', '.'))
                  if (!Number.isFinite(value)) return
                  void setForecast(clientId, month, value, rate).then(() =>
                    onSaved('Planning enregistré.'),
                  )
                }}
              />
            </label>
          )
        })}
      </div>
    </div>
  )
}
