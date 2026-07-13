'use client'

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'

import { EventManager } from '@/components/ui/event-manager'
import { useAcademicCalendarEvents } from '@/hooks/use-academic-calendar-events'
import { filterAcademicEventsFromTodayEcuador } from '@/lib/ecuador-calendar'
import { mapUtplRecordsToManagerEvents } from '@/lib/map-utpl-academic-events'

export function CalendarioClient() {
  const searchParams = useSearchParams()
  const initialOpenEventId = searchParams.get('eventId')?.trim() || undefined
  const { events: records, loading, error } = useAcademicCalendarEvents({
    includePast: Boolean(initialOpenEventId),
  })

  const filtered = useMemo(
    () => (initialOpenEventId ? records : filterAcademicEventsFromTodayEcuador(records)),
    [records, initialOpenEventId],
  )
  const events = useMemo(() => mapUtplRecordsToManagerEvents(filtered), [filtered])
  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Cargando calendario…
      </div>
    )
  }

  if (error && filtered.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground">
        <p>No se pudo cargar el calendario.</p>
        <p className="text-xs opacity-80">{error}</p>
      </div>
    )
  }

  return (
    <EventManager
      readOnly
      events={events}
      defaultView="month"
      initialOpenEventId={initialOpenEventId}
    />
  )
}
