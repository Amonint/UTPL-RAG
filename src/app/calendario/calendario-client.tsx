'use client'

import { useMemo } from 'react'

import { FullScreenCalendar } from '@/components/ui/fullscreen-calendar'
import { EventManager } from '@/components/ui/event-manager'
import { EVENTS } from '@/data/calendar-events-active'
import { filterAcademicEventsFromTodayEcuador } from '@/lib/ecuador-calendar'
import { mapRecordsToFullscreenCalendarData } from '@/lib/map-records-to-fullscreen-calendar'
import { mapUtplRecordsToManagerEvents } from '@/lib/map-utpl-academic-events'

export function CalendarioClient() {
  const records = useMemo(() => filterAcademicEventsFromTodayEcuador(EVENTS), [])
  const events = useMemo(() => mapUtplRecordsToManagerEvents(records), [records])
  const fullscreenData = useMemo(() => mapRecordsToFullscreenCalendarData(records), [records])
  const categories = useMemo(
    () => [...new Set(records.map((e) => e.category))].sort((a, b) => a.localeCompare(b, 'es')),
    [records],
  )

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Vista mensual ampliada</h2>
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <FullScreenCalendar data={fullscreenData} showNewEvent={false} />
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Vista compacta</h2>
        <EventManager readOnly events={events} categories={categories} defaultView="month" />
      </section>
    </div>
  )
}
