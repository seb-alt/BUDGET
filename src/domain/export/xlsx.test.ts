import { describe, expect, it } from 'vitest'
import { buildWorkbook, columnLetter, escapeXml, excelSerial, validateSheetName } from './xlsx'

describe('columnLetter', () => {
  it('nomme les 26 premières colonnes', () => {
    expect(columnLetter(0)).toBe('A')
    expect(columnLetter(25)).toBe('Z')
  })

  it('passe correctement à deux lettres', () => {
    // Le piège : ce n'est pas de la base 26, il n'y a pas de « zéro ».
    expect(columnLetter(26)).toBe('AA')
    expect(columnLetter(27)).toBe('AB')
    expect(columnLetter(51)).toBe('AZ')
    expect(columnLetter(52)).toBe('BA')
  })

  it('passe correctement à trois lettres', () => {
    expect(columnLetter(701)).toBe('ZZ')
    expect(columnLetter(702)).toBe('AAA')
  })
})

describe('excelSerial', () => {
  it('place les dates de référence connues', () => {
    expect(excelSerial('1970-01-01')).toBe(25569)
    expect(excelSerial('2000-01-01')).toBe(36526)
  })

  it('avance d’exactement un par jour', () => {
    expect(excelSerial('2026-10-01') - excelSerial('2026-09-30')).toBe(1)
  })

  it('traverse une année bissextile sans dériver', () => {
    expect(excelSerial('2024-03-01') - excelSerial('2024-02-28')).toBe(2)
  })
})

describe('escapeXml', () => {
  it('protège les caractères qui casseraient le XML', () => {
    expect(escapeXml('A & B <c> "d"')).toBe('A &amp; B &lt;c&gt; &quot;d&quot;')
  })

  it('laisse un texte ordinaire intact', () => {
    expect(escapeXml('Épargne — LEP')).toBe('Épargne — LEP')
  })
})

describe('validateSheetName', () => {
  it('accepte un nom ordinaire', () => {
    expect(validateSheetName('Opérations')).toBeUndefined()
  })

  it('refuse un nom vide', () => {
    expect(validateSheetName('  ')).toBeDefined()
  })

  it('refuse au-delà de 31 caractères, la limite d’Excel', () => {
    expect(validateSheetName('a'.repeat(31))).toBeUndefined()
    expect(validateSheetName('a'.repeat(32))).toBeDefined()
  })

  it('refuse les caractères interdits', () => {
    for (const name of ['a/b', 'a\\b', 'a?b', 'a*b', 'a:b', 'a[b]']) {
      expect(validateSheetName(name)).toBeDefined()
    }
  })
})

describe('buildWorkbook', () => {
  const sheet = {
    name: 'Test',
    columns: [
      { header: 'Date', format: 'date' as const },
      { header: 'Libellé', format: 'text' as const },
      { header: 'Montant', format: 'euro' as const },
    ],
    rows: [['2026-09-30', 'Café & thé', 12.5]],
  }

  it('produit une archive ZIP', () => {
    const file = buildWorkbook([sheet])
    expect(file[0]).toBe(0x50) // 'P'
    expect(file[1]).toBe(0x4b) // 'K'
  })

  it('écrit les montants comme des nombres, pas comme du texte', () => {
    const text = new TextDecoder().decode(buildWorkbook([sheet]))
    expect(text).toContain('<v>12.5</v>')
    // Un montant formaté serait du texte, donc inutilisable dans un calcul.
    expect(text).not.toContain('12,50 €')
  })

  it('échappe le texte des cellules', () => {
    const text = new TextDecoder().decode(buildWorkbook([sheet]))
    expect(text).toContain('Café &amp; thé')
  })

  it('convertit les dates en numéro de série', () => {
    const text = new TextDecoder().decode(buildWorkbook([sheet]))
    expect(text).toContain(`<v>${excelSerial('2026-09-30')}</v>`)
  })

  it('laisse vide une cellule nulle plutôt que d’écrire un zéro', () => {
    const text = new TextDecoder().decode(
      buildWorkbook([{ ...sheet, rows: [[null, null, null]] }]),
    )
    expect(text).toContain('<row r="2"></row>')
  })

  it('refuse deux feuilles de même nom, même avec une casse différente', () => {
    expect(() => buildWorkbook([sheet, { ...sheet, name: 'test' }])).toThrow(/même nom|nom/)
  })

  it('refuse un classeur sans feuille', () => {
    expect(() => buildWorkbook([])).toThrow()
  })

  it('refuse un nom de feuille invalide', () => {
    expect(() => buildWorkbook([{ ...sheet, name: 'Budget/2026' }])).toThrow()
  })
})

describe('une cellule dont la valeur ne suit pas le format de sa colonne', () => {
  /**
   * Le cas réel : une feuille de résumé où la colonne « Montant » contient
   * surtout des euros, mais aussi « SEPTEMBRE 2026 » en face de « Mois ».
   */
  const mixed = {
    name: 'Résumé',
    columns: [
      { header: 'Poste', format: 'text' as const },
      { header: 'Montant', format: 'euro' as const },
    ],
    rows: [
      ['Mois', 'SEPTEMBRE 2026'],
      ['Entrées', 2100],
    ],
  }

  it('écrit le texte au lieu de le perdre', () => {
    const text = new TextDecoder().decode(buildWorkbook([mixed]))
    expect(text).toContain('SEPTEMBRE 2026')
    expect(text).toContain('<v>2100</v>')
  })

  it('fait de même pour une colonne de dates', () => {
    const text = new TextDecoder().decode(
      buildWorkbook([
        {
          name: 'D',
          columns: [{ header: 'Quand', format: 'date' as const }],
          rows: [['immédiatement'], ['2026-09-30']],
        },
      ]),
    )
    expect(text).toContain('immédiatement')
    expect(text).toContain(`<v>${excelSerial('2026-09-30')}</v>`)
  })
})
