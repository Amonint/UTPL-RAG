/** Metadatos de documento en `knowledge_items.review_policy` hasta columna dedicada. */
export type AdminDocumentMeta = {
  periodLabel?: string
}

const META_PREFIX = 'admin_doc_meta:v1:'

export function encodeDocumentMeta(meta: AdminDocumentMeta): string | null {
  const periodLabel = meta.periodLabel?.trim()
  if (!periodLabel) return null
  return `${META_PREFIX}${JSON.stringify({ periodLabel })}`
}

export function decodeDocumentMeta(reviewPolicy: string | null | undefined): AdminDocumentMeta {
  if (!reviewPolicy?.startsWith(META_PREFIX)) {
    return {}
  }
  try {
    const parsed = JSON.parse(reviewPolicy.slice(META_PREFIX.length)) as AdminDocumentMeta
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}
