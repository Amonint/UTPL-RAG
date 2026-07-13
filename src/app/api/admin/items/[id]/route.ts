import { patchItemSchema } from '@/lib/admin/validation'
import { assertAdminEnabled } from '@/lib/admin/route-guard'
import {
  deleteKnowledgeItem,
  getAdminKnowledgeItemById,
  patchKnowledgeItem,
  replaceItemAudiences,
} from '@/lib/db/admin/knowledge-item-repository'
import { scheduleSearchReindexIfEnabled } from '@/lib/db/knowledge-search-index'
import { withDbTransaction } from '@/lib/db/transaction'
import { audienceInputSchema } from '@/lib/admin/validation'
import { z } from 'zod'

const patchBodySchema = patchItemSchema.extend({
  audiences: z.array(audienceInputSchema).optional(),
})

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    const { id } = await context.params
    const item = await getAdminKnowledgeItemById(id)
    if (!item) return Response.json({ error: 'Not found' }, { status: 404 })
    return Response.json({ item })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load item'
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    const { id } = await context.params
    const item = await getAdminKnowledgeItemById(id)
    if (!item) return Response.json({ error: 'Not found' }, { status: 404 })
    await withDbTransaction((client) => deleteKnowledgeItem(client, id))
    return Response.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete item'
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    const { id } = await context.params
    const body = patchBodySchema.parse(await request.json())
    const { audiences, ...patch } = body

    await withDbTransaction(async (client) => {
      await patchKnowledgeItem(client, id, patch)
      if (audiences) await replaceItemAudiences(client, id, audiences)
    })

    scheduleSearchReindexIfEnabled(id)

    const item = await getAdminKnowledgeItemById(id)
    return Response.json({ item })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update item'
    return Response.json({ error: message }, { status: 400 })
  }
}
