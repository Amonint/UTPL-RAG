import { describe, expect, it } from 'vitest'
import type { AcademicCalendarEventRecord } from '@/data/academic-calendar-events'
import {
  filterAcademicEventsFromTodayEcuador,
  getEcuadorTodayYmd,
} from '@/lib/ecuador-calendar'

/** Instantánea en UTC que corresponde a 2026-05-11 en America/Guayaquil (GMT-5). */
const refUtc = new Date('2026-05-11T12:00:00.000Z')

describe('getEcuadorTodayYmd', () => {
  it('devuelve YYYY-MM-DD en zona America/Guayaquil', () => {
    expect(getEcuadorTodayYmd(refUtc)).toBe('2026-05-11')
  })
})

describe('filterAcademicEventsFromTodayEcuador', () => {
  const samples: AcademicCalendarEventRecord[] = [
    {
      id: 1,
      title: 'Pasado',
      start: '2026-01-01',
      end: '2026-05-10',
      category: 'Feriado',
      modality: 'Todas',
    },
    {
      id: 2,
      title: 'Termina hoy Ecuador',
      start: '2026-05-01',
      end: '2026-05-11',
      category: 'Académico',
      modality: 'GR P',
    },
    {
      id: 3,
      title: 'Ventana larga en curso',
      start: '2026-04-01',
      end: '2026-08-01',
      category: 'Matrículas',
      modality: 'Todas',
    },
    {
      id: 4,
      title: 'Solo futuro',
      start: '2026-12-01',
      end: '2026-12-31',
      category: 'Vacaciones',
      modality: 'Todas',
    },
  ]

  it('excluye eventos con end anterior a hoy Ecuador', () => {
    const out = filterAcademicEventsFromTodayEcuador(samples, refUtc)
    expect(out.map((e) => e.id).sort((a, b) => a - b)).toEqual([2, 3, 4])
  })

  it('con now ya en 2027 Ecuador, ningún evento del set de ejemplo sigue vigente', () => {
    const en2027Ecuador = new Date('2027-01-01T17:00:00.000Z')
    const out = filterAcademicEventsFromTodayEcuador(samples, en2027Ecuador)
    expect(out).toHaveLength(0)
  })
})
