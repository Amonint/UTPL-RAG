import {
  createCalendarEventSchema,
  listCalendarEventsQuerySchema,
} from '@/lib/admin/validation'
import { assertAdminEnabled } from '@/lib/admin/route-guard'
import {
  calendarEventsTableReady,
  createCalendarEvent,
  listCalendarEventsWithScope,
} from '@/lib/db/admin/calendar-events-repository'
import { withDbTransaction } from '@/lib/db/transaction'

export async function GET(request: Request) {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    const ready = await calendarEventsTableReady()
    if (!ready) {
      return Response.json(
        {
          events: [],
          error:
            'Las tablas de calendario no están en la base de datos. Ejecute scripts/migrations/2026-06-01-calendar-events.sql',
        },
        { status: 503 },
      )
    }

    const url = new URL(request.url)
    const query = listCalendarEventsQuerySchema.parse({
      domainCode: url.searchParams.get('domainCode') ?? undefined,
      profileTypeCode: url.searchParams.get('profileTypeCode') ?? undefined,
      studentTypeCode: url.searchParams.get('studentTypeCode') ?? undefined,
      periodLabel: url.searchParams.get('periodLabel') ?? undefined,
      periodValidFrom: url.searchParams.get('periodValidFrom') ?? undefined,
      periodValidTo: url.searchParams.get('periodValidTo') ?? undefined,
      includePast: url.searchParams.get('includePast') ?? '1',
    })

    const events = await listCalendarEventsWithScope({
      ...query,
      includePast: query.includePast ?? true,
    })
    return Response.json({ events })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudieron listar los eventos'
    return Response.json({ error: message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    const ready = await calendarEventsTableReady()
    if (!ready) {
      return Response.json({ error: 'Tablas de calendario no disponibles' }, { status: 503 })
    }

    const body = createCalendarEventSchema.parse(await request.json())
    const id = await withDbTransaction((client) =>
      createCalendarEvent(client, {
        ...body,
        scope: {
          ...body.scope,
          source: body.scope.source ?? 'admin',
          editorialStatus: body.scope.editorialStatus ?? 'published',
        },
      }),
    )
    return Response.json({ id }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo crear el evento'
    const status = message.includes('unique') ? 409 : 400
    return Response.json({ error: message }, { status })
  }
}
