import { createEditorialStatusSchema, patchEditorialStatusSchema } from '@/lib/admin/validation'
import { assertAdminEnabled } from '@/lib/admin/route-guard'
import {
  countKnowledgeItemsByEditorialStatus,
  createEditorialStatus,
  fetchEditorialStatusesForAdmin,
  patchEditorialStatus,
} from '@/lib/db/admin/catalog-repository'
import { withDbTransaction } from '@/lib/db/transaction'

export async function GET() {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    const editorialStatuses = await fetchEditorialStatusesForAdmin()
    return Response.json({ editorialStatuses })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudieron cargar los estados'
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    const body = createEditorialStatusSchema.parse(await request.json())
    const code = await withDbTransaction((client) => createEditorialStatus(client, body))
    return Response.json({ code }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo crear el estado'
    const status = message.includes('unique') || message.includes('duplicate') ? 409 : 400
    return Response.json({ error: message }, { status })
  }
}

export async function PATCH(request: Request) {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    const body = patchEditorialStatusSchema.parse(await request.json())
    const { code, isActive, ...patch } = body
    if (isActive === false) {
      const usage = await countKnowledgeItemsByEditorialStatus(code)
      if (usage > 0) {
        return Response.json(
          {
            error: `Este estado tiene ${usage} entrada(s). Desactívelo solo si ya no aplica.`,
            usageCount: usage,
          },
          { status: 409 },
        )
      }
    }
    await withDbTransaction((client) => patchEditorialStatus(client, code, { ...patch, isActive }))
    return Response.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo actualizar el estado'
    return Response.json({ error: message }, { status: 400 })
  }
}
