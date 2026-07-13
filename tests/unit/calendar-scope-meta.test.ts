import { describe, expect, it } from 'vitest'

import { decodeScopeMeta, encodeScopeMeta } from '@/lib/calendar/event-scope-meta'

describe('calendar event scope meta', () => {
  it('round-trips scope json in details_text', () => {
    const meta = {
      domainCode: 'academic',
      profileTypeCode: 'presencial',
      studentTypeCode: 'NUEVO',
      periodLabel: 'Abril – Agosto 2026',
    }
    const encoded = encodeScopeMeta(meta)
    expect(decodeScopeMeta(encoded)).toEqual(meta)
  })

  it('returns null for plain text details', () => {
    expect(decodeScopeMeta('Notas del cronograma')).toBeNull()
  })
})
