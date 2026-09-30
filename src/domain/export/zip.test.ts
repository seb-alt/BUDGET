import { describe, expect, it } from 'vitest'
import { buildZip, crc32, dosDateTime } from './zip'

const bytes = (text: string) => new TextEncoder().encode(text)

/** Lit un entier non signé écrit sur 2 ou 4 octets, comme le fait un lecteur ZIP. */
const readU16 = (data: Uint8Array, at: number) => data[at] | (data[at + 1] << 8)
const readU32 = (data: Uint8Array, at: number) =>
  (data[at] | (data[at + 1] << 8) | (data[at + 2] << 16) | (data[at + 3] << 24)) >>> 0

describe('crc32', () => {
  it('retrouve la valeur de référence de la spécification', () => {
    // '123456789' → 0xCBF43926 est le vecteur de test universel du CRC-32.
    expect(crc32(bytes('123456789'))).toBe(0xcbf43926)
  })

  it('vaut zéro sur un contenu vide', () => {
    expect(crc32(new Uint8Array())).toBe(0)
  })

  it('change dès qu’un octet change', () => {
    expect(crc32(bytes('bonjour'))).not.toBe(crc32(bytes('bonjouR')))
  })
})

describe('dosDateTime', () => {
  it('encode une date après 1980', () => {
    const { date, time } = dosDateTime(new Date(2026, 8, 30, 14, 35, 20))
    expect((date >> 9) + 1980).toBe(2026)
    expect((date >> 5) & 0xf).toBe(9)
    expect(date & 0x1f).toBe(30)
    expect(time >> 11).toBe(14)
    expect((time >> 5) & 0x3f).toBe(35)
    // Le format DOS ne retient que les secondes paires.
    expect((time & 0x1f) * 2).toBe(20)
  })

  it('ramène une date antérieure à 1980, que le format ne sait pas écrire', () => {
    const { date } = dosDateTime(new Date(1975, 0, 1))
    expect((date >> 9) + 1980).toBe(1980)
  })
})

describe('buildZip', () => {
  const archive = buildZip([
    { path: 'a.txt', data: bytes('bonjour') },
    { path: 'dossier/b.xml', data: bytes('<x/>') },
  ])

  it('commence par la signature d’un en-tête local', () => {
    expect(readU32(archive, 0)).toBe(0x04034b50)
  })

  it('annonce le bon nombre de fichiers', () => {
    // La fin du répertoire central fait 22 octets et termine l'archive.
    const end = archive.length - 22
    expect(readU32(archive, end)).toBe(0x06054b50)
    expect(readU16(archive, end + 8)).toBe(2)
    expect(readU16(archive, end + 10)).toBe(2)
  })

  it('pointe vers un répertoire central qui commence bien où il le dit', () => {
    const end = archive.length - 22
    const size = readU32(archive, end + 12)
    const offset = readU32(archive, end + 16)
    expect(readU32(archive, offset)).toBe(0x02014b50)
    expect(offset + size).toBe(end)
  })

  it('stocke sans compression : la taille déclarée est la taille réelle', () => {
    expect(readU16(archive, 8)).toBe(0) // méthode 0
    expect(readU32(archive, 18)).toBe(readU32(archive, 22))
    expect(readU32(archive, 22)).toBe(bytes('bonjour').length)
  })

  it('inscrit le CRC du contenu dans l’en-tête', () => {
    expect(readU32(archive, 14)).toBe(crc32(bytes('bonjour')))
  })

  it('conserve les chemins avec dossier', () => {
    expect(new TextDecoder().decode(archive)).toContain('dossier/b.xml')
  })

  it('accepte une archive vide', () => {
    const empty = buildZip([])
    expect(empty.length).toBe(22)
    expect(readU16(empty, 8)).toBe(0)
  })
})
