import { useState, useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import { useDecks } from './hooks/useDecks'
import { LoginPage } from './components/LoginPage'
import { DeckList } from './components/DeckList'
import { DeckDetail } from './components/DeckDetail'
import { StudySession } from './components/StudySession'
import { ToastProvider, useToast } from './components/Toast'
import type { Deck, View } from './types'

function AppContent() {
  const { user, loading: authLoading, signIn, signUp, signOut } = useAuth()
  const { decks, loading: decksLoading, fetchDecks, createDeck, deleteDeck } = useDecks(user?.id)
  const [view, setView] = useState<View>('decks')
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null)
  const { toast } = useToast()

  // Fetch decks when user logs in
  useEffect(() => {
    if (user) {
      fetchDecks()
    }
  }, [user, fetchDecks])

  // Loading
  if (authLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <span className="loading-text">Cargando MemoFlash...</span>
      </div>
    )
  }

  // Not logged in
  if (!user) {
    return <LoginPage onSignIn={signIn} onSignUp={signUp} />
  }

  // Handlers
  const handleSelectDeck = (deck: Deck) => {
    setSelectedDeck(deck)
    setView('deck-detail')
  }

  const handleBackToDecks = () => {
    setSelectedDeck(null)
    setView('decks')
    fetchDecks() // refresh counts
  }

  const handleStartStudy = () => {
    setView('study')
  }

  const handleBackFromStudy = () => {
    setView('deck-detail')
    fetchDecks()
  }

  const handleCreateDeck = async (name: string, description: string) => {
    try {
      await createDeck(name, description)
      toast('Mazo creado correctamente', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      console.error('Error creando mazo:', err)
      toast(msg, 'error')
    }
  }

  const handleDeleteDeck = async (deckId: string) => {
    try {
      await deleteDeck(deckId)
      toast('Mazo eliminado', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      toast(msg, 'error')
    }
  }

  // Study session view
  if (view === 'study' && selectedDeck) {
    return (
      <div className="app-layout">
        <div className="app-main">
          <StudySession
            deck={selectedDeck}
            userId={user.id}
            onBack={handleBackFromStudy}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="app-header">
        <div className="app-header-left">
          <span style={{ fontSize: '1.5rem' }}>📚</span>
          <h1>MemoFlash</h1>
        </div>
        <div className="app-header-right">
          <span className="user-email">{user.email}</span>
          <button className="btn btn-sm btn-secondary" onClick={signOut}>
            Cerrar sesión
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="app-main">
        {view === 'decks' && (
          <DeckList
            decks={decks}
            loading={decksLoading}
            onCreateDeck={handleCreateDeck}
            onDeleteDeck={handleDeleteDeck}
            onSelectDeck={handleSelectDeck}
          />
        )}

        {view === 'deck-detail' && selectedDeck && (
          <DeckDetail
            deck={selectedDeck}
            userId={user.id}
            onBack={handleBackToDecks}
            onStudy={handleStartStudy}
          />
        )}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  )
}
