import type { RetrievalChunk } from '@/lib/ingest/chunking'

function countQueryMatches(query: string, text: string) {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)

  const haystack = text.toLowerCase()

  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0)
}

export function rankEvidenceForService(input: {
  query: string
  serviceId: string
  chunks: RetrievalChunk[]
  allowPdf?: boolean
}) {
  const sameService = input.chunks.filter((chunk) => chunk.serviceId === input.serviceId)
  const jsonChunks = sameService.filter((chunk) => chunk.sourceKind === 'json')

  if (!input.allowPdf) {
    return jsonChunks
  }

  const pdfChunks = sameService
    .filter((chunk) => chunk.sourceKind === 'pdf')
    .map((chunk) => ({ chunk, score: countQueryMatches(input.query, chunk.text) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((item) => item.chunk)

  return [...jsonChunks, ...pdfChunks]
}
