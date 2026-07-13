import {
  countItemsMissingEmbeddings,
  fetchPublishedItemIdsForEmbeddingBackfill,
} from '@/lib/db/knowledge-services'
import { refreshKnowledgeItemSearchIndexById } from '@/lib/db/knowledge-search-index'
import { isEmbeddingProviderConfigured } from '@/lib/search/embeddings/gemini-embeddings'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  if (process.env.SEARCH_REINDEX_ENABLED !== 'true') {
    return NextResponse.json(
      {
        error:
          'SEARCH_REINDEX_ENABLED must be true. Alternatively run: npm run db:backfill:search-embeddings',
      },
      { status: 403 },
    )
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { batchSize?: number }
    const batchSize = Math.min(Math.max(Number(body.batchSize) || 40, 1), 200)
    const ids = await fetchPublishedItemIdsForEmbeddingBackfill(batchSize)

    for (const id of ids) {
      await refreshKnowledgeItemSearchIndexById(id)
    }

    const remaining = await countItemsMissingEmbeddings()
    return NextResponse.json({
      processed: ids.length,
      remainingMissingEmbeddings: remaining,
      embeddingsConfigured: isEmbeddingProviderConfigured(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Search reindex failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
