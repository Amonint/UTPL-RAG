import { describe, expect, it } from 'vitest'

import { advisorCreateItemSchema } from '@/lib/admin/validation'

const domainId = '11111111-1111-4111-8111-111111111111'
const subcategoryId = '22222222-2222-4222-8222-222222222222'

describe('advisorCreateItemSchema', () => {
  it('accepts FAQ with question and answer', () => {
    const parsed = advisorCreateItemSchema.parse({
      sectionCode: 'faq',
      domainId,
      subcategoryId,
      questionText: '¿Cuándo son las matrículas?',
      answerText: 'Las matrículas inician en abril según el calendario oficial.',
    })
    expect(parsed.sectionCode).toBe('faq')
    expect(parsed.questionText).toContain('matrículas')
  })

  it('accepts Información with title and content', () => {
    const parsed = advisorCreateItemSchema.parse({
      sectionCode: 'general_info',
      domainId,
      subcategoryId,
      title: 'Guía de matrículas',
      answerText: 'Pasos para matricularse en el periodo vigente.',
    })
    expect(parsed.sectionCode).toBe('general_info')
    expect(parsed.title).toBe('Guía de matrículas')
  })

  it('rejects FAQ without question', () => {
    expect(() =>
      advisorCreateItemSchema.parse({
        sectionCode: 'faq',
        domainId,
        subcategoryId,
        answerText: 'Solo respuesta sin pregunta válida aquí.',
      }),
    ).toThrow()
  })

  it('rejects Información without title', () => {
    expect(() =>
      advisorCreateItemSchema.parse({
        sectionCode: 'general_info',
        domainId,
        subcategoryId,
        answerText: 'Contenido sin título suficiente para guardar.',
      }),
    ).toThrow()
  })
})
