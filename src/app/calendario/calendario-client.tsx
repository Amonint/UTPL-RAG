'use client'

import { useMemo } from 'react'

import { EventManager } from '@/components/ui/event-manager'
import { EVENTS } from '@/data/academic-calendar-events'
import { mapUtplRecordsToManagerEvents } from '@/lib/map-utpl-academic-events'

export function CalendarioClient() {
  const events = useMemo(() => mapUtplRecordsToManagerEvents(EVENTS), [])
  const categories = useMemo(
    () => [...new Set(EVENTS.map((e) => e.category))].sort((a, b) => a.localeCompare(b, 'es')),
    [],
  )

  return <EventManager readOnly events={events} categories={categories} defaultView="month" />
}
