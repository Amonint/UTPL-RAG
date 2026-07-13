import { createProfileTypeSchema, patchProfileTypeSchema } from '@/lib/admin/validation'
import { assertAdminEnabled } from '@/lib/admin/route-guard'
import {
  countAudienceUsageForProfileType,
  createStudentProfileType,
  fetchStudentProfileTypesForAdmin,
  patchStudentProfileType,
} from '@/lib/db/admin/catalog-repository'
import { withDbTransaction } from '@/lib/db/transaction'

export async function GET() {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    const profileTypes = await fetchStudentProfileTypesForAdmin()
    return Response.json({ profileTypes })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudieron cargar las modalidades'
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    const body = createProfileTypeSchema.parse(await request.json())
    const id = await withDbTransaction((client) => createStudentProfileType(client, body))
    return Response.json({ id }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo crear la modalidad'
    const status = message.includes('unique') || message.includes('duplicate') ? 409 : 400
    return Response.json({ error: message }, { status })
  }
}

export async function PATCH(request: Request) {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    const body = patchProfileTypeSchema.parse(await request.json())
    const { id, isActive, ...patch } = body
    if (isActive === false) {
      const usage = await countAudienceUsageForProfileType(id)
      if (usage > 0) {
        return Response.json(
          {
            error: `Esta modalidad está en ${usage} entrada(s). Desactívela solo si ya no aplica.`,
            usageCount: usage,
          },
          { status: 409 },
        )
      }
    }
    await withDbTransaction((client) =>
      patchStudentProfileType(client, id, { ...patch, isActive }),
    )
    return Response.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo actualizar la modalidad'
    return Response.json({ error: message }, { status: 400 })
  }
}
