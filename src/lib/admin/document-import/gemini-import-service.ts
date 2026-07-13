import { GoogleGenAI } from '@google/genai'
import { ZodError } from 'zod'

import { geminiImportResultSchema } from '@/lib/admin/validation'

type TaxonomyOption = {
  domainCode: string
  domainName: string
  categorySlug: string
  categoryName: string
  subcategorySlug: string
  subcategoryName: string
  elementSlug: string
  elementName: string
}

type ProfileTypeOption = {
  typeCode: string
  name: string
}

type StudentTypeOption = {
  code: string
  name: string
}

type CyclePeriodOption = {
  code: string
  name: string
}

type EditorialStatusOption = {
  code: string
  name: string
}

export type ImportCatalogSnapshot = {
  taxonomy: TaxonomyOption[]
  profileTypes: ProfileTypeOption[]
  studentTypes: StudentTypeOption[]
  cyclePeriods: CyclePeriodOption[]
  editorialStatuses: EditorialStatusOption[]
}

function stripMarkdownCodeFence(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('```')) return trimmed
  const firstBreak = trimmed.indexOf('\n')
  const lastFence = trimmed.lastIndexOf('```')
  if (firstBreak === -1 || lastFence <= firstBreak) return trimmed
  return trimmed.slice(firstBreak + 1, lastFence).trim()
}

function normalizeSectionCode(raw: unknown): 'faq' | 'general_info' | undefined {
  if (typeof raw !== 'string') return undefined
  const value = raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
  if (value === 'faq') return 'faq'
  if (
    value === 'general_info' ||
    value === 'generalinfo' ||
    value === 'informacion' ||
    value === 'información' ||
    value === 'information' ||
    value === 'info'
  ) {
    return 'general_info'
  }
  return undefined
}

function normalizeGeminiImportPayload(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input
  const root = input as { blocks?: unknown }
  if (!Array.isArray(root.blocks)) return input
  return {
    ...root,
    blocks: root.blocks.map((block) => {
      if (!block || typeof block !== 'object') return block
      const current = block as Record<string, unknown>
      const rawSection = current.sectionCode ?? current.section_code ?? current.section
      const normalized = normalizeSectionCode(rawSection)
      if (!normalized) return block
      return {
        ...current,
        sectionCode: normalized,
      }
    }),
  }
}

function buildPrompt(documentText: string, catalogs: ImportCatalogSnapshot): string {
  return [
    'Eres un clasificador documental para la base de conocimiento de asesores.',
    'Clasifica el contenido SOLO en dos secciones: faq o general_info.',
    'Tu respuesta DEBE ser JSON puro con esta forma: {"blocks":[...]}',
    'No incluyas markdown, comentarios ni texto adicional.',
    'Debes elegir taxonomy.domainCode, taxonomy.categorySlug, taxonomy.subcategorySlug y taxonomy.elementSlug SOLO de las opciones provistas.',
    'Debes elegir audience.profileTypeCode, audience.studentTypeCode y periodCode SOLO de las opciones provistas cuando apliquen.',
    'El estado editorial permitido se define por catálogo de estados; en este flujo se guarda siempre en review.',
    'Si no estás seguro, deja audience/periodCode vacíos u omitidos, pero no inventes valores.',
    'Para faq: llena title, questionText, answerText.',
    'Para general_info: llena title, subtitle opcional, answerText, periodCode opcional, validFrom/validTo (YYYY-MM-DD) cuando el documento tenga fechas claras.',
    '',
    '--- Opciones de taxonomía permitidas ---',
    JSON.stringify(catalogs.taxonomy),
    '',
    '--- Opciones de modalidad permitidas (profileTypeCode) ---',
    JSON.stringify(catalogs.profileTypes),
    '',
    '--- Opciones de tipo de estudiante permitidas (studentTypeCode) ---',
    JSON.stringify(catalogs.studentTypes),
    '',
    '--- Opciones de periodo permitidas (periodCode) ---',
    JSON.stringify(catalogs.cyclePeriods),
    '',
    '--- Opciones de estado editorial permitidas (editorialStatus) ---',
    JSON.stringify(catalogs.editorialStatuses),
    '',
    '--- Texto del documento ---',
    documentText,
  ].join('\n')
}

export async function classifyDocumentWithGemini(input: {
  documentText: string
  catalogs: ImportCatalogSnapshot
}) {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('Falta la variable de entorno GEMINI_API_KEY.')
  }
  const model =
    process.env.GEMINI_CHAT_MODEL?.trim() || process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash'
  const ai = new GoogleGenAI({ apiKey })
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: buildPrompt(input.documentText, input.catalogs) }] }],
  })
  const text = typeof response.text === 'string' ? response.text.trim() : ''
  if (!text) {
    throw new Error('Gemini no devolvió una respuesta utilizable para la importación.')
  }
  const rawJson = stripMarkdownCodeFence(text)
  let parsed: unknown
  try {
    parsed = JSON.parse(rawJson)
  } catch {
    throw new Error('Gemini devolvió un formato inválido. No se pudo parsear JSON.')
  }
  const normalizedPayload = normalizeGeminiImportPayload(parsed)
  try {
    return geminiImportResultSchema.parse(normalizedPayload)
  } catch (error) {
    if (error instanceof ZodError) {
      const sectionValues: string[] = []
      const root = normalizedPayload as { blocks?: unknown } | null
      if (root && Array.isArray(root.blocks)) {
        for (const block of root.blocks) {
          if (!block || typeof block !== 'object') continue
          const row = block as Record<string, unknown>
          const value = row.sectionCode ?? row.section_code ?? row.section
          sectionValues.push(typeof value === 'string' ? value : String(value))
        }
      }
      const compact = JSON.stringify(error.issues.slice(0, 3))
      throw new Error(
        `Respuesta de Gemini inválida (sectionCode). Valores recibidos: [${sectionValues.join(', ')}]. Detalle: ${compact}`,
      )
    }
    throw error
  }
}
