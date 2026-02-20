import { useState, useEffect } from 'react'
import type { Deck, Card } from '../types'
import { useCards } from '../hooks/useCards'
import { AddCardsModal } from './AddCardsModal'
import { FileImporter } from './FileImporter'
import { useToast } from './Toast'

interface DeckDetailProps {
  deck: Deck
  userId: string
  onBack: () => void
  onStudy: () => void
}

export function DeckDetail({ deck, userId, onBack, onStudy }: DeckDetailProps) {
  const { cards, loading, fetchCards, addCards } = useCards(deck.id)
  const [showAddCards, setShowAddCards] = useState(false)
  const [showFileImport, setShowFileImport] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchCards()
  }, [fetchCards])

  const dueCards = cards.filter(c =>
    new Date(c.next_review) <= new Date()
  )

  const handleAddCards = async (newCards: Partial<Card>[]) => {
    try {
      await addCards(newCards)
      toast(`${newCards.length} tarjetas añadidas`, 'success')
      setShowAddCards(false)
    } catch (err) {
      toast('Error al añadir tarjetas', 'error')
    }
  }

  const handleImportCards = async (newCards: Partial<Card>[]) => {
    // throws on error — FileImporter will catch and show the message
    await addCards(newCards)
    await fetchCards()
  }

  const getCardStatus = (card: Card): 'new' | 'due' | 'review' => {
    if (card.repetitions === 0) return 'new'
    if (new Date(card.next_review) <= new Date()) return 'due'
    return 'review'
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'new': return 'Nueva'
      case 'due': return 'Por repasar'
      case 'review': return 'Repasada'
      default: return status
    }
  }

  return (
    <>
      {/* Header */}
      <div className="deck-detail-header">
        <button className="back-btn" onClick={onBack} title="Volver">
          ←
        </button>
        <div className="deck-detail-info">
          <h2>{deck.name}</h2>
          {deck.description && <p>{deck.description}</p>}
        </div>
      </div>

      {/* Stats row */}
      <div className="decks-stats">
        <div className="stat-card">
          <div className="stat-icon purple">🃏</div>
          <div className="stat-info">
            <span className="stat-value">{cards.length}</span>
            <span className="stat-label">Total tarjetas</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange">🔥</div>
          <div className="stat-info">
            <span className="stat-value">{dueCards.length}</span>
            <span className="stat-label">Por repasar</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">✅</div>
          <div className="stat-info">
            <span className="stat-value">{cards.length - dueCards.length}</span>
            <span className="stat-label">Al día</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="deck-detail-actions">
        <button
          className="btn btn-success btn-lg"
          onClick={onStudy}
          disabled={dueCards.length === 0}
        >
          {dueCards.length > 0
            ? `▶ Estudiar (${dueCards.length} tarjetas)`
            : '✓ Todas repasadas'}
        </button>
        <button className="btn btn-primary" onClick={() => setShowFileImport(true)}>
          📄 Importar con IA
        </button>
        <button className="btn btn-secondary" onClick={() => setShowAddCards(true)}>
          ✏️ Añadir manual
        </button>
      </div>

      {/* Cards list */}
      {loading ? (
        <div className="loading-screen" style={{ minHeight: '200px' }}>
          <div className="loading-spinner" />
          <span className="loading-text">Cargando tarjetas...</span>
        </div>
      ) : cards.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <h3>No hay tarjetas en este mazo</h3>
          <p>Importa un archivo con IA o añade tarjetas manualmente</p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-lg" onClick={() => setShowFileImport(true)}>
              📄 Importar con IA
            </button>
            <button className="btn btn-secondary btn-lg" onClick={() => setShowAddCards(true)}>
              ✏️ Añadir manual
            </button>
          </div>
        </div>
      ) : (
        <div className="cards-section">
          <div className="cards-section-header">
            <h3>Tarjetas ({cards.length})</h3>
          </div>
          {cards.map(card => {
            const status = getCardStatus(card)
            return (
              <div key={card.id} className="card-item">
                <div className="card-question">{card.question}</div>
                <div className="card-answer">✓ {card.correct_answer}</div>
                <div className="card-meta">
                  <span className={`card-badge ${status}`}>
                    {getStatusLabel(status)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {showAddCards && (
        <AddCardsModal
          onClose={() => setShowAddCards(false)}
          onAdd={handleAddCards}
        />
      )}
      {showFileImport && (
        <FileImporter
          onImport={handleImportCards}
          onClose={() => setShowFileImport(false)}
        />
      )}
    </>
  )
}
