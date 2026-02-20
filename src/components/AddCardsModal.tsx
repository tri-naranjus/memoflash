import { useState } from 'react'
import type { Card } from '../types'

interface AddCardsModalProps {
  onClose: () => void
  onAdd: (cards: Partial<Card>[]) => Promise<void>
}

export function AddCardsModal({ onClose, onAdd }: AddCardsModalProps) {
  const [mode, setMode] = useState<'manual' | 'bulk'>('manual')
  const [loading, setLoading] = useState(false)

  // Manual mode
  const [question, setQuestion] = useState('')
  const [correctAnswer, setCorrectAnswer] = useState('')
  const [wrong1, setWrong1] = useState('')
  const [wrong2, setWrong2] = useState('')
  const [wrong3, setWrong3] = useState('')
  const [explanation, setExplanation] = useState('')
  const [hint, setHint] = useState('')

  // Bulk mode
  const [bulkText, setBulkText] = useState('')

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!question.trim() || !correctAnswer.trim()) return
    setLoading(true)
    try {
      await onAdd([{
        question: question.trim(),
        correct_answer: correctAnswer.trim(),
        wrong_answer_1: wrong1.trim() || null,
        wrong_answer_2: wrong2.trim() || null,
        wrong_answer_3: wrong3.trim() || null,
        explanation: explanation.trim() || null,
        hint: hint.trim() || null,
      }])
      // Reset for next card
      setQuestion('')
      setCorrectAnswer('')
      setWrong1('')
      setWrong2('')
      setWrong3('')
      setExplanation('')
      setHint('')
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleBulkSubmit = async () => {
    if (!bulkText.trim()) return
    setLoading(true)
    try {
      const cards = parseBulkText(bulkText)
      if (cards.length === 0) {
        alert('No se encontraron tarjetas. Usa el formato:\nPregunta\nRespuesta correcta\nRespuesta incorrecta 1\nRespuesta incorrecta 2\nRespuesta incorrecta 3\n(línea vacía entre tarjetas)')
        setLoading(false)
        return
      }
      await onAdd(cards)
      setBulkText('')
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
        <h2>Añadir tarjetas</h2>

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <button
            className={`btn btn-sm ${mode === 'manual' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode('manual')}
          >
            ✏️ Manual
          </button>
          <button
            className={`btn btn-sm ${mode === 'bulk' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode('bulk')}
          >
            📋 Texto masivo
          </button>
        </div>

        {mode === 'manual' ? (
          <form onSubmit={handleManualSubmit}>
            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label>Pregunta *</label>
              <input
                className="form-input"
                placeholder="Escribe la pregunta..."
                value={question}
                onChange={e => setQuestion(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label>Respuesta correcta *</label>
              <input
                className="form-input"
                placeholder="La respuesta correcta"
                value={correctAnswer}
                onChange={e => setCorrectAnswer(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label>Respuestas incorrectas (opcionales)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <input className="form-input" placeholder="Incorrecta 1" value={wrong1} onChange={e => setWrong1(e.target.value)} />
                <input className="form-input" placeholder="Incorrecta 2" value={wrong2} onChange={e => setWrong2(e.target.value)} />
                <input className="form-input" placeholder="Incorrecta 3" value={wrong3} onChange={e => setWrong3(e.target.value)} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label>Explicación (opcional)</label>
              <input
                className="form-input"
                placeholder="¿Por qué es correcta?"
                value={explanation}
                onChange={e => setExplanation(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label>Pista (opcional)</label>
              <input
                className="form-input"
                placeholder="Una pista para ayudar..."
                value={hint}
                onChange={e => setHint(e.target.value)}
              />
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cerrar</button>
              <button type="submit" className="btn btn-primary" disabled={loading || !question.trim() || !correctAnswer.trim()}>
                {loading ? '⏳ Añadiendo...' : '+ Añadir tarjeta'}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label>Pega tu texto (una tarjeta por bloque, separadas por línea vacía)</label>
              <textarea
                className="form-input"
                style={{ minHeight: '200px', resize: 'vertical' }}
                placeholder={`Formato por tarjeta:\nPregunta\nRespuesta correcta\nRespuesta incorrecta 1\nRespuesta incorrecta 2\nRespuesta incorrecta 3\n\n(Siguiente tarjeta...)`}
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
              />
            </div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1rem' }}>
              Mínimo 2 líneas por bloque (pregunta + respuesta correcta). Las respuestas incorrectas son opcionales.
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
              <button
                className="btn btn-primary"
                onClick={handleBulkSubmit}
                disabled={loading || !bulkText.trim()}
              >
                {loading ? '⏳ Procesando...' : '+ Añadir todas'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function parseBulkText(text: string): Partial<Card>[] {
  const blocks = text.split(/\n\s*\n/).filter(b => b.trim())
  const cards: Partial<Card>[] = []

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) continue

    cards.push({
      question: lines[0],
      correct_answer: lines[1],
      wrong_answer_1: lines[2] || null,
      wrong_answer_2: lines[3] || null,
      wrong_answer_3: lines[4] || null,
    })
  }

  return cards
}
