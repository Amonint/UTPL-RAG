import { describe, expect, it } from 'vitest'

import { createItemSchema, editorialStatusSchema } from '@/lib/admin/validation'

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
})
