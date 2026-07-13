import { describe, expect, it } from 'vitest'

import {
  formatModalityDisplay,
  mapDbRowToAcademicRecord,
} from '@/lib/calendar/map-db-to-academic-record'

describe('mapDbRowToAcademicRecord', () => {
  it('maps database row to academic record', () => {
    const record = mapDbRowToAcademicRecord({
      id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Matrículas ordinarias',
      eventType: 'Matrículas',
      startsOn: '2026-03-06',
      endsOn: '2026-04-01',
      detailsText: null,
      modalityLabels: ['Presencial'],
      modalityCodes: ['presencial'],
    })
    expect(record.id).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(record.category).toBe('Matrículas')
    expect(record.modality).toBe('Presencial')
  })

  it('formats modality from codes when labels missing', () => {
    expect(formatModalityDisplay([], ['gr_p'], null)).toBe('GR_P')
    expect(formatModalityDisplay([], [], null)).toBe('Todas')
  })
})
