import { describe, expect, it } from 'vitest'

import { createItemSchema, editorialStatusSchema, patchCalendarEventStatusSchema } from '@/lib/admin/validation'
import { calendarEventEditorialStatus } from '@/lib/calendar/event-scope-meta'

describe('admin validation', () => {
  it('accepts editorial statuses from db check', () => {
    expect(editorialStatusSchema.parse('published')).toBe('published')
  })

  it('requires question and answer on create', () => {
    const result = createItemSchema.safeParse({
      kbElementId: '00000000-0000-4000-8000-000000000001',
      domainId: '00000000-0000-4000-8000-000000000002',
      title: 'Test',
      questionText: 'Q?',
      answerText: 'A.',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty answer', () => {
    const result = createItemSchema.safeParse({
      kbElementId: '00000000-0000-4000-8000-000000000001',
      domainId: '00000000-0000-4000-8000-000000000002',
      title: 'Test',
      questionText: 'Q?',
      answerText: '',
    })
    expect(result.success).toBe(false)
  })

  it('acepta cambio de estado de calendario a publicado o revisión', () => {
    expect(patchCalendarEventStatusSchema.parse({ editorialStatus: 'published' })).toEqual({
      editorialStatus: 'published',
    })
    expect(patchCalendarEventStatusSchema.parse({ editorialStatus: 'review' })).toEqual({
      editorialStatus: 'review',
    })
    expect(patchCalendarEventStatusSchema.safeParse({ editorialStatus: 'archived' }).success).toBe(
      false,
    )
  })

  it('trata eventos sin estado como publicados', () => {
    expect(calendarEventEditorialStatus(null)).toBe('published')
    expect(calendarEventEditorialStatus({ editorialStatus: 'review' })).toBe('review')
    expect(calendarEventEditorialStatus({ editorialStatus: 'published' })).toBe('published')
  })
})
