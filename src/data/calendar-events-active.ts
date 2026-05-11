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

export const CATEGORY_COLORS = {
  Matrículas: '#2563eb',
  Académico: '#059669',
  Trámite: '#d97706',
  Evaluación: '#7c3aed',
  Notas: '#dc2626',
  Recuperación: '#0891b2',
  Feriado: '#4b5563',
  Vacaciones: '#0f766e',
  'Doctorado Química': '#be185d',
  CCE: '#9333ea',
  Modular: '#0369a1',
  Inglés: '#0d9488',
  'Val. General': '#64748b',
  Titulación: '#c026d3',
  'UIC/UTE': '#ea580c',
} as const

export function colorForCategory(category: string): string {
  return (CATEGORY_COLORS as Record<string, string>)[category] ?? '#334155'
}
