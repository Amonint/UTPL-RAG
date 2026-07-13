import { describe, expect, it } from 'vitest'

import { createCalendarEventSchema } from '@/lib/admin/validation'

describe('createCalendarEventSchema', () => {
  it('accepts valid calendar event payload', () => {
    const parsed = createCalendarEventSchema.parse({
      title: 'Inicio de clases',
      eventType: 'Académico',
      startsOn: '2026-04-06',
      endsOn: '2026-04-06',
      scope: {
        domainCode: 'academic',
        profileTypeCode: 'presencial',
        studentTypeCode: 'NUEVO',
        periodLabel: 'Abril – Agosto 2026',
        periodValidFrom: '2026-04-01',
        periodValidTo: '2026-08-31',
      },
    })
    expect(parsed.title).toBe('Inicio de clases')
  })

  it('rejects end date before start', () => {
    expect(() =>
      createCalendarEventSchema.parse({
        title: 'X',
        eventType: 'Académico',
        startsOn: '2026-05-01',
        endsOn: '2026-04-01',
        scope: {
          domainCode: 'academic',
          profileTypeCode: 'presencial',
          studentTypeCode: 'NUEVO',
          periodLabel: 'Periodo',
        },
      }),
    ).toThrow()
  })
})
