/** SQL expression building the unified search document (ADR-0007). Uses lv, ke, ks, kc, ki aliases. */
export const KNOWLEDGE_SEARCH_DOCUMENT_EXPR = `
  lower(
    trim(
      both
      from
      concat_ws(
        ' ',
        nullif(trim(coalesce(ki.title, '')), ''),
        nullif(trim(coalesce(ki.review_policy, '')), ''),
        nullif(trim(coalesce(lv.question_text, '')), ''),
        nullif(trim(coalesce(lv.answer_text, '')), ''),
        nullif(
          (
            select string_agg(elem, ' ')
            from jsonb_array_elements_text(coalesce(lv.synonyms_json, '[]'::jsonb)) as elem
            where trim(elem) <> ''
          ),
          ''
        ),
        nullif(
          (
            select string_agg(elem, ' ')
            from jsonb_array_elements_text(coalesce(lv.phrases_json, '[]'::jsonb)) as elem
            where trim(elem) <> ''
          ),
          ''
        ),
        nullif(
          (
            select string_agg(elem, ' ')
            from jsonb_array_elements_text(coalesce(lv.search_forms_json, '[]'::jsonb)) as elem
            where trim(elem) <> ''
          ),
          ''
        ),
        nullif(trim(coalesce(ke.name, '')), ''),
        nullif(trim(coalesce(ks.name, '')), ''),
        nullif(trim(coalesce(kc.name, '')), '')
      )
    )
  )
`.trim()

export function knowledgeSearchTsvExpr(usePersistedColumn: boolean): string {
  if (usePersistedColumn) {
    return `coalesce(ki.search_tsv, to_tsvector('spanish', coalesce(ki.search_document, ${KNOWLEDGE_SEARCH_DOCUMENT_EXPR})))`
  }
  return `to_tsvector('spanish', ${KNOWLEDGE_SEARCH_DOCUMENT_EXPR})`
}

export function knowledgeSearchDocumentTextExpr(usePersistedColumn: boolean): string {
  if (usePersistedColumn) {
    return `coalesce(ki.search_document, ${KNOWLEDGE_SEARCH_DOCUMENT_EXPR})`
  }
  return KNOWLEDGE_SEARCH_DOCUMENT_EXPR
}

let searchDocumentColumnReadyCache: boolean | null = null
let searchEmbeddingColumnReadyCache: boolean | null = null
let pgTrgmReadyCache: boolean | null = null
let unaccentReadyCache: boolean | null = null

export async function isKnowledgeSearchDocumentColumnReady(
  dbQuery: (text: string, values?: ReadonlyArray<unknown>) => Promise<{ rows: Array<Record<string, boolean>> }>,
): Promise<boolean> {
  if (searchDocumentColumnReadyCache !== null) return searchDocumentColumnReadyCache
  const { rows } = await dbQuery(`
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'knowledge_items'
        and column_name = 'search_document'
    ) as ready
  `)
  searchDocumentColumnReadyCache = Boolean(rows[0]?.ready)
  return searchDocumentColumnReadyCache
}

export async function isKnowledgeSearchEmbeddingColumnReady(
  dbQuery: (text: string, values?: ReadonlyArray<unknown>) => Promise<{ rows: Array<Record<string, boolean>> }>,
): Promise<boolean> {
  if (searchEmbeddingColumnReadyCache !== null) return searchEmbeddingColumnReadyCache
  const { rows } = await dbQuery(`
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'knowledge_items'
        and column_name = 'search_embedding'
    ) as ready
  `)
  searchEmbeddingColumnReadyCache = Boolean(rows[0]?.ready)
  return searchEmbeddingColumnReadyCache
}

export async function isPgTrgmReady(
  dbQuery: (text: string, values?: ReadonlyArray<unknown>) => Promise<{ rows: Array<Record<string, boolean>> }>,
): Promise<boolean> {
  if (pgTrgmReadyCache !== null) return pgTrgmReadyCache
  const { rows } = await dbQuery(`
    select exists (
      select 1 from pg_extension where extname = 'pg_trgm'
    ) as ready
  `)
  pgTrgmReadyCache = Boolean(rows[0]?.ready)
  return pgTrgmReadyCache
}

export async function isUnaccentReady(
  dbQuery: (text: string, values?: ReadonlyArray<unknown>) => Promise<{ rows: Array<Record<string, boolean>> }>,
): Promise<boolean> {
  if (unaccentReadyCache !== null) return unaccentReadyCache
  const { rows } = await dbQuery(`
    select exists (
      select 1 from pg_extension where extname = 'unaccent'
    ) as ready
  `)
  unaccentReadyCache = Boolean(rows[0]?.ready)
  return unaccentReadyCache
}

export function normalizeSqlTextExpr(rawExpr: string, unaccentReady: boolean): string {
  if (unaccentReady) {
    return `lower(unaccent(coalesce(${rawExpr}, '')))`
  }
  return `lower(coalesce(${rawExpr}, ''))`
}

export function resetKnowledgeSearchColumnCacheForTests(): void {
  searchDocumentColumnReadyCache = null
  searchEmbeddingColumnReadyCache = null
  pgTrgmReadyCache = null
  unaccentReadyCache = null
}
