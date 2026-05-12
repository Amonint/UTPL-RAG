/**
 * Dataset activo del calendario: solo filas generadas desde Textract
 * (`npm run calendar:emit-from-textract`). El listado manual vive en
 * `academic-calendar-events.ts` pero el UI del calendario no lo usa.
 */
import type { AcademicCalendarEventRecord } from './academic-calendar-events'

import events from './calendar-events-active.json'

export const EVENTS = events as AcademicCalendarEventRecord[]

function modalityOptions(rows: AcademicCalendarEventRecord[]): string[] {
  const s = new Set<string>(['Todas'])
  for (const e of rows) {
    const m = e.modality.trim()
    if (!m || m === 'Todas') continue
    for (const part of m.split(/\s*\/\s*/)) {
      const t = part.trim()
      if (t) s.add(t)
    }
  }
  return [...s].sort((a, b) => a.localeCompare(b, 'es'))
}

export const MODALITIES = modalityOptions(EVENTS) as unknown as readonly string[]

/** Paleta corporativa UTPL: azules institucionales, acentos dorados y neutros. */
export const CATEGORY_COLORS = {
  Matrículas: '#003978',
  Académico: '#1e4a7a',
  Trámite: '#c9a227',
  Evaluación: '#2d5f8d',
  Notas: '#b8860b',
  Recuperación: '#4a6fa5',
  Feriado: '#64748b',
  Vacaciones: '#0d4f6e',
  'Doctorado Química': '#003978',
  CCE: '#d4a012',
  Modular: '#1a5080',
  Inglés: '#3d6e9f',
  'Val. General': '#94a3b8',
  Titulación: '#e5b80c',
  'UIC/UTE': '#2563ab',
} as const

export function colorForCategory(category: string): string {
  return (CATEGORY_COLORS as Record<string, string>)[category] ?? '#334155'
}
