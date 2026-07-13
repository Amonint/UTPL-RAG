import { createCyclePeriodSchema, patchCyclePeriodSchema } from '@/lib/admin/validation'
import { assertAdminEnabled } from '@/lib/admin/route-guard'
import {
  createCyclePeriod,
  fetchCyclePeriodsForAdmin,
  patchCyclePeriod,
} from '@/lib/db/admin/catalog-repository'
import { withDbTransaction } from '@/lib/db/transaction'

export async function GET() {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    const cyclePeriods = await fetchCyclePeriodsForAdmin()
    return Response.json({ cyclePeriods })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudieron cargar los periodos'
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    const body = createCyclePeriodSchema.parse(await request.json())
    const id = await withDbTransaction((client) => createCyclePeriod(client, body))
    return Response.json({ id }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo crear el periodo'
    const status = message.includes('unique') || message.includes('duplicate') ? 409 : 400
    return Response.json({ error: message }, { status })
  }
}

export async function PATCH(request: Request) {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    const body = patchCyclePeriodSchema.parse(await request.json())
    const { id, ...patch } = body
    await withDbTransaction((client) => patchCyclePeriod(client, id, patch))
    return Response.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo actualizar el periodo'
    return Response.json({ error: message }, { status: 400 })
  }
}
