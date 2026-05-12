import fs from 'node:fs'
import path from 'node:path'

import type { RetrievalChunk } from '@/lib/ingest/chunking'
import type { PdfRef } from '@/lib/types'

export function filterPdfRefsWithLocalFiles(refs: PdfRef[]): PdfRef[] {
  return refs.filter((ref) => {
    const abs = path.isAbsolute(ref.localPath)
      ? ref.localPath
      : path.join(process.cwd(), ref.localPath)
    try {
      return fs.existsSync(abs)
    } catch {
      return false
    }
  })
}

export function buildNativePdfUsedSources(
  serviceId: string,
  jsonEvidence: RetrievalChunk[],
  pdfRefs: PdfRef[],
): RetrievalChunk[] {
  const pdfChunks: RetrievalChunk[] = pdfRefs.map((ref, index) => ({
    chunkId: `${serviceId}::native-pdf::${index}`,
    serviceId,
    sourceKind: 'pdf',
    text: `${ref.label}\n${ref.url}`,
    metadata: { sourcePath: ref.sourcePath, pestana: ref.pestana },
    pdfUrlOriginal: ref.url,
  }))
  return [...jsonEvidence, ...pdfChunks]
}
