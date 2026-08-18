import { patchCalendarEventSchema, patchCalendarEventStatusSchema } from '@/lib/admin/validation'
import { assertAdminEnabled } from '@/lib/admin/route-guard'
import {
  calendarEventsTableReady,
  softDeleteCalendarEvent,
  updateCalendarEvent,
  updateCalendarEventEditorialStatus,
} from '@/lib/db/admin/calendar-events-repository'
import { withDbTransaction } from '@/lib/db/transaction'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    if (!(await calendarEventsTableReady())) {
      return Response.json({ error: 'Tablas de calendario no disponibles' }, { status: 503 })
    }

    const { id } = await context.params
    const json: unknown = await request.json()
    const statusOnly = patchCalendarEventStatusSchema.safeParse(json)
    const isStatusOnly =
      statusOnly.success &&
      typeof json === 'object' &&
      json !== null &&
      Object.keys(json).length === 1

    if (isStatusOnly) {
      await withDbTransaction((client) =>
        updateCalendarEventEditorialStatus(client, id, statusOnly.data.editorialStatus),
      )
      return Response.json({ ok: true })
    }

    const body = patchCalendarEventSchema.parse(json)
    await withDbTransaction((client) => updateCalendarEvent(client, id, body))
    return Response.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo actualizar el evento'
    return Response.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    if (!(await calendarEventsTableReady())) {
      return Response.json({ error: 'Tablas de calendario no disponibles' }, { status: 503 })
    }

    const { id } = await context.params
    await withDbTransaction((client) => softDeleteCalendarEvent(client, id))
    return Response.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo eliminar el evento'
    return Response.json({ error: message }, { status: 400 })
  }
}
