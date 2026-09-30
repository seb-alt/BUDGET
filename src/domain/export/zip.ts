/**
 * src/domain/export/zip.ts
 *
 * Écrire une archive ZIP, à la main.
 *
 * POURQUOI À LA MAIN. Un fichier .xlsx n'est pas un format mystérieux : c'est
 * une archive ZIP contenant des fichiers XML. Pour en produire un, il faut donc
 * savoir écrire un ZIP.
 *
 * On pourrait installer une bibliothèque. Trois raisons de ne pas le faire :
 * l'application doit fonctionner hors connexion, donc tout code ajouté grossit
 * le fichier que ton téléphone télécharge ; une dépendance de plus est une
 * dépendance à surveiller pendant des années ; et le format dont on a besoin
 * tient en une centaine de lignes, testables.
 *
 * On écrit les fichiers SANS COMPRESSION (méthode « stored »). Le format ZIP
 * l'autorise, Excel l'accepte, et cela évite d'embarquer un compresseur pour
 * quelques dizaines de kilo-octets de XML.
 *
 * Références : spécification APPNOTE.TXT de PKWARE, sections 4.3.7 (en-tête
 * local), 4.3.12 (répertoire central) et 4.3.16 (fin de répertoire).
 */

export interface ZipEntry {
  /** Chemin dans l'archive, ex. 'xl/worksheets/sheet1.xml'. */
  path: string
  data: Uint8Array
}

/**
 * Table de calcul du CRC-32, construite une seule fois.
 *
 * Le CRC est une empreinte du contenu : le lecteur la recalcule et refuse le
 * fichier si elle ne correspond pas. C'est ce qui rend une archive corrompue
 * détectable au lieu d'être silencieusement à moitié lue.
 */
let crcTable: Uint32Array | undefined

function getCrcTable(): Uint32Array {
  if (crcTable !== undefined) return crcTable
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }
  crcTable = table
  return table
}

export function crc32(data: Uint8Array): number {
  const table = getCrcTable()
  let crc = 0xffffffff
  for (const byte of data) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/**
 * Date et heure au format MS-DOS, celui qu'attend l'en-tête ZIP.
 *
 * Deux entiers de 16 bits, hérités de 1980 : la date compte les années depuis
 * 1980, l'heure ne retient que les secondes paires. Une date antérieure à 1980
 * est donc impossible à écrire — on la ramène au 1er janvier 1980.
 */
export function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear())
  return {
    time:
      (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}

/** Petit tampon qui s'étend tout seul, pour écrire sans compter à l'avance. */
class ByteWriter {
  private bytes: number[] = []

  u16(value: number): void {
    this.bytes.push(value & 0xff, (value >>> 8) & 0xff)
  }

  u32(value: number): void {
    this.bytes.push(
      value & 0xff,
      (value >>> 8) & 0xff,
      (value >>> 16) & 0xff,
      (value >>> 24) & 0xff,
    )
  }

  raw(data: Uint8Array): void {
    for (const byte of data) this.bytes.push(byte)
  }

  get length(): number {
    return this.bytes.length
  }

  toUint8Array(): Uint8Array {
    return Uint8Array.from(this.bytes)
  }
}

const encoder = new TextEncoder()

export function buildZip(entries: ZipEntry[], now = new Date()): Uint8Array {
  const { time, date } = dosDateTime(now)
  const out = new ByteWriter()
  const central: { header: Uint8Array }[] = []

  for (const entry of entries) {
    const name = encoder.encode(entry.path)
    const crc = crc32(entry.data)
    const offset = out.length

    // En-tête local, juste avant le contenu du fichier.
    out.u32(0x04034b50)
    out.u16(20) // version minimale pour lire : 2.0
    out.u16(0x0800) // drapeau : le nom est en UTF-8
    out.u16(0) // méthode 0 : stocké, sans compression
    out.u16(time)
    out.u16(date)
    out.u32(crc)
    out.u32(entry.data.length) // taille compressée = taille réelle
    out.u32(entry.data.length)
    out.u16(name.length)
    out.u16(0) // pas de champ supplémentaire
    out.raw(name)
    out.raw(entry.data)

    // La même information, à répéter dans le répertoire central en fin
    // d'archive : c'est LUI que les lecteurs consultent d'abord.
    const header = new ByteWriter()
    header.u32(0x02014b50)
    header.u16(20) // version de l'outil qui a écrit
    header.u16(20)
    header.u16(0x0800)
    header.u16(0)
    header.u16(time)
    header.u16(date)
    header.u32(crc)
    header.u32(entry.data.length)
    header.u32(entry.data.length)
    header.u16(name.length)
    header.u16(0)
    header.u16(0) // pas de commentaire
    header.u16(0) // numéro de disque : vestige des disquettes
    header.u16(0) // attributs internes
    header.u32(0) // attributs externes
    header.u32(offset) // où trouver l'en-tête local
    header.raw(name)
    central.push({ header: header.toUint8Array() })
  }

  const centralStart = out.length
  for (const { header } of central) out.raw(header)
  const centralSize = out.length - centralStart

  // Fin du répertoire central : le point d'entrée de toute lecture d'archive.
  out.u32(0x06054b50)
  out.u16(0)
  out.u16(0)
  out.u16(entries.length)
  out.u16(entries.length)
  out.u32(centralSize)
  out.u32(centralStart)
  out.u16(0)

  return out.toUint8Array()
}
