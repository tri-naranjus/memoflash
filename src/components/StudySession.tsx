import { useState, useEffect, useCallback, useRef } from 'react'
import type { Deck, StudyCard } from '../types'
import { useCards } from '../hooks/useCards'
import { shuffle } from '../lib/sm2'
import { generateDistractorsForCard, AI_PROVIDERS } from '../lib/aiGenerator'
import type { AIProviderKey } from '../lib/aiGenerator'

interface StudySessionProps {
  deck: Deck
  userId: string
  onBack: () => void
}

const MAX_RETRIES = 3

// ── AI Config stored in localStorage (with env var fallback) ──────────────
const DEFAULT_GOOGLE_KEY = import.meta.env.VITE_GOOGLE_AI_API_KEY || ''

function getStoredAIConfig(): { provider: AIProviderKey; apiKey: string } {
  try {
    return {
      provider: (localStorage.getItem('memoflash_ai_provider') as AIProviderKey) || 'google',
      apiKey: localStorage.getItem('memoflash_ai_key') || DEFAULT_GOOGLE_KEY,
    }
  } catch {
    return { provider: 'google', apiKey: DEFAULT_GOOGLE_KEY }
  }
}
function saveAIConfig(provider: AIProviderKey, apiKey: string) {
  localStorage.setItem('memoflash_ai_provider', provider)
  localStorage.setItem('memoflash_ai_key', apiKey)
}

// ── AI Config Modal ────────────────────────────────────────────────────────
function AIConfigModal({
  onSave,
  onCancel,
  initial,
}: {
  onSave: (provider: AIProviderKey, apiKey: string) => void
  onCancel: () => void
  initial: { provider: AIProviderKey; apiKey: string }
}) {
  const [provider, setProvider] = useState<AIProviderKey>(initial.provider)
  const [apiKey, setApiKey] = useState(initial.apiKey)

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-container" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h3>⚙️ Configurar IA para el estudio</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginTop: 4 }}>
            La IA genera distractores realistas y explicaciones al instante
          </p>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Proveedor de IA</label>
            <select
              className="form-input"
              value={provider}
              onChange={e => setProvider(e.target.value as AIProviderKey)}
            >
              {Object.entries(AI_PROVIDERS).map(([key, p]) => (
                <option key={key} value={key}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">
              API Key{' '}
              <a
                href={
                  provider === 'google'
                    ? 'https://aistudio.google.com/apikey'
                    : provider === 'openrouter'
                    ? 'https://openrouter.ai/keys'
                    : 'https://platform.openai.com/api-keys'
                }
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '0.75rem', color: 'var(--primary)' }}
              >
                (Obtener gratis →)
              </a>
            </label>
            <input
              className="form-input"
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
            />
          </div>
          <div
            style={{
              background: 'var(--primary-50)',
              border: '1px solid var(--primary-light)',
              borderRadius: 'var(--radius)',
              padding: '0.75rem',
              fontSize: '0.82rem',
              color: 'var(--gray-600)',
            }}
          >
            💡 <strong>Groq</strong> y <strong>OpenRouter (Qwen)</strong> son gratuitos. Sin clave, se mostrarán solo las opciones guardadas.
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={() => onSave(provider, apiKey)}
          >
            Guardar y continuar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export function StudySession({ deck, userId, onBack }: StudySessionProps) {
  const { getDueCards, answerCard } = useCards(deck.id)

  const [studyCards, setStudyCards] = useState<StudyCard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [loading, setLoading] = useState(true)
  const [correctCount, setCorrectCount] = useState(0)
  const [incorrectCount, setIncorrectCount] = useState(0)
  const [totalAnswered, setTotalAnswered] = useState(0)

  // AI state
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [showAIConfig, setShowAIConfig] = useState(false)
  const [aiConfig, setAIConfig] = useState(getStoredAIConfig)
  const aiGeneratedRef = useRef<Set<string>>(new Set()) // track cards we've generated for

  useEffect(() => {
    loadCards()
  }, [])

  const loadCards = async () => {
    try {
      const due = await getDueCards()
      if (due.length === 0) {
        setIsComplete(true)
      } else {
        setStudyCards(shuffle(due))
      }
    } catch (err) {
      console.error('Error loading study cards:', err)
    } finally {
      setLoading(false)
    }
  }

  const currentCard = studyCards[currentIndex]

  // ── Generate AI distractors for current card ─────────────────────────────
  const generateAIOptions = useCallback(async (card: StudyCard) => {
    if (!aiConfig.apiKey) return
    const cacheKey = `${card.id}:${card.retries}`
    if (aiGeneratedRef.current.has(cacheKey)) return // already generated for this card+retry

    // Only call AI if card has no stored wrong answers
    const hasStoredOptions =
      card.wrong_answer_1 && card.wrong_answer_2 && card.wrong_answer_3

    if (hasStoredOptions) return // card already has distractors from DB

    setAiLoading(true)
    setAiError(null)
    try {
      const result = await generateDistractorsForCard(
        card.question,
        card.correct_answer,
        aiConfig.apiKey,
        aiConfig.provider,
      )

      aiGeneratedRef.current.add(cacheKey)

      const newOptions = shuffle([
        card.correct_answer,
        result.wrong_answer_1,
        result.wrong_answer_2,
        result.wrong_answer_3,
      ])

      const wrongExplanations: Record<string, string> = {
        [result.wrong_answer_1]: result.wrong_explanation_1,
        [result.wrong_answer_2]: result.wrong_explanation_2,
        [result.wrong_answer_3]: result.wrong_explanation_3,
      }

      const cardId = card.id
      setStudyCards(prev =>
        prev.map(c =>
          c.id === cardId && c.retries === card.retries
            ? {
                ...c,
                options: newOptions,
                aiWrong1: result.wrong_answer_1,
                aiWrong2: result.wrong_answer_2,
                aiWrong3: result.wrong_answer_3,
                aiExplanation: result.explanation,
                aiWrongExp1: result.wrong_explanation_1,
                aiWrongExp2: result.wrong_explanation_2,
                aiWrongExp3: result.wrong_explanation_3,
                aiHint: result.hint,
                wrongExplanations,
              }
            : c,
        ),
      )
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Error al generar opciones con IA')
    } finally {
      setAiLoading(false)
    }
  }, [aiConfig, currentIndex])

  // Trigger AI generation when card changes
  useEffect(() => {
    if (currentCard && !loading) {
      generateAIOptions(currentCard)
    }
  }, [currentCard?.id, loading])

  // ── Answer handler ────────────────────────────────────────────────────────
  const handleSelect = useCallback(async (answer: string) => {
    if (selected || aiLoading) return
    setSelected(answer)

    const isCorrect = answer === currentCard.correct_answer

    if (isCorrect) {
      setCorrectCount(c => c + 1)
      setTotalAnswered(t => t + 1)
      try { await answerCard(currentCard, 4, userId) } catch (e) { console.error(e) }
    } else {
      setIncorrectCount(c => c + 1)
      setTotalAnswered(t => t + 1)

      if (currentCard.retries < MAX_RETRIES) {
        const retryCard: StudyCard = {
          ...currentCard,
          retries: currentCard.retries + 1,
          options: shuffle(currentCard.options),
        }
        setStudyCards(prev => [...prev, retryCard])
      } else {
        try { await answerCard(currentCard, 1, userId) } catch (e) { console.error(e) }
      }
    }
  }, [selected, aiLoading, currentCard, answerCard, userId])

  // ── Next card ─────────────────────────────────────────────────────────────
  const handleNext = useCallback(() => {
    setSelected(null)
    setShowHint(false)
    setAiError(null)

    if (currentIndex + 1 >= studyCards.length) {
      setIsComplete(true)
    } else {
      setCurrentIndex(i => i + 1)
    }
  }, [currentIndex, studyCards.length])

  // ── AI Config save ────────────────────────────────────────────────────────
  const handleSaveAIConfig = (provider: AIProviderKey, apiKey: string) => {
    saveAIConfig(provider, apiKey)
    setAIConfig({ provider, apiKey })
    setShowAIConfig(false)
    // reset generated cache so new config is used
    aiGeneratedRef.current.clear()
    if (currentCard) {
      // Reset all AI-generated fields so they get regenerated with new config
      setStudyCards(prev =>
        prev.map(c => ({
          ...c,
          aiWrong1: undefined,
          aiWrong2: undefined,
          aiWrong3: undefined,
          aiExplanation: undefined,
          aiHint: undefined,
          wrongExplanations: undefined,
        }))
      )
      setTimeout(() => generateAIOptions(currentCard), 150)
    }
  }

  // ── Derived helpers ───────────────────────────────────────────────────────
  const getExplanationForSelected = (): { text: string; type: 'correct' | 'wrong' } | null => {
    if (!selected || !currentCard) return null

    const isCorrect = selected === currentCard.correct_answer

    if (isCorrect) {
      const text =
        currentCard.aiExplanation ||
        currentCard.explanation ||
        `✓ Correcto. "${currentCard.correct_answer}" es la respuesta correcta.`
      return { text, type: 'correct' }
    } else {
      // Wrong answer explanation
      const wrongExp = currentCard.wrongExplanations?.[selected]
      const text = wrongExp
        ? `✗ "${selected}" está mal: ${wrongExp}\n\n✓ La respuesta correcta es: ${currentCard.correct_answer}${
            currentCard.aiExplanation ? `\n\n${currentCard.aiExplanation}` : currentCard.explanation ? `\n\n${currentCard.explanation}` : ''
          }`
        : currentCard.explanation
        ? `✗ Respuesta incorrecta.\n\n✓ La respuesta correcta es: ${currentCard.correct_answer}\n\n${currentCard.explanation}`
        : `✗ Respuesta incorrecta. La respuesta correcta es: "${currentCard.correct_answer}"`
      return { text, type: 'wrong' }
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  const getHint = (): string | null =>
    currentCard?.aiHint || currentCard?.hint || null

  const hasEnoughOptions = (card: StudyCard): boolean =>
    card.options.length >= 2

  // ── Screens ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="study-container">
        <div className="loading-screen" style={{ minHeight: '400px' }}>
          <div className="loading-spinner" />
          <span className="loading-text">Preparando sesión de estudio...</span>
        </div>
      </div>
    )
  }

  if (isComplete) {
    const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0
    return (
      <div className="study-container">
        <div className="study-complete">
          <div className="study-complete-icon">🎉</div>
          <h2>¡Sesión completada!</h2>
          <p>Has terminado de repasar el mazo "{deck.name}"</p>
          <div className="study-results">
            <div className="study-result-item">
              <span className="study-result-value green">{correctCount}</span>
              <span className="study-result-label">Correctas</span>
            </div>
            <div className="study-result-item">
              <span className="study-result-value red">{incorrectCount}</span>
              <span className="study-result-label">Incorrectas</span>
            </div>
            <div className="study-result-item">
              <span className="study-result-value blue">{accuracy}%</span>
              <span className="study-result-label">Precisión</span>
            </div>
          </div>
          <button className="btn btn-primary btn-lg" onClick={onBack}>← Volver al mazo</button>
        </div>
      </div>
    )
  }

  if (!currentCard) {
    return (
      <div className="study-container">
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <h3>No hay tarjetas para repasar</h3>
          <p>Vuelve más tarde cuando haya tarjetas pendientes</p>
          <button className="btn btn-primary" onClick={onBack}>← Volver</button>
        </div>
      </div>
    )
  }

  const progress = ((currentIndex + 1) / studyCards.length) * 100
  const explanationData = getExplanationForSelected()
  const hint = getHint()
  const isCorrectSelected = selected === currentCard.correct_answer

  return (
    <div className="study-container">
      {showAIConfig && (
        <AIConfigModal
          initial={aiConfig}
          onSave={handleSaveAIConfig}
          onCancel={() => setShowAIConfig(false)}
        />
      )}

      {/* Header */}
      <div className="deck-detail-header">
        <button className="back-btn" onClick={onBack} title="Salir">←</button>
        <div className="deck-detail-info">
          <h2>Estudiando: {deck.name}</h2>
        </div>
        <button
          className="btn btn-sm btn-secondary"
          onClick={() => setShowAIConfig(true)}
          title="Configurar IA"
          style={{ marginLeft: 'auto' }}
        >
          ⚙️ IA
        </button>
      </div>

      {/* Progress */}
      <div className="study-progress">
        <div className="study-progress-bar">
          <div className="study-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="study-progress-text">{currentIndex + 1} / {studyCards.length}</span>
      </div>

      {/* Main card */}
      <div className="study-card">
        {/* Question */}
        <div className="study-card-question">
          <h3>{currentCard.question}</h3>

          {currentCard.retries > 0 && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--warning)' }}>
              🔄 Reintento {currentCard.retries}/{MAX_RETRIES}
            </div>
          )}
        </div>

        {/* Hint row */}
        {!selected && hint && (
          <div className="study-hint-row">
            {!showHint ? (
              <button
                className="btn btn-sm study-hint-btn"
                onClick={() => setShowHint(true)}
              >
                💡 Ver pista
              </button>
            ) : (
              <div className="study-hint">
                <span className="study-hint-label">💡 Pista</span>
                <span>{hint}</span>
              </div>
            )}
          </div>
        )}

        {/* AI loading state */}
        {aiLoading && (
          <div className="study-ai-loading">
            <div className="loading-spinner loading-spinner-sm" />
            <span>La IA está generando opciones realistas...</span>
          </div>
        )}

        {/* AI error */}
        {aiError && !aiLoading && (
          <div className="study-ai-error">
            <span>⚠️ {aiError}</span>
            <button
              className="btn btn-sm"
              onClick={() => {
                setAiError(null)
                aiGeneratedRef.current.delete(currentCard.id)
                generateAIOptions(currentCard)
              }}
            >
              Reintentar
            </button>
            {!aiConfig.apiKey && (
              <button
                className="btn btn-sm btn-primary"
                onClick={() => setShowAIConfig(true)}
              >
                Configurar IA
              </button>
            )}
          </div>
        )}

        {/* Options */}
        {!aiLoading && hasEnoughOptions(currentCard) && (
          <div className="study-options">
            {currentCard.options.map((option, idx) => {
              let className = 'study-option'
              if (selected) {
                if (option === currentCard.correct_answer) {
                  className += selected === option ? ' correct' : ' was-correct'
                } else if (option === selected) {
                  className += ' incorrect'
                } else {
                  className += ' disabled-opt'
                }
              }
              return (
                <button
                  key={idx}
                  className={className}
                  onClick={() => handleSelect(option)}
                  disabled={!!selected}
                >
                  <span className="study-option-letter">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="study-option-text">{option}</span>
                  {selected && option === currentCard.correct_answer && (
                    <span className="study-option-badge correct-badge">✓</span>
                  )}
                  {selected && option === selected && option !== currentCard.correct_answer && (
                    <span className="study-option-badge wrong-badge">✗</span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* No AI key — show only correct/wrong (2 options) */}
        {!aiLoading && !hasEnoughOptions(currentCard) && !selected && (
          <div className="study-no-ai-notice">
            <span>⚡ Sin IA configurada — modo flash card</span>
            <button className="btn btn-sm btn-primary" onClick={() => setShowAIConfig(true)}>
              Activar IA
            </button>
          </div>
        )}

        {/* Explanation panel */}
        {selected && explanationData && (
          <div className={`study-explanation-panel ${explanationData.type}`}>
            {explanationData.type === 'correct' ? (
              <div className="study-explanation-header correct">
                ✅ ¡Correcto!
              </div>
            ) : (
              <div className="study-explanation-header wrong">
                ❌ Incorrecto
              </div>
            )}
            <div className="study-explanation-body">
              {explanationData.text.split('\n\n').map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </div>
        )}

        {/* Next button */}
        {selected && (
          <div className="study-next-btn">
            <button
              className={`btn btn-lg btn-full ${isCorrectSelected ? 'btn-primary' : 'btn-danger'}`}
              onClick={handleNext}
            >
              {currentIndex + 1 >= studyCards.length
                ? '🏁 Ver resultados'
                : isCorrectSelected
                ? 'Siguiente →'
                : '🔁 Continuar'}
            </button>
          </div>
        )}
      </div>

      {/* Bottom stats bar */}
      <div className="study-stats-bar">
        <span className="study-stat correct">✓ {correctCount}</span>
        <span className="study-stat wrong">✗ {incorrectCount}</span>
        <span className="study-stat neutral">
          {totalAnswered > 0
            ? `${Math.round((correctCount / totalAnswered) * 100)}% acierto`
            : 'Comenzando...'}
        </span>
      </div>
    </div>
  )
}
