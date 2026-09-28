/**
 * src/domain/backup/csv.ts
 *
 * LOGIQUE PURE — fabrication de fichiers CSV.
 *
 * ---------------------------------------------------------------------------
 * POURQUOI CE N'EST PAS AUSSI SIMPLE QU'IL Y PARAÎT
 * ---------------------------------------------------------------------------
 * Un libellé comme « Café ; croissant » contient le séparateur : recopié tel
 * quel, il couperait la ligne en deux et décalerait toutes les colonnes
 * suivantes. Un guillemet ou un retour à la ligne font autant de dégâts.
 * D'où l'échappement, et les tests qui vont avec.
 *
 * Trois choix pour qu'Excel en français ouvre le fichier correctement du
 * premier coup, sans passer par un assistant d'importation :
 *  - le séparateur est le POINT-VIRGULE, pas la virgule (qui sert de
 *    séparateur décimal en français) ;
 *  - les fins de ligne sont en CRLF ;
 *  - le fichier commence par un marqueur invisible (BOM) qui annonce l'UTF-8,
 *    sans lequel « Café » s'afficherait « CafÃ© ».
 */

import type { Cents } from '../../db/types'

export interface CsvColumn<T> {
  header: string
  value: (row: T) => string
}

const SEPARATOR = ';'
const LINE_END = '\r\n'

/** Entoure de guillemets seulement si nécessaire, en doublant ceux du texte. */
function escapeField(raw: string): string {
  if (!/[";\r\n]/.test(raw)) return raw
  return `"${raw.replace(/"/g, '""')}"`
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [
    columns.map((column) => escapeField(column.header)).join(SEPARATOR),
    ...rows.map((row) => columns.map((column) => escapeField(column.value(row))).join(SEPARATOR)),
  ]
  return lines.join(LINE_END) + LINE_END
}

/**
 * Ajoute le marqueur UTF-8 attendu par Excel.
 * Séparé de `toCsv` pour que les tests comparent du texte lisible.
 */
export function withBom(csv: string): string {
  return `﻿${csv}`
}

/** 2450 -> '24,50'. Sans symbole € : Excel doit y voir un NOMBRE, pas du texte. */
export function csvAmount(cents: Cents): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}
