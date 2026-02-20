export interface Deck {
  id: string
  user_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
  card_count?: number
  due_count?: number
}

export interface Card {
  id: string
  deck_id: string
  question: string
  correct_answer: string
  wrong_answer_1: string | null
  wrong_answer_2: string | null
  wrong_answer_3: string | null
  explanation: string | null
  wrong_explanation_1: string | null
  wrong_explanation_2: string | null
  wrong_explanation_3: string | null
  hint: string | null
  repetitions: number
  interval: number
  ease_factor: number
  next_review: string
  created_at: string
  updated_at: string
}

export interface CardReview {
  id: string
  card_id: string
  user_id: string
  quality: number
  response_time_ms: number
  created_at: string
}

export interface StudyCard extends Card {
  options: string[]                   // shuffled [correct + wrongs]
  retries: number
  // AI-generated at study time (when card has no wrong answers stored)
  aiWrong1?: string
  aiWrong2?: string
  aiWrong3?: string
  aiExplanation?: string              // why correct is correct
  aiWrongExp1?: string                // why option was wrong
  aiWrongExp2?: string
  aiWrongExp3?: string
  aiHint?: string
  // map from wrong answer text → its explanation
  wrongExplanations?: Record<string, string>
}

export interface SM2Result {
  repetitions: number
  interval: number
  ease_factor: number
  next_review: string
}

export type View = 'decks' | 'deck-detail' | 'study'
