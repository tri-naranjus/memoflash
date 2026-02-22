import type { Card } from '../types'

export interface DistractorResult {
  wrong_answer_1: string
  wrong_answer_2: string
  wrong_answer_3: string
  explanation: string       // por qué la correcta es correcta
  wrong_explanation_1: string  // por qué la opción 1 está mal
  wrong_explanation_2: string  // por qué la opción 2 está mal
  wrong_explanation_3: string  // por qué la opción 3 está mal
  hint: string
}

interface GeneratedQuestion {
  question: string
  correct_answer: string
  wrong_answer_1: string
  wrong_answer_2: string
  wrong_answer_3: string
  explanation: string
  hint: string
}

interface AIProvider {
  name: string
  url: string
  model: string
  getHeaders: (apiKey: string) => Record<string, string>
  getBody: (prompt: string, maxTokens?: number, temperature?: number) => object
  getUrl: (apiKey: string) => string
  parseResponse: (data: unknown) => string
}

// Proveedores de IA gratuitos
const PROVIDERS: Record<string, AIProvider> = {
  google: {
    name: 'Google AI (Gemini)',
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    model: 'gemini-2.5-flash',
    getUrl: (apiKey) => `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    getHeaders: (_apiKey) => ({
      'Content-Type': 'application/json',
    }),
    getBody: (prompt, _maxTokens = 4000, temperature = 0.7) => ({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: _maxTokens,
        responseMimeType: 'application/json',
      },
    }),
    parseResponse: (data: any) => {
      const parts = data.candidates?.[0]?.content?.parts || []
      // Gemini 2.5 thinking models may include thought parts before the actual response
      const textPart = parts.find((p: any) => p.text && !p.thought) || parts[parts.length - 1]
      return textPart?.text || ''
    },
  },
  openai: {
    name: 'OpenAI',
    url: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    getUrl: (_apiKey) => 'https://api.openai.com/v1/chat/completions',
    getHeaders: (apiKey) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    }),
    getBody: (prompt, maxTokens = 4000, temperature = 0.7) => ({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: maxTokens,
    }),
    parseResponse: (data: any) => data.choices?.[0]?.message?.content || '',
  },
  openrouter: {
    name: 'OpenRouter (Multi-modelo)',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'qwen/qwen-2.5-72b-instruct:free',
    getUrl: (_apiKey) => 'https://openrouter.ai/api/v1/chat/completions',
    getHeaders: (apiKey) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    }),
    getBody: (prompt, maxTokens = 4000, temperature = 0.7) => ({
      model: 'qwen/qwen-2.5-72b-instruct:free',
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: maxTokens,
    }),
    parseResponse: (data: any) => data.choices?.[0]?.message?.content || '',
  },
}

export type AIProviderKey = keyof typeof PROVIDERS
export const AI_PROVIDERS = PROVIDERS

export function getProviderInfo() {
  return Object.entries(PROVIDERS).map(([key, p]) => ({
    key,
    name: p.name,
    model: p.model,
  }))
}

/**
 * Generate MCQ questions from text content using AI
 */
export async function generateQuestionsFromText(
  text: string,
  numQuestions: number,
  apiKey: string,
  providerKey: AIProviderKey = 'google',
  onProgress?: (msg: string) => void,
): Promise<Partial<Card>[]> {
  const provider = PROVIDERS[providerKey]
  if (!provider) throw new Error(`Proveedor no soportado: ${providerKey}`)

  const maxChunkSize = 5000
  const chunks = splitIntoChunks(text, maxChunkSize)
  const questionsPerChunk = Math.ceil(numQuestions / chunks.length)

  const allCards: Partial<Card>[] = []

  for (let i = 0; i < chunks.length; i++) {
    if (allCards.length >= numQuestions) break

    const remaining = numQuestions - allCards.length
    const toGenerate = Math.min(questionsPerChunk, remaining)

    onProgress?.(`Generando preguntas (bloque ${i + 1}/${chunks.length})...`)

    const cards = await callAI(chunks[i], toGenerate, apiKey, provider)
    allCards.push(...cards)
  }

  return allCards.slice(0, numQuestions)
}

/**
 * Generate MCQ from Anki Q&A pairs (generate distractors)
 */
export async function generateDistractorsForAnki(
  text: string,
  apiKey: string,
  providerKey: AIProviderKey = 'google',
  onProgress?: (msg: string) => void,
): Promise<Partial<Card>[]> {
  const provider = PROVIDERS[providerKey]
  if (!provider) throw new Error(`Proveedor no soportado: ${providerKey}`)

  const chunks = splitIntoChunks(text, 5000)
  const allCards: Partial<Card>[] = []

  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(`Procesando lote ${i + 1}/${chunks.length}...`)
    const cards = await callAIAnki(chunks[i], apiKey, provider)
    allCards.push(...cards)
  }

  return allCards
}

async function callAI(
  text: string,
  numQuestions: number,
  apiKey: string,
  provider: AIProvider,
): Promise<Partial<Card>[]> {
  const prompt = `Eres un experto creador de exámenes tipo test. A partir del siguiente texto educativo, genera exactamente ${numQuestions} preguntas tipo test de opción múltiple (MCQ).

REGLAS ESTRICTAS:
- Cada pregunta debe tener 4 opciones: 1 correcta y 3 incorrectas
- Las respuestas incorrectas deben ser REALISTAS y plausibles
- Incluye una explicación breve de por qué la respuesta correcta es correcta
- Incluye una pista sutil que ayude sin dar la respuesta
- Las preguntas deben cubrir los conceptos más importantes
- Idioma: ESPAÑOL
- Responde SOLO con JSON válido, sin texto adicional ni markdown

FORMATO JSON exacto:
[{"question":"texto","correct_answer":"correcta","wrong_answer_1":"inc1","wrong_answer_2":"inc2","wrong_answer_3":"inc3","explanation":"explicación","hint":"pista"}]

TEXTO:
${text}`

  const response = await fetch(provider.getUrl(apiKey), {
    method: 'POST',
    headers: provider.getHeaders(apiKey),
    body: JSON.stringify(provider.getBody(prompt, 8000, 0.7)),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const msg = (err as any)?.error?.message || response.statusText
    throw new Error(`Error ${provider.name}: ${msg}`)
  }

  const data = await response.json()
  const content = provider.parseResponse(data)
  return parseAIResponse(content)
}

async function callAIAnki(
  text: string,
  apiKey: string,
  provider: AIProvider,
): Promise<Partial<Card>[]> {
  const prompt = `Eres un experto creador de exámenes. Te doy pares pregunta-respuesta de tarjetas Anki. Para CADA par, genera 3 respuestas incorrectas realistas, una explicación y una pista.

REGLAS ESTRICTAS:
- Los distractores deben ser PLAUSIBLES pero incorrectos
- Explicación breve y clara
- Pista que ayude sin dar la respuesta
- Idioma: ESPAÑOL
- Responde SOLO con JSON válido, sin texto adicional ni markdown

FORMATO JSON exacto:
[{"question":"pregunta","correct_answer":"correcta","wrong_answer_1":"inc1","wrong_answer_2":"inc2","wrong_answer_3":"inc3","explanation":"explicación","hint":"pista"}]

TARJETAS:
${text}`

  const response = await fetch(provider.getUrl(apiKey), {
    method: 'POST',
    headers: provider.getHeaders(apiKey),
    body: JSON.stringify(provider.getBody(prompt, 8000, 0.7)),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const msg = (err as any)?.error?.message || response.statusText
    throw new Error(`Error ${provider.name}: ${msg}`)
  }

  const data = await response.json()
  const content = provider.parseResponse(data)
  return parseAIResponse(content)
}

function parseAIResponse(content: string): Partial<Card>[] {
  let jsonStr = content.trim()
  // Remove markdown code blocks (handle ```json ... ``` or ``` ... ```)
  jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?\s*```\s*$/i, '')
  // Find JSON array in response (skip any text before/after)
  const start = jsonStr.indexOf('[')
  const end = jsonStr.lastIndexOf(']')
  if (start !== -1 && end !== -1) {
    jsonStr = jsonStr.substring(start, end + 1)
  }

  try {
    console.debug('[AI] content length:', jsonStr.length, 'starts:', jsonStr.substring(0, 50))
    const parsed: GeneratedQuestion[] = JSON.parse(jsonStr)
    if (!Array.isArray(parsed)) throw new Error('Not an array')

    return parsed.map(q => ({
      question: q.question,
      correct_answer: q.correct_answer,
      wrong_answer_1: q.wrong_answer_1,
      wrong_answer_2: q.wrong_answer_2,
      wrong_answer_3: q.wrong_answer_3,
      explanation: q.explanation || null,
      hint: q.hint || null,
    }))
  } catch {
    console.error('Failed to parse AI response:', content.substring(0, 500))
    throw new Error('Error al parsear la respuesta de la IA. Inténtalo de nuevo.')
  }
}

/**
 * Generate 3 convincing distractors + explanations for a single Q&A card at study time
 * Used in StudySession to generate wrong answers on-the-fly with AI
 */
export async function generateDistractorsForCard(
  question: string,
  correctAnswer: string,
  apiKey: string,
  providerKey: AIProviderKey = 'google',
): Promise<DistractorResult> {
  const provider = PROVIDERS[providerKey]
  if (!provider) throw new Error(`Proveedor no soportado: ${providerKey}`)

  const prompt = `Genera 3 distractores para esta tarjeta de estudio. Sé BREVE en todas las respuestas (máximo 15 palabras cada campo).

PREGUNTA: ${question}
RESPUESTA CORRECTA: ${correctAnswer}

Reglas:
- Distractores plausibles pero incorrectos, error sutil
- explanation: 1 frase corta explicando la correcta
- wrong_explanation_1/2/3: 1 frase corta por qué está mal
- hint: 1 frase pista sin revelar la respuesta

Responde SOLO con este JSON exacto sin texto adicional:
{"wrong_answer_1":"...","wrong_answer_2":"...","wrong_answer_3":"...","explanation":"...","wrong_explanation_1":"...","wrong_explanation_2":"...","wrong_explanation_3":"...","hint":"..."}`

  const response = await fetch(provider.getUrl(apiKey), {
    method: 'POST',
    headers: provider.getHeaders(apiKey),
    body: JSON.stringify(provider.getBody(prompt, 3000, 0.8)),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const msg = (err as any)?.error?.message || response.statusText
    throw new Error(`Error ${provider.name}: ${msg}`)
  }

  const data = await response.json()
  const content = provider.parseResponse(data)

  // Parse JSON response
  let jsonStr = content.trim()
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```$/, '')
  }
  const start = jsonStr.indexOf('{')
  const end = jsonStr.lastIndexOf('}')
  if (start !== -1 && end !== -1) {
    jsonStr = jsonStr.substring(start, end + 1)
  }

  try {
    const parsed = JSON.parse(jsonStr) as DistractorResult
    if (!parsed.wrong_answer_1) throw new Error('Respuesta incompleta')
    return parsed
  } catch {
    console.error('Failed to parse distractor response:', content.substring(0, 500))
    throw new Error('Error al generar distractores con IA. Inténtalo de nuevo.')
  }
}

function splitIntoChunks(text: string, maxSize: number): string[] {
  if (text.length <= maxSize) return [text]

  const chunks: string[] = []
  const paragraphs = text.split(/\n\n+/)
  let current = ''

  for (const para of paragraphs) {
    if ((current + '\n\n' + para).length > maxSize && current.length > 0) {
      chunks.push(current.trim())
      current = para
    } else {
      current = current ? current + '\n\n' + para : para
    }
  }

  if (current.trim()) chunks.push(current.trim())
  return chunks.length > 0 ? chunks : [text.substring(0, maxSize)]
}
