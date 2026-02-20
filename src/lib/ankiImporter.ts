import JSZip from 'jszip'
import initSqlJs from 'sql.js'

export interface AnkiCard {
  front: string
  back: string
}

// Singleton to avoid re-initializing SQL.js multiple times
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
 * Parse an Anki .apkg file and extract Q&A pairs
 */
export async function parseAnkiFile(file: File): Promise<AnkiCard[]> {
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)

  // List all files in zip for debugging
  const zipFiles = Object.keys(zip.files)
  console.log('APKG contents:', zipFiles)

  // Try anki21 first (Anki 2.1+), then anki2 (legacy)
  const dbFileName = zipFiles.find(f => f === 'collection.anki21')
    || zipFiles.find(f => f === 'collection.anki2')
    || zipFiles.find(f => f.endsWith('.anki21'))
    || zipFiles.find(f => f.endsWith('.anki2'))

  if (!dbFileName) {
    throw new Error(`No se encontró la base de datos. Archivos en el ZIP: ${zipFiles.join(', ')}`)
  }

  console.log('Using DB file:', dbFileName)

  const dbZipFile = zip.file(dbFileName)!
  const dbData = await dbZipFile.async('arraybuffer')
  const dbUint8 = new Uint8Array(dbData)

  console.log('DB size:', dbUint8.length, 'bytes')

  // Check SQLite magic bytes (first 16 bytes should be "SQLite format 3\0")
  const magic = new TextDecoder().decode(dbUint8.slice(0, 15))
  console.log('DB magic:', magic)

  if (!magic.startsWith('SQLite format 3')) {
    // File may be zstd-compressed (Anki 2.1.50+)
    throw new Error(
      'Este archivo usa el formato Anki 2.1.50+ con compresión zstd, que no está soportado todavía. ' +
      'Por favor, exporta el mazo desde Anki en formato .apkg legacy (Anki 2.1.49 o anterior) o usa un submazo individual.'
    )
  }

  const SQL = await getSQL()
  const db = new SQL.Database(dbUint8)

  let cards: AnkiCard[] = []
  try {
    // Check tables
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'")
    const tableNames = tables[0]?.values.map((r: unknown[]) => String(r[0])) || []
    console.log('Tables:', tableNames)

    if (!tableNames.includes('notes')) {
      throw new Error(`La base de datos no tiene tabla 'notes'. Tablas encontradas: ${tableNames.join(', ')}`)
    }

    const countResult = db.exec('SELECT COUNT(*) FROM notes')
    const noteCount = Number(countResult[0]?.values[0]?.[0] || 0)
    console.log('Note count:', noteCount)

    if (noteCount === 0) {
      throw new Error('El archivo .apkg no contiene notas')
    }

    const results = db.exec('SELECT flds FROM notes')

    for (const row of results[0].values) {
      const flds = String(row[0])
      // Anki separates fields with Unit Separator \x1f (char 31)
      const parts = flds.split('\x1f')

      if (parts.length >= 2) {
        const front = stripHtml(parts[0]).trim()
        const back = stripHtml(parts[1]).trim()
        if (front && back) {
          cards.push({ front, back })
        }
      }
    }

    console.log('Parsed cards:', cards.length)
  } finally {
    db.close()
  }

  if (cards.length === 0) {
    throw new Error('No se encontraron tarjetas válidas con pregunta y respuesta')
  }

  return cards
}

function stripHtml(input: string): string {
  if (!input) return ''
  return input
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<div>/gi, ' ')
    .replace(/<\/div>/gi, ' ')
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
  return cards.map((card, i) =>
    `Tarjeta ${i + 1}:\nPregunta: ${card.front}\nRespuesta: ${card.back}`
  ).join('\n\n')
}
