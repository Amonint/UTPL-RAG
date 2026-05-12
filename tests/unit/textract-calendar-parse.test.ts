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
  })

  it('extrae fechas en orden', () => {
    expect(extractIsoDatesFromText('del 01/04/2026 al 15/06/2026')).toEqual(['2026-04-01', '2026-06-15'])
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
