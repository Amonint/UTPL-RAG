import type { RetrievalChunk } from '@/lib/ingest/chunking'

export function verifyAnswerSupport(input: {
  answer: string
  selectedServiceId: string
  evidence: RetrievalChunk[]
}): { ok: true } | { ok: false; reason: string } {
  const hasJson = input.evidence.some(
    (chunk) => chunk.sourceKind === 'json' && chunk.serviceId === input.selectedServiceId,
  )
  if (!hasJson) {
    return { ok: false, reason: 'missing same-service evidence' }
  }
  return { ok: true }
}
