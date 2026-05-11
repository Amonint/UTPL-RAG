export type ChunkSourceKind = 'json' | 'pdf'

export interface RetrievalChunk {
  chunkId: string
  serviceId: string
  sourceKind: ChunkSourceKind
  text: string
  metadata: Record<string, unknown>
  pdfFilename?: string
  pdfUrlOriginal?: string
}
