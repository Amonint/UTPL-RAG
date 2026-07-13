import { createCategorySchema } from '@/lib/admin/validation'
import { assertAdminEnabled } from '@/lib/admin/route-guard'
import { patchCategory, upsertCategory } from '@/lib/db/admin/taxonomy-repository'
import { withDbTransaction } from '@/lib/db/transaction'

export async function POST(request: Request) {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    const body = createCategorySchema.parse(await request.json())
    const id = await withDbTransaction((client) => upsertCategory(client, body))
    return Response.json({ id }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create category'
    const status = message.includes('unique') ? 409 : 400
    return Response.json({ error: message }, { status })
  }
}

export async function PATCH(request: Request) {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    const body = (await request.json()) as {
      id?: string
      name?: string
      slug?: string
      description?: string
      sortOrder?: number
      isActive?: boolean
    }
    const { id, name, slug, description, sortOrder, isActive } = body
    if (!id) return Response.json({ error: 'id is required' }, { status: 400 })
    await withDbTransaction((client) =>
      patchCategory(client, id, { name, slug, description, sortOrder, isActive }),
    )
    return Response.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update category'
    return Response.json({ error: message }, { status: 400 })
  }
}
