import { GoogleGenAI } from '@google/genai'

import {
  SEARCH_EMBEDDING_DIMENSIONS,
  SEARCH_EMBEDDING_MODEL,
} from '@/lib/search/hybrid-search-config'

let client: GoogleGenAI | null = null

function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) return null
  if (!client) client = new GoogleGenAI({ apiKey })
  return client
}

export function isEmbeddingProviderConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim())
}

function warnEmbeddingFailure(reason: string): void {
  console.warn(`[search-embeddings] ${reason} (model=${SEARCH_EMBEDDING_MODEL})`)
}

export async function embedSearchText(text: string): Promise<number[] | null> {
  const normalized = text.trim()
  if (!normalized) return null

  const ai = getClient()
  if (!ai) return null

  let response: Awaited<ReturnType<typeof ai.models.embedContent>>
  try {
    response = await ai.models.embedContent({
      model: SEARCH_EMBEDDING_MODEL,
      contents: normalized,
      config: { outputDimensionality: SEARCH_EMBEDDING_DIMENSIONS },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    warnEmbeddingFailure(`embedContent failed: ${message}`)
    return null
  }

  const values = response.embeddings?.[0]?.values
  if (!values?.length) return null
  if (values.length !== SEARCH_EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Unexpected embedding size ${values.length}; expected ${SEARCH_EMBEDDING_DIMENSIONS}`,
    )
  }
  return values
}

export async function embedSearchTexts(texts: string[]): Promise<Array<number[] | null>> {
  const ai = getClient()
  if (!ai) return texts.map(() => null)

  const cleaned = texts.map((t) => t.trim()).filter(Boolean)
  if (cleaned.length === 0) return texts.map(() => null)

  let response: Awaited<ReturnType<typeof ai.models.embedContent>>
  try {
    response = await ai.models.embedContent({
      model: SEARCH_EMBEDDING_MODEL,
      contents: cleaned,
      config: { outputDimensionality: SEARCH_EMBEDDING_DIMENSIONS },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    warnEmbeddingFailure(`embedContent batch failed: ${message}`)
    return texts.map(() => null)
  }

  const embeddings = response.embeddings ?? []
  const out: Array<number[] | null> = []
  let cursor = 0
  for (const text of texts) {
    if (!text.trim()) {
      out.push(null)
      continue
    }
    const values = embeddings[cursor]?.values ?? null
    cursor += 1
    if (!values?.length) {
      out.push(null)
      continue
    }
    if (values.length !== SEARCH_EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Unexpected embedding size ${values.length}; expected ${SEARCH_EMBEDDING_DIMENSIONS}`,
      )
    }
    out.push(values)
  }
  return out
}
