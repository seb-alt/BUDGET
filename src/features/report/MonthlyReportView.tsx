/**
 * src/features/report/MonthlyReportView.tsx
 *
 * Le rapport d'un mois, sur une page — à lire à l'écran et à imprimer en PDF.
 *
 * POURQUOI PAS DE BIBLIOTHÈQUE PDF. Le navigateur sait déjà fabriquer un PDF :
 * c'est ce que fait « Imprimer → Enregistrer au format PDF », sur ordinateur
 * comme sur téléphone. Passer par lui donne un fichier à la bonne taille, avec
 * du texte sélectionnable et cherchable, sans ajouter plusieurs centaines de
 * kilo-octets au téléchargement de l'application. Et ça marche hors connexion,
 * puisque rien n'est chargé.
 *
 * La contrepartie : il faut une vraie feuille de style d'impression. C'est
 * Report.css, et c'est là que se joue la mise en page du PDF — pas ici.
 *
 * Les chiffres viennent du MÊME rapport que le classeur Excel. Les deux ne
 * peuvent donc pas diverger.
 */

import type { MonthlyReport } from '../../domain/export/monthlyReport'
import { formatEuros } from '../../utils/money'
import './Report.css'

/** '2026-09-30' → '30/09/2026'. */
const frenchDate = (iso: string): string => iso.split('-').reverse().join('/')

/** Un montant signé se lit mieux avec son signe devant que déduit du contexte. */
function signed(cents: number): string {
  if (cents === 0) return formatEuros(0)
  return `${cents > 0 ? '+' : '−'}${formatEuros(Math.abs(cents))}`
}

interface MonthlyReportViewProps {
  report: MonthlyReport
}

export function MonthlyReportView({ report }: MonthlyReportViewProps) {
  const micro = report.micro

  return (
    <article className="report-page">
      <header className="report-head">
        <div>
          <h1>Budget</h1>
          <p className="report-month">{report.monthLabel}</p>
        </div>
        <p className="report-meta">
          Édité le {frenchDate(report.generatedAt)}
          <br />
          {report.frozen ? 'Mois révolu : budget figé' : 'Mois en cours : peut encore bouger'}
        </p>
      </header>

      <section className="report-figures" aria-label="Le mois en quatre chiffres">
        <Figure label="Entrées" value={formatEuros(report.income)} />
        <Figure label="Sorties" value={formatEuros(report.expenses)} />
        <Figure label="Épargne" value={formatEuros(report.savings)} accent />
        <Figure label="Loisirs restants" value={formatEuros(report.leisureRemaining)} />
      </section>

      <section className="report-block">
        <h2>Budget du mois</h2>
        <table className="report-table">
          <thead>
            <tr>
              <th scope="col">Groupe</th>
              <th scope="col" className="is-number">
                Budget
              </th>
              <th scope="col" className="is-number">
                Dépensé
              </th>
              <th scope="col" className="is-number">
                Reste
              </th>
            </tr>
          </thead>
          <tbody>
            {report.groups.map((group) => (
              <tr key={group.title}>
                <th scope="row">{group.title}</th>
                <td className="is-number">{formatEuros(group.budget)}</td>
                <td className="is-number">{formatEuros(group.spent)}</td>
                <td className={`is-number${group.remaining < 0 ? ' is-over' : ''}`}>
                  {formatEuros(group.remaining)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="report-block">
        <h2>Par catégorie</h2>
        <table className="report-table">
          <thead>
            <tr>
              <th scope="col">Catégorie</th>
              <th scope="col" className="is-optional">
                Groupe
              </th>
              <th scope="col" className="is-number">
                Budget
              </th>
              <th scope="col" className="is-number">
                Dépensé
              </th>
              <th scope="col" className="is-number">
                Reste
              </th>
            </tr>
          </thead>
          <tbody>
            {report.lines.map((line) => (
              <tr key={line.categoryId}>
                <th scope="row">{line.category}</th>
                <td className="is-optional">{line.group}</td>
                <td className="is-number">{formatEuros(line.budget)}</td>
                <td className="is-number">{formatEuros(line.spent)}</td>
                <td className={`is-number${line.remaining < 0 ? ' is-over' : ''}`}>
                  {formatEuros(line.remaining)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="report-block">
        <h2>Comptes à la fin du mois</h2>
        <table className="report-table">
          <thead>
            <tr>
              <th scope="col">Compte</th>
              <th scope="col">Nature</th>
              <th scope="col" className="is-number">
                Solde
              </th>
            </tr>
          </thead>
          <tbody>
            {report.accounts.map((account) => (
              <tr key={account.name}>
                <th scope="row">{account.name}</th>
                <td>{account.kind}</td>
                <td className="is-number">{formatEuros(account.balance)}</td>
              </tr>
            ))}
            <tr className="report-total">
              <th scope="row">Patrimoine financier</th>
              <td />
              <td className="is-number">{formatEuros(report.patrimony)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {micro !== undefined && (
        <section className="report-block">
          <h2>Micro-entreprise</h2>
          <table className="report-table">
            <tbody>
              <tr>
                <th scope="row">CA encaissé</th>
                <td className="is-number">{formatEuros(micro.collected)}</td>
              </tr>
              <tr>
                <th scope="row">Facturé, en attente de paiement</th>
                <td className="is-number">{formatEuros(micro.awaiting)}</td>
              </tr>
              <tr>
                <th scope="row">URSSAF provisionnée</th>
                <td className="is-number">{formatEuros(micro.urssafProvisioned)}</td>
              </tr>
              <tr>
                <th scope="row">URSSAF restant à verser</th>
                <td className="is-number">{formatEuros(micro.urssafRemaining)}</td>
              </tr>
              <tr>
                <th scope="row">Dépenses professionnelles</th>
                <td className="is-number">{formatEuros(micro.expenses)}</td>
              </tr>
              <tr className="report-total">
                <th scope="row">Disponible estimé</th>
                <td className="is-number">{formatEuros(micro.available)}</td>
              </tr>
            </tbody>
          </table>

          {micro.invoices.length > 0 && (
            <table className="report-table report-invoices">
              <thead>
                <tr>
                  <th scope="col">Facture</th>
                  <th scope="col">Client</th>
                  <th scope="col" className="is-optional">
                    Émise
                  </th>
                  <th scope="col">Échéance</th>
                  <th scope="col" className="is-number">
                    Montant
                  </th>
                  <th scope="col">Statut</th>
                </tr>
              </thead>
              <tbody>
                {micro.invoices.map((invoice) => (
                  <tr key={invoice.number}>
                    <th scope="row">{invoice.number}</th>
                    <td>{invoice.client}</td>
                    <td className="is-optional">{frenchDate(invoice.issueDate)}</td>
                    <td>{frenchDate(invoice.dueDate)}</td>
                    <td className="is-number">{formatEuros(invoice.amount)}</td>
                    <td>{invoice.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      <section className="report-block">
        <h2>Opérations du mois</h2>
        {report.operations.length === 0 ? (
          <p className="report-empty">Aucune opération ce mois-ci.</p>
        ) : (
          <table className="report-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Catégorie</th>
                <th scope="col">Libellé</th>
                <th scope="col" className="is-optional">
                  Compte
                </th>
                <th scope="col" className="is-number">
                  Montant
                </th>
              </tr>
            </thead>
            <tbody>
              {report.operations.map((operation, index) => (
                <tr key={`${operation.date}-${index}`}>
                  <td className="is-nowrap">{frenchDate(operation.date)}</td>
                  <td>
                    {operation.category === '' ? operation.type : operation.category}
                    {operation.isMicro && <span className="report-tag">micro</span>}
                  </td>
                  <td>{operation.label}</td>
                  <td className="is-optional">
                    {operation.account}
                    {operation.toAccount !== '' && ` → ${operation.toAccount}`}
                  </td>
                  <td className="is-number is-nowrap">{signed(operation.signedAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer className="report-foot">
        Rapport produit par Budget — données conservées uniquement sur cet appareil.
      </footer>
    </article>
  )
}

function Figure({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`report-figure${accent === true ? ' is-accent' : ''}`}>
      <span className="report-figure-label">{label}</span>
      <strong className="report-figure-value">{value}</strong>
    </div>
  )
}
