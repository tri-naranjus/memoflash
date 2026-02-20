import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Deck } from '../types'

export function useDecks(userId: string | undefined) {
  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(false)

  const fetchDecks = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      // Fetch decks
      const { data: decksData, error: decksError } = await supabase
        .from('decks')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

      if (decksError) throw decksError

      // Fetch card counts for each deck
      const decksWithCounts: Deck[] = await Promise.all(
        (decksData || []).map(async (deck) => {
          const { count: totalCount } = await supabase
            .from('cards')
            .select('*', { count: 'exact', head: true })
            .eq('deck_id', deck.id)

          const { count: dueCount } = await supabase
            .from('cards')
            .select('*', { count: 'exact', head: true })
            .eq('deck_id', deck.id)
            .lte('next_review', new Date().toISOString())

          return {
            ...deck,
            card_count: totalCount || 0,
            due_count: dueCount || 0,
          }
        })
      )

      setDecks(decksWithCounts)
    } catch (err) {
      console.error('Error fetching decks:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  const createDeck = useCallback(async (name: string, description: string) => {
    if (!userId) throw new Error('No hay usuario autenticado')

    console.log('Creating deck:', { user_id: userId, name, description })

    const { data, error } = await supabase
      .from('decks')
      .insert({ user_id: userId, name, description: description || null })
      .select()

    console.log('Supabase response:', { data, error })

    if (error) throw new Error(`Error Supabase: ${error.message} (${error.code})`)
    await fetchDecks()
  }, [userId, fetchDecks])

  const deleteDeck = useCallback(async (deckId: string) => {
    // First delete all cards in the deck
    await supabase.from('cards').delete().eq('deck_id', deckId)
    // Then delete the deck
    const { error } = await supabase.from('decks').delete().eq('id', deckId)
    if (error) throw error
    await fetchDecks()
  }, [fetchDecks])

  return { decks, loading, fetchDecks, createDeck, deleteDeck }
}
