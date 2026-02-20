import { useState } from 'react'
import type { Deck } from '../types'
import { CreateDeckModal } from './CreateDeckModal'

interface DeckListProps {
  decks: Deck[]
  loading: boolean
  onCreateDeck: (name: string, description: string) => Promise<void>
  onDeleteDeck: (deckId: string) => Promise<void>
  onSelectDeck: (deck: Deck) => void
}

export function DeckList({ decks, loading, onCreateDeck, onDeleteDeck, onSelectDeck }: DeckListProps) {
  const [showCreate, setShowCreate] = useState(false)

  const totalCards = decks.reduce((sum, d) => sum + (d.card_count || 0), 0)
  const totalDue = decks.reduce((sum, d) => sum + (d.due_count || 0), 0)

  return (
    <>
      {/* Stats */}
      <div className="decks-stats">
        <div className="stat-card">
          <div className="stat-icon purple">📦</div>
          <div className="stat-info">
            <span className="stat-value">{decks.length}</span>
            <span className="stat-label">Mazos</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">🃏</div>
          <div className="stat-info">
            <span className="stat-value">{totalCards}</span>
            <span className="stat-label">Tarjetas</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange">🔥</div>
          <div className="stat-info">
            <span className="stat-value">{totalDue}</span>
            <span className="stat-label">Por repasar</span>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="decks-header">
        <h2>Mis mazos</h2>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + Nuevo mazo
        </button>
      </div>

      {/* Deck grid */}
      {loading ? (
        <div className="loading-screen">
          <div className="loading-spinner" />
          <span className="loading-text">Cargando mazos...</span>
        </div>
      ) : decks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <h3>No tienes mazos todavía</h3>
          <p>Crea tu primer mazo para empezar a estudiar</p>
          <button className="btn btn-primary btn-lg" onClick={() => setShowCreate(true)}>
            + Crear mi primer mazo
          </button>
        </div>
      ) : (
        <div className="decks-grid">
          {decks.map(deck => (
            <div
              key={deck.id}
              className="deck-card"
              onClick={() => onSelectDeck(deck)}
            >
              <button
                className="deck-delete-btn"
                title="Eliminar mazo"
                onClick={e => {
                  e.stopPropagation()
                  if (confirm(`¿Eliminar el mazo "${deck.name}" y todas sus tarjetas?`)) {
                    onDeleteDeck(deck.id)
                  }
                }}
              >
                ✕
              </button>
              <div className="deck-card-header">
                <span className="deck-card-title">{deck.name}</span>
              </div>
              {deck.description && (
                <p className="deck-card-desc">{deck.description}</p>
              )}
              <div className="deck-card-footer">
                <span className="deck-card-count">
                  🃏 {deck.card_count || 0} tarjetas
                </span>
                <span className={`deck-card-due ${(deck.due_count || 0) === 0 ? 'none' : ''}`}>
                  {(deck.due_count || 0) > 0
                    ? `${deck.due_count} por repasar`
                    : 'Al día ✓'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateDeckModal
          onClose={() => setShowCreate(false)}
          onCreate={async (name, desc) => {
            await onCreateDeck(name, desc)
            setShowCreate(false)
          }}
        />
      )}
    </>
  )
}
