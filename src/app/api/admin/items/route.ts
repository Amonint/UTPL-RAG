import { createItemSchema, listItemsQuerySchema } from '@/lib/admin/validation'
import { assertAdminEnabled } from '@/lib/admin/route-guard'
import { createKnowledgeItem, listAdminKnowledgeItems } from '@/lib/db/admin/knowledge-item-repository'
import { scheduleSearchReindexIfEnabled } from '@/lib/db/knowledge-search-index'
import { withDbTransaction } from '@/lib/db/transaction'

export async function GET(request: Request) {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    const url = new URL(request.url)
    const query = listItemsQuerySchema.parse({
      q: url.searchParams.get('q') ?? undefined,
      domainCode: url.searchParams.get('domainCode') ?? undefined,
      categorySlug: url.searchParams.get('categorySlug') ?? undefined,
      editorialStatus: url.searchParams.get('editorialStatus') ?? undefined,
      sectionCode: url.searchParams.get('sectionCode') ?? undefined,
      profileTypeCode: url.searchParams.get('profileTypeCode') ?? undefined,
      studentTypeCode: url.searchParams.get('studentTypeCode') ?? undefined,
      periodLabel: url.searchParams.get('periodLabel') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
      offset: url.searchParams.get('offset') ?? undefined,
    })
    const result = await listAdminKnowledgeItems(query)
    return Response.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list items'
    return Response.json({ error: message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    const body = createItemSchema.parse(await request.json())
    const id = await withDbTransaction((client) => createKnowledgeItem(client, body))
    scheduleSearchReindexIfEnabled(id)
    return Response.json({ id }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create item'
    const status = message.includes('unique') ? 409 : 400
    return Response.json({ error: message }, { status })
  }
}
