import type { AcademicCalendarEventRecord } from '@/data/academic-calendar-events'

const ECUADOR_TZ = 'America/Guayaquil'

const ymdFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: ECUADOR_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * Fecha calendario actual en Ecuador (YYYY-MM-DD), comparable con `start`/`end` del dataset.
 */
export function getEcuadorTodayYmd(now: Date = new Date()): string {
  return ymdFormatter.format(now)
}

/**
 * Eventos cuya ventana aún no ha cerrado: `end` >= hoy (día calendario Ecuador).
 */
export function filterAcademicEventsFromTodayEcuador(
  records: readonly AcademicCalendarEventRecord[],
  now: Date = new Date(),
): AcademicCalendarEventRecord[] {
  const today = getEcuadorTodayYmd(now)
  return records.filter((e) => e.end >= today)
}
