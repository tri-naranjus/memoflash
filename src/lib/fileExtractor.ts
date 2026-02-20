import mammoth from 'mammoth'

/**
 * Extract text from uploaded files
 * Supports: .docx, .txt, .pdf (basic)
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase()

  switch (ext) {
    case 'docx':
      return extractDocx(file)
    case 'txt':
      return extractTxt(file)
    case 'pdf':
      return extractTxt(file) // Basic fallback - PDF requires pdfjs
    default:
      throw new Error(`Formato no soportado: .${ext}. Usa .docx o .txt`)
  }
}

async function extractDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value
}

async function extractTxt(file: File): Promise<string> {
  return await file.text()
}

/**
 * Check if file is an Anki .apkg file
 */
export function isAnkiFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.apkg')
}
