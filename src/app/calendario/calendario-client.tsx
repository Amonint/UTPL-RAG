'use client'

import { useMemo } from 'react'

import { EventManager } from '@/components/ui/event-manager'
import { EVENTS } from '@/data/academic-calendar-events'
import { filterAcademicEventsFromTodayEcuador } from '@/lib/ecuador-calendar'
import { mapUtplRecordsToManagerEvents } from '@/lib/map-utpl-academic-events'

export function CalendarioClient() {
  const records = useMemo(() => filterAcademicEventsFromTodayEcuador(EVENTS), [])
  const events = useMemo(() => mapUtplRecordsToManagerEvents(records), [records])
  const categories = useMemo(
    () => [...new Set(records.map((e) => e.category))].sort((a, b) => a.localeCompare(b, 'es')),
    [records],
  )

  return <EventManager readOnly events={events} categories={categories} defaultView="month" />
}
