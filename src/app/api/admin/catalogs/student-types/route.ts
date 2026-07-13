import { createStudentTypeSchema, patchStudentTypeSchema } from '@/lib/admin/validation'
import { assertAdminEnabled } from '@/lib/admin/route-guard'
import {
  countAudienceUsageForStudentType,
  createStudentType,
  fetchStudentTypesForAdmin,
  patchStudentType,
} from '@/lib/db/admin/catalog-repository'
import { withDbTransaction } from '@/lib/db/transaction'

export async function GET() {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    const studentTypes = await fetchStudentTypesForAdmin()
    return Response.json({ studentTypes })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudieron cargar los tipos de estudiante'
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    const body = createStudentTypeSchema.parse(await request.json())
    const id = await withDbTransaction((client) => createStudentType(client, body))
    return Response.json({ id }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo crear el tipo de estudiante'
    const status = message.includes('unique') || message.includes('duplicate') ? 409 : 400
    return Response.json({ error: message }, { status })
  }
}

export async function PATCH(request: Request) {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    const body = patchStudentTypeSchema.parse(await request.json())
    const { id, isActive, ...patch } = body
    if (isActive === false) {
      const usage = await countAudienceUsageForStudentType(id)
      if (usage > 0) {
        return Response.json(
          {
            error: `Este tipo está en ${usage} entrada(s). Desactívelo solo si ya no aplica.`,
            usageCount: usage,
          },
          { status: 409 },
        )
      }
    }
    await withDbTransaction((client) => patchStudentType(client, id, { ...patch, isActive }))
    return Response.json({ ok: true })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo actualizar el tipo de estudiante'
    return Response.json({ error: message }, { status: 400 })
  }
}
