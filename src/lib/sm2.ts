import type { SM2Result } from '../types'

/**
 * SM-2 Spaced Repetition Algorithm
 *
 * Quality scale:
 * 0 - Complete blackout
 * 1 - Incorrect, but upon seeing the answer, remembered
 * 2 - Incorrect, but the answer seemed easy to recall
 * 3 - Correct with serious difficulty
 * 4 - Correct with some hesitation
 * 5 - Perfect response
 */
export function calculateSM2(
  quality: number,
  repetitions: number,
  interval: number,
  easeFactor: number
): SM2Result {
  // Clamp quality between 0 and 5
  quality = Math.max(0, Math.min(5, quality))

  let newRepetitions = repetitions
  let newInterval = interval
  let newEaseFactor = easeFactor

  if (quality >= 3) {
    // Correct response
    if (newRepetitions === 0) {
      newInterval = 1
    } else if (newRepetitions === 1) {
      newInterval = 6
    } else {
      newInterval = Math.round(newInterval * newEaseFactor)
    }
    newRepetitions += 1
  } else {
    // Incorrect response - reset
    newRepetitions = 0
    newInterval = 1
  }

  // Update ease factor
  newEaseFactor = newEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))

  // Minimum ease factor is 1.3
  if (newEaseFactor < 1.3) {
    newEaseFactor = 1.3
  }

  // Calculate next review date
  const now = new Date()
  const nextReview = new Date(now.getTime() + newInterval * 24 * 60 * 60 * 1000)

  return {
    repetitions: newRepetitions,
    interval: newInterval,
    ease_factor: Math.round(newEaseFactor * 100) / 100,
    next_review: nextReview.toISOString(),
  }
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 */
export function shuffle<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
