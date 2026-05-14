/**
 * Dataset activo del calendario: fusiona los JSON de la raíz del repo
 * (`grado-en-linea.json`, `grado-presencial.json`, `tecnico-tecnologico-*.json`,
 * `servicios-tramites.json`, `postgrado.json`) vía `npm run calendar:merge-sources`
 * → `calendar-events-from-sources.json` (versionado en git para Vercel).
 */
import type { AcademicCalendarEventRecord } from './academic-calendar-events'

import events from './calendar-events-from-sources.json'

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
  Administrativo: '#c9a227',
  Evaluación: '#2d5f8d',
  Docente: '#1e4a7a',
  Notas: '#b8860b',
  Recuperación: '#4a6fa5',
  Feriado: '#64748b',
  Vacaciones: '#0d4f6e',
  Otro: '#334155',
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
