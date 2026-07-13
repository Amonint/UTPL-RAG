/** Gemini text-embedding-004 output size (Neon pgvector column must match). */
export const SEARCH_EMBEDDING_DIMENSIONS = 768

export const SEARCH_EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL?.trim() || 'gemini-embedding-001'

/** Cosine distance threshold — lower is more similar (pgvector `<=>`). */
export const SEARCH_VECTOR_MAX_DISTANCE = Number(process.env.SEARCH_VECTOR_MAX_DISTANCE || '0.55')

export function searchFtsWeight(): number {
  const semantic = searchSemanticWeight()
  return Math.max(0, Math.min(1, 1 - semantic))
}

export function searchSemanticWeight(): number {
  const raw = Number(process.env.SEARCH_SEMANTIC_WEIGHT ?? '0.4')
  if (!Number.isFinite(raw)) return 0.4
  return Math.max(0, Math.min(0.85, raw))
}

export function isHybridSearchEnabled(): boolean {
  return process.env.SEARCH_HYBRID_ENABLED !== 'false'
}

export function vectorLiteral(values: number[]): string {
  return `[${values.map((v) => Number(v).toFixed(8)).join(',')}]`
}
