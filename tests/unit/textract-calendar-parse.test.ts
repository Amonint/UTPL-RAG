import { describe, expect, it } from 'vitest'

import {
  ddmmyyyyToIso,
  extractIsoDatesFromText,
  inferRangeFromText,
  normalizeTitle,
} from '../../scripts/lib/textract-calendar-parse'

describe('textract-calendar-parse', () => {
  it('convierte dd/mm/yyyy a ISO', () => {
    expect(ddmmyyyyToIso('9', '3', '2026')).toBe('2026-03-09')
    expect(ddmmyyyyToIso('31', '12', '2026')).toBe('2026-12-31')
    expect(ddmmyyyyToIso('99', '3', '2026')).toBeNull()
    expect(ddmmyyyyToIso('6', '3', '26')).toBe('2026-03-06')
    expect(ddmmyyyyToIso('10', '12', '25')).toBe('2025-12-10')
  })

  it('PDF nativos: día abreviado + dd/mm/aa', () => {
    expect(extractIsoDatesFromText('Fecha inicio vie 6/3/26')).toEqual(['2026-03-06'])
    expect(extractIsoDatesFromText('mié 10/12/25 al jue 15/01/26')).toEqual([
      '2025-12-10',
      '2026-01-15',
    ])
  })

  it('extrae fechas en orden', () => {
    expect(extractIsoDatesFromText('del 01/04/2026 al 15/06/2026')).toEqual(['2026-04-01', '2026-06-15'])
  })

  it('extrae fechas largas en español (calendarios escaneados)', () => {
    expect(
      extractIsoDatesFromText('Lun 20 de octubre 2025 hasta Vie 28 de noviembre de 2025'),
    ).toEqual(['2025-10-20', '2025-11-28'])
    expect(extractIsoDatesFromText('Mié 19 de noviembre de 2025')).toEqual(['2025-11-19'])
    expect(extractIsoDatesFromText('15 de marzo 2026')).toEqual(['2026-03-15'])
    expect(extractIsoDatesFromText('Lunes 24 de noviembre del 2025')).toEqual(['2025-11-24'])
    expect(extractIsoDatesFromText('12 de agosto del 2026')).toEqual(['2026-08-12'])
  })

  it('mezcla dd/mm y español por posición en el texto', () => {
    expect(extractIsoDatesFromText('01/02/2026 y el 3 de marzo de 2026')).toEqual([
      '2026-02-01',
      '2026-03-03',
    ])
  })

  it('listas/bullets: rango mismo mes y cruce de meses sin año en el primer extremo', () => {
    expect(extractIsoDatesFromText('Matrículas extraordinarias: Del 2 al 6 de abril de 2026')).toEqual([
      '2026-04-02',
      '2026-04-06',
    ])
    expect(
      extractIsoDatesFromText(
        'Matrículas ordinarias (alumnos continuos): Del 12 de febrero al 1 de abril de 2026',
      ),
    ).toEqual(['2026-02-12', '2026-04-01'])
    expect(
      extractIsoDatesFromText(
        'Del 19 de noviembre de 2025 al 1 de abril de 2026',
      ),
    ).toEqual(['2025-11-19', '2026-04-01'])
  })

  it('diciembre a enero con un solo año al final (cruce de año)', () => {
    expect(extractIsoDatesFromText('Del 30 de diciembre al 15 de enero de 2026')).toEqual([
      '2025-12-30',
      '2026-01-15',
    ])
  })

  it('infiere rango con primera y última fecha', () => {
    expect(inferRangeFromText('foo 10/01/2026 bar 20/01/2026')).toEqual({
      start: '2026-01-10',
      end: '2026-01-20',
    })
  })

  it('normaliza título para comparar', () => {
    expect(normalizeTitle('  Inscripción  Validación  ')).toContain('inscripcion')
    expect(normalizeTitle('Mátrículas')).toContain('matriculas')
  })
})
