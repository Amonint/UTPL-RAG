'use client'

import { useCallback, useEffect, useState } from 'react'

import type { AcademicCalendarEventRecord } from '@/data/academic-calendar-events'

export type UseAcademicCalendarEventsOptions = {
  domainCode?: string
  profileTypeCode?: string
  studentTypeCode?: string
  periodLabel?: string
  periodValidFrom?: string
  periodValidTo?: string
  includePast?: boolean
}

function buildQuery(params: UseAcademicCalendarEventsOptions): string {
  const sp = new URLSearchParams()
  if (params.domainCode) sp.set('domainCode', params.domainCode)
  if (params.profileTypeCode) sp.set('profileTypeCode', params.profileTypeCode)
  if (params.studentTypeCode) sp.set('studentTypeCode', params.studentTypeCode)
  if (params.periodLabel) sp.set('periodLabel', params.periodLabel)
  if (params.periodValidFrom) sp.set('periodValidFrom', params.periodValidFrom)
  if (params.periodValidTo) sp.set('periodValidTo', params.periodValidTo)
  if (params.includePast) sp.set('includePast', '1')
  const q = sp.toString()
  return q ? `?${q}` : ''
}

export function useAcademicCalendarEvents(options: UseAcademicCalendarEventsOptions = {}) {
  const [events, setEvents] = useState<AcademicCalendarEventRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/calendar/events${buildQuery(options)}`)
      const body = (await res.json()) as {
        events?: AcademicCalendarEventRecord[]
        error?: string
      }
      if (res.ok && Array.isArray(body.events)) {
        setEvents(body.events)
      } else {
        setEvents([])
        setError(body.error ?? 'No se pudo cargar el calendario')
      }
    } catch {
      setEvents([])
      setError('No se pudo cargar el calendario')
    } finally {
      setLoading(false)
    }
  }, [
    options.domainCode,
    options.profileTypeCode,
    options.studentTypeCode,
    options.periodLabel,
    options.periodValidFrom,
    options.periodValidTo,
    options.includePast,
  ])

  useEffect(() => {
    void reload()
  }, [reload])

  return { events, loading, error, reload }
}
