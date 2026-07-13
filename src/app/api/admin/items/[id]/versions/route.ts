import { createVersionSchema } from '@/lib/admin/validation'
import { assertAdminEnabled } from '@/lib/admin/route-guard'
import {
  createKnowledgeItemVersion,
  getAdminKnowledgeItemById,
} from '@/lib/db/admin/knowledge-item-repository'
import { scheduleSearchReindexIfEnabled } from '@/lib/db/knowledge-search-index'
import { withDbTransaction } from '@/lib/db/transaction'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    const { id } = await context.params
    const body = createVersionSchema.parse(await request.json())
    const version = await withDbTransaction((client) => createKnowledgeItemVersion(client, id, body))
    scheduleSearchReindexIfEnabled(id)
    const item = await getAdminKnowledgeItemById(id)
    return Response.json({ version, item })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create version'
    return Response.json({ error: message }, { status: 400 })
  }
}
