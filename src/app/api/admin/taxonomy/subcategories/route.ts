import { createSubcategorySchema } from '@/lib/admin/validation'
import { assertAdminEnabled } from '@/lib/admin/route-guard'
import { patchSubcategory, upsertSubcategory } from '@/lib/db/admin/taxonomy-repository'
import { withDbTransaction } from '@/lib/db/transaction'

export async function POST(request: Request) {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    const body = createSubcategorySchema.parse(await request.json())
    const id = await withDbTransaction((client) => upsertSubcategory(client, body))
    return Response.json({ id }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create subcategory'
    return Response.json({ error: message }, { status: message.includes('unique') ? 409 : 400 })
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
      patchSubcategory(client, id, { name, slug, description, sortOrder, isActive }),
    )
    return Response.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update subcategory'
    return Response.json({ error: message }, { status: 400 })
  }
}
