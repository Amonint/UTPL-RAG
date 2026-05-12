import type { RetrievalChunk } from '@/lib/ingest/chunking'
import type { PdfRef } from '@/lib/types'

function evidenceDigest(evidence: RetrievalChunk[], maxChars: number) {
  return evidence
    .map((chunk) => chunk.text)
    .join('\n\n')
    .slice(0, maxChars)
}

export async function generateGroundedAnswer(question: string, evidence: RetrievalChunk[]) {
  const ctx = evidenceDigest(evidence, 14_000)
  return [
    `Consulta: ${question}`,
    '',
    'Información de referencia:',
    ctx,
    '',
    'Resumen: usa los datos anteriores como referencia oficial del trámite.',
  ].join('\n')
}

export async function generateGroundedAnswerWithNativePdfs(input: {
  question: string
  jsonChunk: RetrievalChunk
  pdfRefs: PdfRef[]
}) {
  const base = input.jsonChunk.text
  const lines = input.pdfRefs.map((ref) => `- ${ref.label}\n  ${ref.url}`)
  return [`Consulta: ${input.question}`, '', base, '', 'PDFs asociados:', ...lines].join('\n')
}
