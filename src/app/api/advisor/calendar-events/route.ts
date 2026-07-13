import { createCalendarEventSchema } from '@/lib/admin/validation'
import {
  calendarEventsTableReady,
  createCalendarEvent,
} from '@/lib/db/admin/calendar-events-repository'
import { withDbTransaction } from '@/lib/db/transaction'

export async function POST(request: Request) {
  try {
    if (!process.env.DATABASE_URL?.trim()) {
      return Response.json({ error: 'DATABASE_URL is required' }, { status: 503 })
    }

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
          source: 'cargar',
          editorialStatus: 'review',
        },
      }),
    )
    return Response.json(
      {
        id,
        message: 'Evento enviado a revisión',
        adminPath: '/admin/calendar',
      },
      { status: 201 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo crear el evento'
    const status = message.includes('unique') ? 409 : 400
    return Response.json({ error: message }, { status })
  }
}
