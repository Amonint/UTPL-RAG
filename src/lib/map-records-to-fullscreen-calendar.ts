import { eachDayOfInterval, format, parseISO } from "date-fns"

import type { AcademicCalendarEventRecord } from "@/data/academic-calendar-events"

export interface FullscreenCalendarEvent {
  id: number
  name: string
  time: string
  datetime: string
}

export interface FullscreenCalendarDay {
  day: Date
  events: FullscreenCalendarEvent[]
}

/** Agrupa actividades académicas por día local (inicio–fin inclusive). */
export function mapRecordsToFullscreenCalendarData(
  records: readonly AcademicCalendarEventRecord[],
): FullscreenCalendarDay[] {
  const map = new Map<string, FullscreenCalendarEvent[]>()

  for (const r of records) {
    const start = parseISO(`${r.start}T12:00:00`)
    const end = parseISO(`${r.end}T12:00:00`)
    const days = eachDayOfInterval({ start, end })
    for (const day of days) {
      const key = format(day, "yyyy-MM-dd")
      const list = map.get(key) ?? []
      list.push({
        id: r.id,
        name: r.title,
        time: "Todo el día",
        datetime: `${format(day, "yyyy-MM-dd")}T12:00:00`,
      })
      map.set(key, list)
    }
  }

  return [...map.entries()]
    .map(([key, events]) => ({
      day: parseISO(`${key}T12:00:00`),
      events,
    }))
    .sort((a, b) => a.day.getTime() - b.day.getTime())
}
