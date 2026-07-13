import type { AcademicCalendarEventRecord } from '@/data/academic-calendar-events'
import type { CalendarEventScopeMeta } from '@/lib/calendar/event-scope-meta'

export type CalendarEventWithScope = AcademicCalendarEventRecord & {
  scope: CalendarEventScopeMeta | null
}
