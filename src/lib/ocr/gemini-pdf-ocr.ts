import { GoogleGenAI, createPartFromBase64, type Part } from '@google/genai'

// ponytail: use fastest model directly, fallback only if quota exhausted
const GEMINI_MODELS_FALLBACK = [
  'gemini-3.5-flash',      // Fastest, official recommendation for PDF
  'gemini-2.5-flash',      // Fallback: previous generation, similar speed
]

interface OcrExtractionItem {
  title: string
  question?: string
  answer?: string
  startDate?: string
  endDate?: string
  eventType?: string
  description?: string
  topic?: string
}

interface OcrExtractionResult {
  items: OcrExtractionItem[]
  success: boolean
  error?: string
  modelUsed?: string
  itemCount: number
}

interface GeminiPdfOcrOptions {
  maxPages?: number
  sectionType?: 'faq' | 'information' | 'calendar'
}

async function initializeGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY2
  if (!apiKey) {
    throw new Error('No GEMINI_API_KEY or GEMINI_API_KEY2 found in environment')
  }
  return new GoogleGenAI({ apiKey })
}

async function extractTextFromPdfWithModel(
  client: GoogleGenAI,
  modelId: string,
  pdfBase64: string,
  mimeType: string,
  maxPages: number,
  sectionType: string,
): Promise<string> {
  const systemPrompt = buildSystemPrompt(sectionType, maxPages)

  const parts: Part[] = [
    {
      text: systemPrompt,
    } as Part,
    createPartFromBase64(pdfBase64, mimeType),
  ]

  let response: Awaited<ReturnType<typeof client.models.generateContent>>
  try {
    response = await client.models.generateContent({
      model: modelId,
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    throw new Error(`Gemini API error: ${errMsg}`)
  }

  const text = typeof response.text === 'string' ? response.text.trim() : ''
  if (!text) {
    throw new Error('No text response from Gemini')
  }

  return text
}

function buildSystemPrompt(sectionType: string, maxPages: number): string {
  const basePrompt = `Extrae TODOS los items del PDF (hasta ${maxPages} páginas). Devuelve SOLO JSON válido, sin markdown ni explicaciones. Usa este schema EXACTO:`

  switch (sectionType) {
    case 'faq':
      return `${basePrompt}
{
  "items": [
    {
      "title": "string: pregunta/título corto",
      "topic": "string: categoría o tema",
      "question": "string: texto completo de la pregunta",
      "answer": "string: respuesta completa"
    }
  ]
}
REGLAS:
- Extrae TODAS las preguntas y respuestas
- JSON válido con estructura exacta
- No interpretes, devuelve contenido como está en PDF`

    case 'information':
      return `${basePrompt}
{
  "items": [
    {
      "title": "string: título de la sección",
      "topic": "string: tema principal",
      "answer": "string: contenido completo sin resumir"
    }
  ]
}
REGLAS:
- Extrae TODAS las secciones principales
- Organiza por temas
- No resumidas, contenido completo`

    case 'calendar':
      return `${basePrompt}
{
  "items": [
    {
      "title": "string: nombre evento/actividad",
      "topic": "string: categoría (Matrículas/Extraordinarias/Clases/Exámenes)",
      "startDate": "string: YYYY-MM-DD si existe, o vacío",
      "endDate": "string: YYYY-MM-DD si existe, o vacío",
      "eventType": "string: tipo (Ordinaria/Extraordinaria/Inicio)",
      "description": "string: fechas EXACTAS del PDF sin interpretar"
    }
  ]
}
REGLAS CRÍTICAS - NO INTERPRETES:
- Fechas: devuelve EXACTAMENTE como aparecen ("21 de mayo", "01 de octubre")
- startDate/endDate SOLO si es formato YYYY-MM-DD claro, sino vacío
- description: incluye texto de fecha literal del PDF
- No adivines ni rellenes información faltante
- Extrae TODOS los eventos del documento`

    default:
      return basePrompt
  }
}

async function tryExtractWithFallback(
  pdfBase64: string,
  mimeType: string,
  options: GeminiPdfOcrOptions,
): Promise<{ text: string; modelUsed: string }> {
  const client = await initializeGeminiClient()
  const maxPages = options.maxPages || 50
  const sectionType = options.sectionType || 'faq'

  let lastError: Error | null = null

  for (const modelId of GEMINI_MODELS_FALLBACK) {
    try {
      const text = await extractTextFromPdfWithModel(
        client,
        modelId,
        pdfBase64,
        mimeType,
        maxPages,
        sectionType,
      )
      return { text, modelUsed: modelId }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn(`OCR failed with ${modelId}:`, lastError.message)
    }
  }

  throw new Error(`OCR failed with all models. Last error: ${lastError?.message}`)
}

function parseJsonResponse(jsonText: string): Record<string, unknown> {
  console.log('[OCR] Raw Gemini response (first 500 chars):', jsonText.substring(0, 500))

  // ponytail: try direct parse first, then fallback to brace-balancing (more reliable than greedy regex)
  try {
    return JSON.parse(jsonText)
  } catch {
    console.warn('[OCR] Direct JSON parse failed, trying brace-balancing extraction')
  }

  let braceDepth = 0
  let jsonStart = jsonText.indexOf('{')
  if (jsonStart === -1) {
    throw new Error(`No JSON found in response. Got: ${jsonText.substring(0, 200)}`)
  }

  let jsonEnd = jsonStart
  for (let i = jsonStart; i < jsonText.length; i++) {
    if (jsonText[i] === '{') braceDepth++
    if (jsonText[i] === '}') {
      braceDepth--
      if (braceDepth === 0) {
        jsonEnd = i + 1
        break
      }
    }
  }

  if (braceDepth !== 0) {
    throw new Error(`Unbalanced braces. Got: ${jsonText.substring(jsonStart, Math.min(jsonEnd + 50, jsonText.length))}`)
  }

  const jsonStr = jsonText.substring(jsonStart, jsonEnd)
  console.log('[OCR] Extracted JSON (first 300 chars):', jsonStr.substring(0, 300))

  try {
    return JSON.parse(jsonStr)
  } catch (err) {
    console.error('[OCR] Parse error:', err instanceof Error ? err.message : String(err))
    throw new Error(`JSON parse error: ${err instanceof Error ? err.message : String(err)}. Got: ${jsonStr.substring(0, 300)}`)
  }
}

function normalizeItems(parsed: Record<string, unknown>): OcrExtractionItem[] {
  if (Array.isArray(parsed.items)) {
    return parsed.items.map((item: any) => ({
      title: String(item.title || ''),
      topic: item.topic ? String(item.topic) : undefined,
      question: item.question ? String(item.question) : undefined,
      answer: item.answer ? String(item.answer) : undefined,
      startDate: item.startDate ? String(item.startDate) : undefined,
      endDate: item.endDate ? String(item.endDate) : undefined,
      eventType: item.eventType ? String(item.eventType) : undefined,
      description: item.description ? String(item.description) : undefined,
    }))
  }
  return []
}

export async function extractPdfContent(
  pdfFile: File,
  options: GeminiPdfOcrOptions = {},
): Promise<OcrExtractionResult> {
  try {
    // Validate file
    if (!pdfFile.type.includes('pdf')) {
      return {
        success: false,
        error: 'El archivo debe ser un PDF',
        items: [],
        itemCount: 0,
      }
    }

    if (pdfFile.size > 50 * 1024 * 1024) {
      // 50MB limit
      return {
        success: false,
        error: 'PDF demasiado grande (máximo 50MB)',
        items: [],
        itemCount: 0,
      }
    }

    // Convert to base64 (works in browser and Node)
    const arrayBuffer = await pdfFile.arrayBuffer()
    const pdfBase64 =
      typeof Buffer !== 'undefined'
        ? Buffer.from(arrayBuffer).toString('base64')
        : btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

    // Extract with fallback
    console.log('[OCR] Starting extraction with model fallback...')
    const { text, modelUsed } = await tryExtractWithFallback(
      pdfBase64,
      'application/pdf',
      options,
    )
    console.log('[OCR] Extraction successful. Model used:', modelUsed)

    // Parse JSON response
    console.log('[OCR] Parsing JSON response...')
    const parsed = parseJsonResponse(text)

    // Normalize items from array
    const items = normalizeItems(parsed)
    console.log(`[OCR] Extracted ${items.length} items`)

    if (items.length === 0) {
      return {
        success: false,
        error: 'No items extracted from PDF',
        items: [],
        itemCount: 0,
      }
    }

    return {
      items,
      success: true,
      modelUsed,
      itemCount: items.length,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      error: message,
      items: [],
      itemCount: 0,
    }
  }
}

export type { OcrExtractionResult, OcrExtractionItem, GeminiPdfOcrOptions }
