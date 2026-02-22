import { useState, useRef } from 'react'
import type { Card } from '../types'
import { extractTextFromFile, isAnkiFile } from '../lib/fileExtractor'
import { parseAnkiFile } from '../lib/ankiImporter'
import { generateQuestionsFromText } from '../lib/aiGenerator'
import { useToast } from './Toast'

interface FileImporterProps {
  onImport: (cards: Partial<Card>[]) => Promise<void>
  onClose: () => void
}

// Usa siempre Google AI con la clave del entorno
const AI_API_KEY = import.meta.env.VITE_GOOGLE_AI_API_KEY || ''
const AI_PROVIDER = 'google' as const

export function FileImporter({ onImport, onClose }: FileImporterProps) {
  const [file, setFile] = useState<File | null>(null)
  const [numQuestions, setNumQuestions] = useState(15)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState('')
  const [preview, setPreview] = useState<Partial<Card>[] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const isAnki = file ? isAnkiFile(file) : false
  const needsAI = file && !isAnki

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
      setPreview(null)
      setProgress('')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const dropped = e.dataTransfer.files[0]
    if (dropped) {
      setFile(dropped)
      setPreview(null)
      setProgress('')
    }
  }

  const handleProcess = async () => {
    if (!file) return

    setProcessing(true)
    setProgress('Leyendo archivo...')

    try {
      let cards: Partial<Card>[]

      if (isAnki) {
        // === ANKI: Importación directa sin IA ===
        setProgress('Parseando archivo Anki...')
        const ankiCards = await parseAnkiFile(file)
        setProgress(`${ankiCards.length} tarjetas encontradas`)

        cards = ankiCards
          .filter(ac => ac.front && ac.back)
          .map(ac => ({
            question: ac.front,
            correct_answer: ac.back,
            wrong_answer_1: null,
            wrong_answer_2: null,
            wrong_answer_3: null,
            explanation: null,
            hint: null,
          }))
      } else {
        // === DOCX/TXT: Generar preguntas con IA (Groq automático) ===
        setProgress('Extrayendo texto del documento...')
        const text = await extractTextFromFile(file)

        if (text.length < 50) {
          throw new Error('El documento tiene muy poco texto para generar preguntas')
        }

        setProgress(`Texto extraído. Generando ${numQuestions} preguntas con IA...`)
        cards = await generateQuestionsFromText(
          text,
          numQuestions,
          AI_API_KEY,
          AI_PROVIDER,
          setProgress,
        )
      }

      setProgress(`¡${cards.length} tarjetas listas!`)
      setPreview(cards)
      toast(`${cards.length} tarjetas listas para importar`, 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      console.error('Error processing file:', err)
      toast(msg, 'error')
      setProgress('')
    } finally {
      setProcessing(false)
    }
  }

  const handleImport = async () => {
    if (!preview) return
    setProcessing(true)
    const total = preview.length
    setProgress(`Guardando ${total} tarjetas...`)
    try {
      await onImport(preview)
      toast(`${total} tarjetas importadas`, 'success')
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido al guardar'
      console.error('Import error:', err)
      toast(msg, 'error')
      setProgress('')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
        <div className="modal-header">
          <h3>{isAnki ? '🗂️ Importar mazo Anki' : '🤖 Importar con IA'}</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginTop: 4 }}>
            {isAnki
              ? 'Importación directa desde archivo .apkg'
              : 'La IA generará preguntas y respuestas a partir de tu documento'}
          </p>
        </div>

        <div className="modal-body">
          {/* Zona de archivo */}
          <div
            className="upload-zone"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.txt,.apkg"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            {file ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
                  {isAnki ? '🗂️' : '📄'}
                </div>
                <div style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{file.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--gray-400)', marginTop: '0.25rem' }}>
                  {(file.size / 1024).toFixed(0)} KB · Click para cambiar
                </div>
                {isAnki && (
                  <div style={{
                    marginTop: '0.75rem',
                    display: 'inline-block',
                    background: 'var(--primary-light)',
                    color: 'var(--primary)',
                    borderRadius: 'var(--radius)',
                    padding: '0.3rem 0.75rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}>
                    Mazo Anki · importación directa
                  </div>
                )}
                {needsAI && (
                  <div style={{
                    marginTop: '0.75rem',
                    display: 'inline-block',
                    background: 'var(--success-light)',
                    color: '#065f46',
                    borderRadius: 'var(--radius)',
                    padding: '0.3rem 0.75rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}>
                    🤖 Groq IA · generación automática
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div className="upload-zone-icon">📂</div>
                <h4>Arrastra un archivo o haz click</h4>
                <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  .apkg (Anki) · .docx · .txt
                </p>
              </div>
            )}
          </div>

          {/* Número de preguntas — solo para documentos */}
          {needsAI && (
            <div className="form-group" style={{ marginTop: '1.25rem' }}>
              <label className="form-label">
                Número de preguntas a generar
                <span style={{ fontWeight: 400, color: 'var(--gray-400)', marginLeft: '0.5rem' }}>
                  (recomendado: 15–30)
                </span>
              </label>
              <div className="number-input-group">
                <input
                  type="range"
                  min={5}
                  max={50}
                  value={numQuestions}
                  onChange={e => setNumQuestions(Number(e.target.value))}
                />
                <span style={{ minWidth: '2.5rem', textAlign: 'center', fontWeight: 700, color: 'var(--primary)' }}>
                  {numQuestions}
                </span>
              </div>
            </div>
          )}

          {/* Progreso */}
          {(processing || progress) && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginTop: '1rem',
              padding: '0.85rem 1rem',
              background: 'var(--primary-50)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--primary-light)',
            }}>
              {processing && (
                <div className="loading-spinner" style={{ width: 22, height: 22, borderWidth: 3, flexShrink: 0 }} />
              )}
              {!processing && <span style={{ fontSize: '1.1rem' }}>✅</span>}
              <span style={{ fontSize: '0.9rem', color: 'var(--gray-700)' }}>{progress}</span>
            </div>
          )}

          {/* Preview */}
          {preview && preview.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--gray-600)', marginBottom: '0.5rem' }}>
                Vista previa · {preview.length} tarjetas
              </div>
              <div style={{
                maxHeight: 220,
                overflow: 'auto',
                border: '1px solid var(--gray-200)',
                borderRadius: 'var(--radius)',
                background: 'var(--gray-50)',
              }}>
                {preview.map((card, i) => (
                  <div key={i} style={{
                    padding: '0.65rem 1rem',
                    borderBottom: i < preview.length - 1 ? '1px solid var(--gray-200)' : 'none',
                  }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--gray-800)', marginBottom: '0.2rem' }}>
                      {i + 1}. {card.question}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--success)' }}>
                      ✓ {card.correct_answer}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={processing}>
            Cancelar
          </button>

          {preview ? (
            <button className="btn btn-primary" onClick={handleImport} disabled={processing}>
              {processing ? '⏳ Guardando...' : `✅ Importar ${preview.length} tarjetas`}
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleProcess}
              disabled={processing || !file}
            >
              {processing
                ? '⏳ Procesando...'
                : isAnki
                  ? '📥 Importar Anki'
                  : '🤖 Generar preguntas'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
