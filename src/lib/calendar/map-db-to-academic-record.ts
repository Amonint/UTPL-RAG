import type { AcademicCalendarEventRecord } from '@/data/academic-calendar-events'
import { decodeScopeMeta } from '@/lib/calendar/event-scope-meta'

export type CalendarEventDbRow = {
  id: string
  title: string
  eventType: string
  startsOn: string
  endsOn: string
  detailsText: string | null
  modalityLabels: string[]
  modalityCodes: string[]
}

function stableNumericId(uuid: string): number {
  let hash = 0
  for (let i = 0; i < uuid.length; i += 1) {
    hash = (hash * 31 + uuid.charCodeAt(i)) >>> 0
  }
  return hash || 1
}

export function formatModalityDisplay(labels: string[], codes: string[], detailsText: string | null): string {
  const parts = labels.filter(Boolean)
  if (parts.length > 0) {
    return parts.join(' / ')
  }
  const codeParts = codes.filter((c) => c && c !== 'todas')
  if (codeParts.length > 0) {
    return codeParts.map((c) => c.toUpperCase()).join(' / ')
  }
  const meta = decodeScopeMeta(detailsText)
  if (meta?.profileTypeCode) {
    return meta.profileTypeCode
  }
  const plain = detailsText?.trim()
  if (plain && !plain.startsWith('{')) return plain
  return 'Todas'
}

export function mapDbRowToAcademicRecord(row: CalendarEventDbRow): AcademicCalendarEventRecord {
  const modality = formatModalityDisplay(row.modalityLabels, row.modalityCodes, row.detailsText)
  return {
    id: row.id,
    title: row.title,
    start: row.startsOn,
    end: row.endsOn,
    category: row.eventType,
    modality,
  }
}

/** Id numérico estable para componentes que esperan number (JSON legado). */
export function academicRecordNumericId(record: AcademicCalendarEventRecord): number {
  if (typeof record.id === 'number') return record.id
  return stableNumericId(record.id)
}
