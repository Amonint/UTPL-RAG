export interface KnowledgeSearchDocumentInput {
  title?: string | null
  questionText?: string | null
  answerText?: string | null
  synonyms?: string[] | null
  phrases?: string[] | null
  searchForms?: string[] | null
  elementName?: string | null
  subcategoryName?: string | null
  categoryName?: string | null
}

function safe(value: string | null | undefined): string {
  return (value ?? '').trim()
}

export function parseJsonArrayStrings(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => String(item).trim()).filter(Boolean)
  } catch {
    return []
  }
}

export function buildKnowledgeSearchDocumentText(input: KnowledgeSearchDocumentInput): string {
  const title = safe(input.title)
  const question = safe(input.questionText)
  const answer = safe(input.answerText)
  const synonyms = (input.synonyms ?? []).map((item) => safe(item)).filter(Boolean)
  const triggerPhrases = [
    ...(input.phrases ?? []).map((item) => safe(item)).filter(Boolean),
    ...(input.searchForms ?? []).map((item) => safe(item)).filter(Boolean),
  ]

  return [
    title,
    question,
    answer,
    ...synonyms,
    ...triggerPhrases,
    safe(input.elementName),
    safe(input.subcategoryName),
    safe(input.categoryName),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}
