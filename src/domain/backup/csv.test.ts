/**
 * Tests du CSV.
 * Un échappement raté décale silencieusement toutes les colonnes : le fichier
 * s'ouvre, l'erreur ne se voit qu'en lisant les données une par une.
 */

import { describe, expect, it } from 'vitest'
import { csvAmount, toCsv, withBom, type CsvColumn } from './csv'

interface Row {
  label: string
  amount: number
}

const columns: CsvColumn<Row>[] = [
  { header: 'Libellé', value: (row) => row.label },
  { header: 'Montant', value: (row) => csvAmount(row.amount) },
]

describe('toCsv', () => {
  it('écrit un en-tête et une ligne par enregistrement', () => {
    expect(toCsv([{ label: 'Décathlon', amount: 6900 }], columns)).toBe(
      'Libellé;Montant\r\nDécathlon;69,00\r\n',
    )
  })

  it('n’écrit que l’en-tête quand il n’y a rien', () => {
    expect(toCsv([], columns)).toBe('Libellé;Montant\r\n')
  })

  it('protège un champ contenant le séparateur', () => {
    // Sans guillemets, cette ligne aurait trois colonnes au lieu de deux.
    expect(toCsv([{ label: 'Café ; croissant', amount: 350 }], columns)).toBe(
      'Libellé;Montant\r\n"Café ; croissant";3,50\r\n',
    )
  })

  it('double les guillemets du texte', () => {
    expect(toCsv([{ label: 'Le "Bistrot"', amount: 100 }], columns)).toBe(
      'Libellé;Montant\r\n"Le ""Bistrot""";1,00\r\n',
    )
  })

  it('protège un retour à la ligne', () => {
    expect(toCsv([{ label: 'Ligne 1\nLigne 2', amount: 100 }], columns)).toBe(
      'Libellé;Montant\r\n"Ligne 1\nLigne 2";1,00\r\n',
    )
  })

  it('laisse tranquilles les champs ordinaires', () => {
    expect(toCsv([{ label: 'Courses', amount: 100 }], columns)).not.toContain('"')
  })
})

describe('csvAmount', () => {
  it('écrit deux décimales avec une virgule, sans symbole', () => {
    expect(csvAmount(2450)).toBe('24,50')
    expect(csvAmount(2000)).toBe('20,00')
    expect(csvAmount(0)).toBe('0,00')
  })

  it('gère les montants négatifs et les grands nombres', () => {
    expect(csvAmount(-12050)).toBe('-120,50')
    expect(csvAmount(123456789)).toBe('1234567,89')
  })
})

describe('withBom', () => {
  it('préfixe le marqueur UTF-8 attendu par Excel', () => {
    expect(withBom('a;b')).toBe('﻿a;b')
    expect(withBom('a;b').charCodeAt(0)).toBe(0xfeff)
  })
})
