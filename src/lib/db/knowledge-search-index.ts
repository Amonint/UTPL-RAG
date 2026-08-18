import type { PoolClient } from 'pg'

import { dbQueryClient } from '@/lib/db/transaction'
import { embedSearchText } from '@/lib/search/embeddings/gemini-embeddings'
import { vectorLiteral } from '@/lib/search/hybrid-search-config'

import { isKnowledgeSearchEmbeddingColumnReady } from './knowledge-search-sql'
import { refreshKnowledgeItemSearchDocument } from './knowledge-search-document'

export async function refreshKnowledgeItemSearchEmbedding(
  client: PoolClient,
  itemId: string,
): Promise<void> {
  // Use the transaction client — dbQuery() on the shared pool deadlocks when max=1.
  const ready = await isKnowledgeSearchEmbeddingColumnReady((text, values) =>
    dbQueryClient(client, text, values ?? []),
  )
  if (!ready) return

  const { rows } = await dbQueryClient<{ search_document: string | null }>(
    client,
    `select search_document from knowledge_items where id = $1::uuid`,
    [itemId],
  )
  const searchDocument = rows[0]?.search_document?.trim()
  if (!searchDocument) {
    await dbQueryClient(
      client,
      `update knowledge_items set search_embedding = null where id = $1::uuid`,
      [itemId],
    )
    return
  }

  try {
    const embedding = await embedSearchText(searchDocument)
    if (!embedding) {
      await dbQueryClient(
        client,
        `update knowledge_items set search_embedding = null where id = $1::uuid`,
        [itemId],
      )
      return
    }

    await dbQueryClient(
      client,
      `update knowledge_items set search_embedding = $2::vector where id = $1::uuid`,
      [itemId, vectorLiteral(embedding)],
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`[search-index] embedding skipped for item ${itemId}: ${message}`)
    await dbQueryClient(
      client,
      `update knowledge_items set search_embedding = null where id = $1::uuid`,
      [itemId],
    )
  }
}

/** Rebuild FTS document + optional vector embedding for one item. */
export async function refreshKnowledgeItemSearchIndex(
  client: PoolClient,
  itemId: string,
): Promise<void> {
  await refreshKnowledgeItemSearchDocument(client, itemId)
  await refreshKnowledgeItemSearchEmbedding(client, itemId)
}

export async function refreshKnowledgeItemSearchIndexById(itemId: string): Promise<void> {
  const { getPool } = await import('./postgres-internal')
  const client = await getPool().connect()
  try {
    await refreshKnowledgeItemSearchIndex(client, itemId)
  } finally {
    client.release()
  }
}

/** Fire-and-forget reindex when SEARCH_REINDEX_ENABLED=true (after admin commit). */
export function scheduleSearchReindexIfEnabled(itemId: string): void {
  if (process.env.SEARCH_REINDEX_ENABLED !== 'true') return
  void refreshKnowledgeItemSearchIndexById(itemId).catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`[search-index] async reindex failed for ${itemId}: ${message}`)
  })
}
