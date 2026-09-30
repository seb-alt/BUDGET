/**
 * src/domain/export/xlsx.ts
 *
 * Fabriquer un classeur Excel (.xlsx), à la main.
 *
 * Un .xlsx est une archive ZIP (voir zip.ts) contenant des fichiers XML :
 *
 *   [Content_Types].xml        ce que contient l'archive
 *   _rels/.rels                le point d'entrée : « le classeur est ici »
 *   xl/workbook.xml            la liste des feuilles
 *   xl/_rels/workbook.xml.rels où trouver chaque feuille et les styles
 *   xl/styles.xml              les formats de nombre (euros, dates) et le gras
 *   xl/worksheets/sheetN.xml   le contenu de chaque feuille
 *
 * DEUX CHOIX QUI SIMPLIFIENT BEAUCOUP.
 *
 * 1. Les textes sont écrits DANS la cellule (« inlineStr ») plutôt que dans une
 *    table de chaînes partagées. Excel accepte les deux ; la table partagée
 *    n'économise de la place que sur de très gros fichiers, et elle ajoute un
 *    fichier et un niveau d'indirection à tenir cohérents.
 *
 * 2. Les montants sont écrits comme de VRAIS NOMBRES, avec un format d'affichage
 *    en euros. C'est tout l'intérêt par rapport à un CSV : tu peux additionner,
 *    filtrer, faire un tableau croisé. Un montant écrit « 1 234,56 € » serait du
 *    texte, et inutilisable.
 */

import { buildZip } from './zip'

export type CellFormat = 'text' | 'number' | 'euro' | 'date'

export interface Column {
  header: string
  /** Largeur en nombre de caractères. Sans elle, Excel met sa largeur par défaut. */
  width?: number
  format?: CellFormat
}

/** `null` laisse la cellule vide — ce n'est pas la même chose qu'un zéro. */
export type CellValue = string | number | null

export interface SheetSpec {
  name: string
  columns: Column[]
  rows: CellValue[][]
}

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
}

export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => XML_ESCAPES[char])
}

/**
 * Le nom de colonne d'Excel : 0 → A, 25 → Z, 26 → AA.
 *
 * Attention, ce n'est PAS de la base 26 ordinaire : il n'y a pas de chiffre
 * zéro, donc chaque tour retire 1 avant de passer au rang supérieur.
 */
export function columnLetter(index: number): string {
  let letters = ''
  let remaining = index
  while (remaining >= 0) {
    letters = String.fromCharCode(65 + (remaining % 26)) + letters
    remaining = Math.floor(remaining / 26) - 1
  }
  return letters
}

/**
 * Une date au sens d'Excel : un nombre de jours depuis le 30 décembre 1899.
 *
 * Cette origine étrange vient d'un bug volontairement conservé depuis 1985 :
 * Excel croit que 1900 était bissextile. Décaler l'origine d'un jour compense
 * exactement l'erreur pour toutes les dates postérieures à février 1900 — donc
 * pour toutes celles qui nous concernent.
 */
export function excelSerial(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number)
  // Date.UTC évite le fuseau horaire : on compte des jours, pas des instants.
  const EPOCH = Date.UTC(1899, 11, 30)
  return (Date.UTC(year, month - 1, day) - EPOCH) / 86_400_000
}

const INVALID_SHEET_NAME = /[[\]:*?/\\]/

export function validateSheetName(name: string): string | undefined {
  if (name.trim() === '') return 'Une feuille doit avoir un nom.'
  // Une limite d'Excel, pas la nôtre : au-delà, le fichier est refusé.
  if (name.length > 31) return `Le nom de feuille « ${name} » dépasse 31 caractères.`
  if (INVALID_SHEET_NAME.test(name))
    return `Le nom de feuille « ${name} » contient un caractère interdit.`
  return undefined
}

/** Index de style dans styles.xml, ci-dessous. L'ordre doit y correspondre. */
const STYLE = { text: 0, header: 1, euro: 2, date: 3, number: 4 } as const

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function cellXml(reference: string, value: CellValue, format: CellFormat): string {
  if (value === null || value === '') return ''

  /*
   * LE FORMAT EST CELUI DE LA COLONNE, MAIS LA CELLULE A LE DERNIER MOT.
   *
   * Une feuille de résumé mélange forcément les deux : « Entrées du mois |
   * 2 100 € » et « Mois | SEPTEMBRE 2026 » partagent la même colonne. Si la
   * colonne imposait son format, le texte serait purement et simplement perdu
   * — c'est exactement ce qui arrivait avant cette règle.
   *
   * Donc : une valeur qui ne correspond pas au format demandé est écrite comme
   * du texte, plutôt que jetée.
   */
  if (format === 'euro' || format === 'number') {
    if (typeof value === 'number' && Number.isFinite(value)) {
      const style = format === 'euro' ? STYLE.euro : STYLE.number
      return `<c r="${reference}" s="${style}"><v>${value}</v></c>`
    }
  } else if (format === 'date') {
    if (typeof value === 'string' && ISO_DATE.test(value)) {
      return `<c r="${reference}" s="${STYLE.date}"><v>${excelSerial(value)}</v></c>`
    }
  }

  // Du texte. `xml:space="preserve"` garde les espaces de début et de fin, qu'un
  // lecteur XML supprimerait sinon.
  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`
}

function sheetXml(sheet: SheetSpec): string {
  const cols = sheet.columns
    .map((column, index) =>
      column.width === undefined
        ? ''
        : `<col min="${index + 1}" max="${index + 1}" width="${column.width}" customWidth="1"/>`,
    )
    .join('')

  const header = sheet.columns
    .map(
      (column, index) =>
        `<c r="${columnLetter(index)}1" t="inlineStr" s="${STYLE.header}"><is><t>${escapeXml(column.header)}</t></is></c>`,
    )
    .join('')

  const body = sheet.rows
    .map((row, rowIndex) => {
      const number = rowIndex + 2 // la ligne 1 est l'en-tête
      const cells = sheet.columns
        .map((column, columnIndex) =>
          cellXml(
            `${columnLetter(columnIndex)}${number}`,
            row[columnIndex] ?? null,
            column.format ?? 'text',
          ),
        )
        .join('')
      return `<row r="${number}">${cells}</row>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">\
<sheetViews><sheetView workbookViewId="0">\
<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>\
</sheetView></sheetViews>\
${cols === '' ? '' : `<cols>${cols}</cols>`}\
<sheetData><row r="1">${header}</row>${body}</sheetData></worksheet>`
}

const CONTENT_TYPES = (
  count: number,
) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\
<Default Extension="xml" ContentType="application/xml"/>\
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>\
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>\
${Array.from(
  { length: count },
  (_, index) =>
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
).join('')}</Types>`

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>\
</Relationships>`

/**
 * Les styles. L'ordre des `<xf>` de `cellXfs` définit les numéros utilisés
 * plus haut dans STYLE — ne pas en insérer au milieu.
 *
 * Les formats 164 et 165 sont « personnalisés » : la numérotation sous 164 est
 * réservée aux formats intégrés d'Excel.
 */
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">\
<numFmts count="2">\
<numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;€&quot;"/>\
<numFmt numFmtId="165" formatCode="DD/MM/YYYY"/>\
</numFmts>\
<fonts count="2">\
<font><sz val="11"/><name val="Calibri"/></font>\
<font><b/><sz val="11"/><name val="Calibri"/></font>\
</fonts>\
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>\
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>\
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>\
<cellXfs count="5">\
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>\
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>\
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>\
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>\
<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>\
</cellXfs>\
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>\
</styleSheet>`

export function buildWorkbook(sheets: SheetSpec[], now = new Date()): Uint8Array {
  if (sheets.length === 0) throw new Error('Un classeur doit contenir au moins une feuille.')

  const seen = new Set<string>()
  for (const sheet of sheets) {
    const problem = validateSheetName(sheet.name)
    if (problem !== undefined) throw new Error(problem)
    // Excel ne distingue pas la casse des noms de feuilles.
    const key = sheet.name.toLowerCase()
    if (seen.has(key)) throw new Error(`Deux feuilles portent le nom « ${sheet.name} ».`)
    seen.add(key)
  }

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" \
xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>\
${sheets
  .map(
    (sheet, index) =>
      `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
  )
  .join('')}</sheets></workbook>`

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\
${sheets
  .map(
    (_, index) =>
      `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
  )
  .join('')}\
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>\
</Relationships>`

  const encoder = new TextEncoder()
  return buildZip(
    [
      { path: '[Content_Types].xml', data: encoder.encode(CONTENT_TYPES(sheets.length)) },
      { path: '_rels/.rels', data: encoder.encode(ROOT_RELS) },
      { path: 'xl/workbook.xml', data: encoder.encode(workbook) },
      { path: 'xl/_rels/workbook.xml.rels', data: encoder.encode(workbookRels) },
      { path: 'xl/styles.xml', data: encoder.encode(STYLES) },
      ...sheets.map((sheet, index) => ({
        path: `xl/worksheets/sheet${index + 1}.xml`,
        data: encoder.encode(sheetXml(sheet)),
      })),
    ],
    now,
  )
}
