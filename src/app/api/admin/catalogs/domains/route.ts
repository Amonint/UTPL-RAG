import { createDomainSchema, patchDomainSchema } from '@/lib/admin/validation'
import { assertAdminEnabled } from '@/lib/admin/route-guard'
import {
  createDomain,
  fetchDomainsForAdmin,
  patchDomain,
} from '@/lib/db/admin/catalog-repository'
import { withDbTransaction } from '@/lib/db/transaction'

export async function GET() {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    const domains = await fetchDomainsForAdmin()
    return Response.json({ domains })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudieron cargar las áreas'
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    const body = createDomainSchema.parse(await request.json())
    const id = await withDbTransaction((client) => createDomain(client, body))
    return Response.json({ id }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo crear el área'
    const status = message.includes('unique') || message.includes('duplicate') ? 409 : 400
    return Response.json({ error: message }, { status })
  }
}

export async function PATCH(request: Request) {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    const body = patchDomainSchema.parse(await request.json())
    const { id, ...patch } = body
    await withDbTransaction((client) =>
      patchDomain(client, id, {
        name: patch.name,
        description: patch.description,
        sortOrder: patch.sortOrder,
        isActive: patch.isActive,
      }),
    )
    return Response.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo actualizar el área'
    return Response.json({ error: message }, { status: 400 })
  }
}
