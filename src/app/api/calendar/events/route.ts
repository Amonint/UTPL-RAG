import { listCalendarEventsQuerySchema } from '@/lib/admin/validation'
import {
  calendarEventsTableReady,
  listCalendarEvents,
} from '@/lib/db/admin/calendar-events-repository'
import { EVENTS as STATIC_CALENDAR_EVENTS } from '@/data/academic-calendar-events'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const query = listCalendarEventsQuerySchema.parse({
      domainCode: url.searchParams.get('domainCode') ?? undefined,
      profileTypeCode: url.searchParams.get('profileTypeCode') ?? undefined,
      studentTypeCode: url.searchParams.get('studentTypeCode') ?? undefined,
      periodLabel: url.searchParams.get('periodLabel') ?? undefined,
      periodValidFrom: url.searchParams.get('periodValidFrom') ?? undefined,
      periodValidTo: url.searchParams.get('periodValidTo') ?? undefined,
      includePast: url.searchParams.get('includePast') ?? undefined,
    })

    const ready = await calendarEventsTableReady()
    if (!ready) {
      return Response.json({ events: STATIC_CALENDAR_EVENTS })
    }

    const events = await listCalendarEvents(query)
    return Response.json({ events })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo cargar el calendario'
    return Response.json({ events: STATIC_CALENDAR_EVENTS, error: message })
  }
}
