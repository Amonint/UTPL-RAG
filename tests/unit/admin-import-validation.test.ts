import { describe, expect, it } from 'vitest'

import { geminiImportResultSchema } from '@/lib/admin/validation'

describe('gemini import validation', () => {
  it('acepta bloques FAQ e Información válidos', () => {
    const result = geminiImportResultSchema.safeParse({
      blocks: [
        {
          sectionCode: 'faq',
          taxonomy: {
            domainCode: 'academic',
            categorySlug: 'matriculas',
            subcategorySlug: 'general',
            elementSlug: 'proceso',
          },
          title: 'Matrícula',
          questionText: '¿Cómo me matriculo?',
          answerText: 'Debe seguir estos pasos.',
        },
        {
          sectionCode: 'general_info',
          taxonomy: {
            domainCode: 'academic',
            categorySlug: 'calendario',
            subcategorySlug: 'periodo',
            elementSlug: 'fechas',
          },
          title: 'Calendario',
          subtitle: 'Abril-agosto 2026',
          periodCode: 'ABR_AGO_2026',
          validFrom: '2026-04-01',
          validTo: '2026-08-31',
          answerText: 'Contenido informativo.',
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rechaza fechas inválidas', () => {
    const result = geminiImportResultSchema.safeParse({
      blocks: [
        {
          sectionCode: 'general_info',
          taxonomy: {
            domainCode: 'academic',
            categorySlug: 'calendario',
            subcategorySlug: 'periodo',
            elementSlug: 'fechas',
          },
          title: 'Calendario',
          validFrom: '01/04/2026',
          answerText: 'Contenido.',
        },
      ],
    })
    expect(result.success).toBe(false)
  })
})
