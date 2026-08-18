import type { PoolClient } from 'pg'

import { KNOWLEDGE_SEARCH_DOCUMENT_EXPR } from '@/lib/db/knowledge-search-sql'
import { dbQuery } from '@/lib/db/postgres'
import { dbQueryClient } from '@/lib/db/transaction'

import { isKnowledgeSearchDocumentColumnReady } from './knowledge-search-sql'

const REFRESH_ONE_SQL = `
  with latest_versions as (
    select distinct on (v.knowledge_item_id)
      v.knowledge_item_id,
      v.question_text,
      v.answer_text,
      v.synonyms_json,
      v.phrases_json,
      v.search_forms_json
    from knowledge_item_versions v
    where v.knowledge_item_id = $1::uuid
    order by v.knowledge_item_id, v.version_number desc
  ),
  doc as (
    select
      ki.id as knowledge_item_id,
      ${KNOWLEDGE_SEARCH_DOCUMENT_EXPR} as search_document
    from knowledge_items ki
    join kb_elements ke on ke.id = ki.kb_element_id
    join kb_subcategories ks on ks.id = ke.kb_subcategory_id
    join kb_categories kc on kc.id = ks.kb_category_id
    left join latest_versions lv on lv.knowledge_item_id = ki.id
    where ki.id = $1::uuid
  )
  update knowledge_items ki
  set search_document = doc.search_document
  from doc
  where ki.id = doc.knowledge_item_id
`

export async function refreshKnowledgeItemSearchDocument(
  client: PoolClient,
  itemId: string,
): Promise<void> {
  // Use the transaction client — dbQuery() on the shared pool deadlocks when max=1.
  const ready = await isKnowledgeSearchDocumentColumnReady((text, values) =>
    dbQueryClient(client, text, values ?? []),
  )
  if (!ready) return
  await dbQueryClient(client, REFRESH_ONE_SQL, [itemId])
}

export async function refreshKnowledgeItemSearchDocumentById(itemId: string): Promise<void> {
  const ready = await isKnowledgeSearchDocumentColumnReady(dbQuery)
  if (!ready) return
  await dbQuery(REFRESH_ONE_SQL, [itemId])
}
