import type { AcademicCalendarEventRecord } from '@/data/academic-calendar-events'
import type { Event, EventColor } from '@/components/ui/event-manager'

const CATEGORY_TO_COLOR: Record<string, EventColor> = {
  Matrículas: 'blue',
  Académico: 'green',
  Trámite: 'orange',
  Evaluación: 'purple',
  Notas: 'red',
  Recuperación: 'pink',
  Feriado: 'blue',
  Vacaciones: 'green',
  'Doctorado Química': 'purple',
  CCE: 'purple',
  Modular: 'blue',
  Inglés: 'green',
  'Val. General': 'blue',
  Titulación: 'purple',
  'UIC/UTE': 'orange',
}

export function mapUtplRecordsToManagerEvents(
  records: readonly AcademicCalendarEventRecord[],
): Event[] {
  return records.map((r) => ({
    id: String(r.id),
    title: r.title,
    description: r.modality,
    startTime: new Date(`${r.start}T00:00:00`),
    endTime: new Date(`${r.end}T23:59:59.999`),
    color: CATEGORY_TO_COLOR[r.category] ?? 'blue',
    category: r.category,
    tags: r.modality === 'Todas' || r.modality === 'No especificada' ? [] : [r.modality],
  }))
}
