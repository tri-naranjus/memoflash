import JSZip from 'jszip'
import initSqlJs from 'sql.js'
import { decompress } from 'fzstd'

export interface AnkiCard {
  front: string
  back: string
}

// Singleton para no re-inicializar sql.js múltiples veces
let _SQL: ReturnType<typeof initSqlJs> extends Promise<infer T> ? T : never

async function getSQL() {
  if (!_SQL) {
    _SQL = await initSqlJs({
      locateFile: () => `${window.location.origin}/sql-wasm.wasm`
    })
  }
  return _SQL
}

/**
 * Descomprime datos zstd si el archivo empieza con la magic de zstd (0xFD2FB528)
 * Los archivos .anki21b en Anki 2.1.50+ están comprimidos con zstd
 */
function maybeDecompressZstd(data: Uint8Array): Uint8Array {
  // Magic bytes de zstd: FD 2F B5 28
  if (
    data.length > 4 &&
    data[0] === 0xfd &&
    data[1] === 0x2f &&
    data[2] === 0xb5 &&
    data[3] === 0x28
  ) {
    console.log('[Anki] Detectado formato zstd — descomprimiendo...')
    return decompress(data)
  }
  return data
}

/**
 * Parsea un archivo Anki .apkg y extrae pares pregunta/respuesta
 */
export async function parseAnkiFile(file: File): Promise<AnkiCard[]> {
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)

  const zipFiles = Object.keys(zip.files)
  console.log('[Anki] Contenido del ZIP:', zipFiles)

  // Prioridad: anki21b (zstd) > anki21 > anki2
  const dbFileName =
    zipFiles.find(f => f === 'collection.anki21b') ||
    zipFiles.find(f => f === 'collection.anki21') ||
    zipFiles.find(f => f === 'collection.anki2') ||
    zipFiles.find(f => f.endsWith('.anki21b')) ||
    zipFiles.find(f => f.endsWith('.anki21')) ||
    zipFiles.find(f => f.endsWith('.anki2'))

  if (!dbFileName) {
    throw new Error(
      `No se encontró la base de datos Anki en el archivo.\nArchivos encontrados: ${zipFiles.join(', ')}`
    )
  }

  console.log('[Anki] Usando archivo DB:', dbFileName)

  const dbZipFile = zip.file(dbFileName)!
  const dbRaw = new Uint8Array(await dbZipFile.async('arraybuffer'))

  console.log('[Anki] Tamaño raw:', dbRaw.length, 'bytes')

  // Descomprimir si es zstd
  const dbData = maybeDecompressZstd(dbRaw)

  console.log('[Anki] Tamaño tras descompresión:', dbData.length, 'bytes')

  // Verificar magic bytes de SQLite
  const magic = new TextDecoder().decode(dbData.slice(0, 15))
  console.log('[Anki] SQLite magic:', magic)

  if (!magic.startsWith('SQLite format 3')) {
    throw new Error(
      `El archivo no es una base de datos SQLite válida (magic: "${magic}"). ` +
      `Formato no reconocido.`
    )
  }

  const SQL = await getSQL()
  const db = new SQL.Database(dbData)

  let cards: AnkiCard[] = []
  try {
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'")
    const tableNames = tables[0]?.values.map((r: unknown[]) => String(r[0])) || []
    console.log('[Anki] Tablas:', tableNames)

    if (!tableNames.includes('notes')) {
      throw new Error(
        `La base de datos no tiene la tabla 'notes'.\nTablas encontradas: ${tableNames.join(', ')}`
      )
    }

    const countResult = db.exec('SELECT COUNT(*) FROM notes')
    const noteCount = Number(countResult[0]?.values[0]?.[0] || 0)
    console.log('[Anki] Notas totales:', noteCount)

    if (noteCount === 0) {
      throw new Error('El archivo .apkg no contiene notas')
    }

    const results = db.exec('SELECT flds FROM notes')
    for (const row of results[0].values) {
      const flds = String(row[0])
      // Anki separa campos con el carácter separador de unidad \x1f (char 31)
      const parts = flds.split('\x1f')
      if (parts.length >= 2) {
        const front = stripHtml(parts[0]).trim()
        const back = stripHtml(parts[1]).trim()
        if (front && back) {
          cards.push({ front, back })
        }
      }
    }

    console.log('[Anki] Tarjetas parseadas:', cards.length)
  } finally {
    db.close()
  }

  if (cards.length === 0) {
    throw new Error('No se encontraron tarjetas válidas con pregunta y respuesta en el archivo')
  }

  return cards
}

function stripHtml(input: string): string {
  if (!input) return ''
  return input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<div>/gi, '\n')
    .replace(/<\/div>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export function formatAnkiCardsAsText(cards: AnkiCard[]): string {
  return cards
    .map((card, i) => `Tarjeta ${i + 1}:\nPregunta: ${card.front}\nRespuesta: ${card.back}`)
    .join('\n\n')
}
