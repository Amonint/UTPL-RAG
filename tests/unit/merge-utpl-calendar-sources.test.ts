import { describe, expect, it } from 'vitest'

import type { UtplCalendarSourceFile } from '@/lib/utpl-calendar-merge'
import {
  formatModalities,
  isValidYmd,
  mapSourceCategoryToUi,
  mergeUtplCalendarSources,
  stableCalendarRecordId,
} from '@/lib/utpl-calendar-merge'

describe('utpl-calendar-merge', () => {
  it('isValidYmd acepta fechas gregorianas válidas', () => {
    expect(isValidYmd('2026-04-06')).toBe(true)
    expect(isValidYmd('2026-02-29')).toBe(false)
    expect(isValidYmd('2026-13-01')).toBe(false)
    expect(isValidYmd('bad')).toBe(false)
  })

  it('mapSourceCategoryToUi mapea feriados, normaliza acentos y usa Otro como fallback', () => {
    expect(mapSourceCategoryToUi('feriados')).toBe('Feriado')
    expect(mapSourceCategoryToUi('gestión académica')).toBe('Académico')
    expect(mapSourceCategoryToUi('matrículas')).toBe('Matrículas')
    expect(mapSourceCategoryToUi('categoria_inventada')).toBe('Otro')
  })

  it('formatModalities une varias modalidades con " / "', () => {
    expect(formatModalities(['todas'])).toBe('Todas')
    expect(formatModalities(['grado_en_linea', 'presencial'])).toBe('Grado en línea / Presencial')
  })

  it('stableCalendarRecordId es determinista', () => {
    expect(stableCalendarRecordId('a.json', 'E1', 0)).toBe(stableCalendarRecordId('a.json', 'E1', 0))
    expect(stableCalendarRecordId('a.json', 'E1', 0)).not.toBe(stableCalendarRecordId('a.json', 'E1', 1))
  })

  it('mergeUtplCalendarSources expande fecha y periodo', () => {
    const data: UtplCalendarSourceFile = {
      institucion: 'UTPL',
      ciclo: 'test',
      eventos: [
        {
          id: 'T-1',
          categoria: 'matriculas',
          nombre: 'Matrícula prueba',
          modalidades: ['todas'],
          fechas: [
            { tipo: 'fecha', inicio: '2026-05-01', fin: '2026-05-01' },
            { tipo: 'periodo', inicio: '2026-06-01', fin: '2026-06-05' },
          ],
          notas: null,
        },
      ],
    }

    const { records, errors } = mergeUtplCalendarSources([{ fileName: 'fixture.json', data }])
    expect(errors).toEqual([])
    expect(records).toHaveLength(2)
    expect(records[0].category).toBe('Matrículas')
    expect(records[0].modality).toBe('Todas')
    expect(records[0].start).toBe('2026-05-01')
    expect(records[0].end).toBe('2026-05-01')
    expect(records[1].start).toBe('2026-06-01')
    expect(records[1].end).toBe('2026-06-05')
  })

  it('mergeUtplCalendarSources reporta inicio > fin', () => {
    const data: UtplCalendarSourceFile = {
      eventos: [
        {
          id: 'BAD',
          categoria: 'feriados',
          nombre: 'X',
          modalidades: ['todas'],
          fechas: [{ tipo: 'periodo', inicio: '2026-08-10', fin: '2026-04-01' }],
        },
      ],
    }
    const { errors, records } = mergeUtplCalendarSources([{ fileName: 'x.json', data }])
    expect(records).toHaveLength(0)
    expect(errors.some((e) => e.includes('inicio > fin'))).toBe(true)
  })
})
