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
  getBody: (prompt: string) => object
  parseResponse: (data: unknown) => string
}

// Proveedores de IA gratuitos
const PROVIDERS: Record<string, AIProvider> = {
  groq: {
    name: 'Groq (Gratis)',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    getHeaders: (apiKey) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    }),
    getBody: (prompt) => ({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 4000,
    }),
    parseResponse: (data: any) => data.choices?.[0]?.message?.content || '',
  },
  openai: {
    name: 'OpenAI',
    url: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    getHeaders: (apiKey) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    }),
    getBody: (prompt) => ({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 4000,
    }),
    parseResponse: (data: any) => data.choices?.[0]?.message?.content || '',
  },
  openrouter: {
    name: 'OpenRouter (Multi-modelo)',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'qwen/qwen-2.5-72b-instruct:free',
    getHeaders: (apiKey) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    }),
    getBody: (prompt) => ({
      model: 'qwen/qwen-2.5-72b-instruct:free',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 4000,
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
  providerKey: AIProviderKey = 'groq',
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
  providerKey: AIProviderKey = 'groq',
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

  const response = await fetch(provider.url, {
    method: 'POST',
    headers: provider.getHeaders(apiKey),
    body: JSON.stringify(provider.getBody(prompt)),
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

  const response = await fetch(provider.url, {
    method: 'POST',
    headers: provider.getHeaders(apiKey),
    body: JSON.stringify(provider.getBody(prompt)),
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
  // Remove markdown code blocks if present
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```$/, '')
  }
  // Find JSON array in response
  const start = jsonStr.indexOf('[')
  const end = jsonStr.lastIndexOf(']')
  if (start !== -1 && end !== -1) {
    jsonStr = jsonStr.substring(start, end + 1)
  }

  try {
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
  providerKey: AIProviderKey = 'groq',
): Promise<DistractorResult> {
  const provider = PROVIDERS[providerKey]
  if (!provider) throw new Error(`Proveedor no soportado: ${providerKey}`)

  const prompt = `Eres un experto en evaluación educativa. Dado el siguiente par pregunta-respuesta, genera exactamente 3 respuestas incorrectas MUY CONVINCENTES que parezcan correctas pero tengan un matiz sutil que las hace incorrectas. También genera explicaciones detalladas y una pista.

PREGUNTA: ${question}
RESPUESTA CORRECTA: ${correctAnswer}

REGLAS CRÍTICAS para los distractores:
- Deben ser PLAUSIBLES y del mismo dominio que la respuesta correcta
- Deben tener un error SUTIL (no obvio): una palabra cambiada, una inversión de concepto, una confusión entre términos similares
- NO deben ser completamente inventados ni absurdos
- Deben tener longitud similar a la respuesta correcta
- El estudiante debe necesitar conocimiento real para descartarlos

REGLAS para las explicaciones:
- "explanation": explica POR QUÉ la respuesta correcta es correcta (2-3 frases)
- "wrong_explanation_1/2/3": explica POR QUÉ ESA opción específica está mal y qué error conceptual representa (1-2 frases cada una)
- "hint": pista que ayude sin revelar la respuesta (1 frase)

Responde SOLO con JSON válido, sin texto adicional ni markdown:
{"wrong_answer_1":"...","wrong_answer_2":"...","wrong_answer_3":"...","explanation":"...","wrong_explanation_1":"...","wrong_explanation_2":"...","wrong_explanation_3":"...","hint":"..."}`

  const response = await fetch(provider.url, {
    method: 'POST',
    headers: provider.getHeaders(apiKey),
    body: JSON.stringify({
      ...provider.getBody(prompt),
      max_tokens: 1000,
      temperature: 0.8,
    }),
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
