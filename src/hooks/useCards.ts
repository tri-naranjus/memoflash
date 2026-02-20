import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { calculateSM2, shuffle } from '../lib/sm2'
import type { Card, StudyCard } from '../types'

export function useCards(deckId: string | undefined) {
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(false)

  const fetchCards = useCallback(async () => {
    if (!deckId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .eq('deck_id', deckId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setCards(data || [])
    } catch (err) {
      console.error('Error fetching cards:', err)
    } finally {
      setLoading(false)
    }
  }, [deckId])

  const getDueCards = useCallback(async (): Promise<StudyCard[]> => {
    if (!deckId) return []
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('deck_id', deckId)
      .lte('next_review', new Date().toISOString())
      .order('next_review', { ascending: true })

    if (error) throw error

    return (data || []).map((card) => {
      const options = buildOptions(card)
      return { ...card, options, retries: 0 }
    })
  }, [deckId])

  const answerCard = useCallback(async (
    card: Card,
    quality: number,
    userId: string
  ) => {
    const result = calculateSM2(
      quality,
      card.repetitions,
      card.interval,
      card.ease_factor
    )

    // Update card with new SM-2 values
    const { error: updateError } = await supabase
      .from('cards')
      .update({
        repetitions: result.repetitions,
        interval: result.interval,
        ease_factor: result.ease_factor,
        next_review: result.next_review,
        updated_at: new Date().toISOString(),
      })
      .eq('id', card.id)

    if (updateError) throw updateError

    // Record the review
    await supabase.from('card_reviews').insert({
      card_id: card.id,
      user_id: userId,
      quality,
      response_time_ms: 0,
    })

    return result
  }, [])

  const addCards = useCallback(async (newCards: Partial<Card>[]) => {
    if (!deckId) return

    const now = new Date().toISOString()
    const cardsToInsert = newCards.map(c => ({
      deck_id: deckId,
      question: c.question || '',
      correct_answer: c.correct_answer || '',
      wrong_answer_1: c.wrong_answer_1 || null,
      wrong_answer_2: c.wrong_answer_2 || null,
      wrong_answer_3: c.wrong_answer_3 || null,
      explanation: c.explanation || null,
      wrong_explanation_1: c.wrong_explanation_1 || null,
      wrong_explanation_2: c.wrong_explanation_2 || null,
      wrong_explanation_3: c.wrong_explanation_3 || null,
      hint: c.hint || null,
      repetitions: 0,
      interval: 0,
      ease_factor: 2.5,
      next_review: now,
    }))

    // Supabase has a limit of ~500 rows per insert — batch in chunks
    const BATCH_SIZE = 400
    for (let i = 0; i < cardsToInsert.length; i += BATCH_SIZE) {
      const batch = cardsToInsert.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from('cards').insert(batch)
      if (error) throw new Error(`Error Supabase al guardar tarjetas: ${error.message} (${error.code})`)
    }

    await fetchCards()
  }, [deckId, fetchCards])

  return { cards, loading, fetchCards, getDueCards, answerCard, addCards }
}

function buildOptions(card: Card): string[] {
  const options = [card.correct_answer]
  if (card.wrong_answer_1) options.push(card.wrong_answer_1)
  if (card.wrong_answer_2) options.push(card.wrong_answer_2)
  if (card.wrong_answer_3) options.push(card.wrong_answer_3)
  return shuffle(options)
}
