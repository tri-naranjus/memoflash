import { useState, useRef } from 'react'
import type { Card } from '../types'
import { extractTextFromFile, isAnkiFile } from '../lib/fileExtractor'
import { parseAnkiFile } from '../lib/ankiImporter'
import { generateQuestionsFromText, getProviderInfo } from '../lib/aiGenerator'
import type { AIProviderKey } from '../lib/aiGenerator'
import { useToast } from './Toast'

interface FileImporterProps {
  onImport: (cards: Partial<Card>[]) => Promise<void>
  onClose: () => void
}

const STORAGE_KEY_API = 'memoflash_ai_api_key'
const STORAGE_KEY_PROVIDER = 'memoflash_ai_provider'

export function FileImporter({ onImport, onClose }: FileImporterProps) {
  const [file, setFile] = useState<File | null>(null)
  const [numQuestions, setNumQuestions] = useState(15)
  const [provider, setProvider] = useState<AIProviderKey>(
    () => (localStorage.getItem(STORAGE_KEY_PROVIDER) as AIProviderKey) || 'groq'
  )
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem(STORAGE_KEY_API) || ''
  )
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState('')
  const [preview, setPreview] = useState<Partial<Card>[] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const providers = getProviderInfo()
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

    // For AI-based import, require API key
    if (needsAI && !apiKey.trim()) {
      toast('Añade tu API key para generar preguntas con IA', 'error')
      return
    }

    // Save AI settings
    if (needsAI) {
      localStorage.setItem(STORAGE_KEY_API, apiKey)
      localStorage.setItem(STORAGE_KEY_PROVIDER, provider)
    }

    setProcessing(true)
    setProgress('Leyendo archivo...')

    try {
      let cards: Partial<Card>[]

      if (isAnki) {
        // === ANKI: Importación directa sin IA ===
        setProgress('Parseando archivo Anki...')
        const ankiCards = await parseAnkiFile(file)
        setProgress(`${ankiCards.length} tarjetas encontradas`)

        // Convert Anki cards directly to MemoFlash cards
        // front = question, back = correct_answer
        cards = ankiCards
          .filter(ac => ac.front && ac.back) // skip cards without answer
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
        // === DOCX/TXT/PDF: Generar preguntas con IA ===
        setProgress('Extrayendo texto del documento...')
        const text = await extractTextFromFile(file)
        if (text.length < 50) {
          throw new Error('El documento tiene muy poco texto para generar preguntas')
        }
        setProgress(`Texto extraído (${text.length} chars). Generando ${numQuestions} preguntas con IA...`)
        cards = await generateQuestionsFromText(text, numQuestions, apiKey, provider, setProgress)
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

  const selectedProvider = providers.find(p => p.key === provider)
  const canProcess = isAnki ? !!file : (!!file && !!apiKey.trim())

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '85vh', overflow: 'auto' }}>
        <h2>{isAnki ? '🗂️ Importar mazo Anki' : '📄 Importar con IA'}</h2>

        {/* Step 1: File */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#374151', marginBottom: '0.5rem' }}>
            1. Selecciona un archivo
          </label>
          <div
            className="upload-zone"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            style={{ padding: '1.5rem', marginBottom: 0 }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.txt,.apkg,.pdf"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            {file ? (
              <div>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                  {isAnki ? '🗂️' : '📄'}
                </div>
                <div style={{ fontWeight: 600, color: '#374151' }}>{file.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                  {(file.size / 1024).toFixed(0)} KB — Click para cambiar
                </div>
                {isAnki && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#7c3aed', fontWeight: 500 }}>
                    Mazo Anki detectado — importación directa (sin IA)
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="upload-zone-icon">📂</div>
                <h4>Arrastra un archivo o haz click</h4>
                <p>.apkg (Anki), .docx, .txt</p>
              </div>
            )}
          </div>
        </div>

        {/* AI settings - ONLY for non-Anki files */}
        {needsAI && (
          <>
            {/* Step 2: AI Provider */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#374151', marginBottom: '0.5rem' }}>
                2. Proveedor de IA
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {providers.map(p => (
                  <button
                    key={p.key}
                    className={`btn btn-sm ${provider === p.key ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setProvider(p.key as AIProviderKey)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: '0.35rem' }}>
                Modelo: {selectedProvider?.model}
              </div>
            </div>

            {/* Step 3: API Key */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#374151', marginBottom: '0.5rem' }}>
                3. API Key {provider === 'groq' && <span style={{ fontWeight: 400, color: '#9ca3af' }}>
                  (gratis en <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" style={{ color: '#7c3aed' }}>console.groq.com</a>)
                </span>}
                {provider === 'openrouter' && <span style={{ fontWeight: 400, color: '#9ca3af' }}>
                  (gratis en <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" style={{ color: '#7c3aed' }}>openrouter.ai</a>)
                </span>}
              </label>
              <input
                className="form-input"
                type="password"
                placeholder={`API Key de ${selectedProvider?.name || 'IA'}`}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
              />
            </div>

            {/* Step 4: Number of questions */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#374151', marginBottom: '0.5rem' }}>
                4. Número de preguntas a generar
              </label>
              <div className="number-input-group">
                <input
                  type="range"
                  min={5}
                  max={50}
                  value={numQuestions}
                  onChange={e => setNumQuestions(Number(e.target.value))}
                />
                <span>{numQuestions}</span>
              </div>
            </div>
          </>
        )}

        {/* Progress */}
        {processing && (
          <div className="upload-progress">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="loading-spinner" style={{ width: '24px', height: '24px', borderWidth: '3px' }} />
              <span style={{ fontSize: '0.9rem', color: '#4b5563' }}>{progress}</span>
            </div>
          </div>
        )}

        {/* Preview */}
        {preview && preview.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#374151', marginBottom: '0.5rem' }}>
              Vista previa ({preview.length} tarjetas)
            </div>
            <div style={{
              maxHeight: '200px', overflow: 'auto',
              border: '1px solid #e5e7eb', borderRadius: '10px',
              background: '#f9fafb',
            }}>
              {preview.map((card, i) => (
                <div key={i} style={{
                  padding: '0.75rem 1rem',
                  borderBottom: i < preview.length - 1 ? '1px solid #e5e7eb' : 'none',
                }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1f2937', marginBottom: '0.25rem' }}>
                    {i + 1}. {card.question}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#10b981' }}>
                    ✓ {card.correct_answer}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose} disabled={processing}>
            Cancelar
          </button>

          {preview ? (
            <button className="btn btn-success" onClick={handleImport} disabled={processing}>
              {processing ? '⏳ Guardando...' : `✓ Importar ${preview.length} tarjetas`}
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleProcess}
              disabled={processing || !canProcess}
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
