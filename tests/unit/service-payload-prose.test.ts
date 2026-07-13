import { describe, expect, it } from 'vitest'

import { INTERNAL_PAYLOAD_KEYS, payloadForDisplay } from '@/components/service-payload-prose'

describe('payloadForDisplay', () => {
  it('strips internal taxonomy and db metadata', () => {
    const raw = {
      category: 'Entorno Virtual de Aprendizaje',
      category_slug: 'entorno-virtual-de-aprendizaje',
      subcategory: 'Visualización de materias en el EVA',
      subcategory_slug: 'visualizacion-de-materias-en-el-eva',
      element: 'No se visualizan componentes (razones)',
      element_slug: 'no-se-visualizan-componentes-razones',
      question: 'A que se debe que un estudiante no visualice sus materias en el EVA',
      answer: 'Puede deberse a varios factores.',
      content_type: 'faq',
      source: 'canonical_db',
      section_code: 'general_info',
      domain_code: 'financial',
      domain_name: 'Financiero',
      service_category_code: 'servicios-financieros',
      modality: 'en_linea',
      program_level: null,
      student_lifecycle: null,
      applies_to_all: false,
      requisitos: 'Pago de matrícula',
    }

    const display = payloadForDisplay(raw)
    expect(display).toEqual({ requisitos: 'Pago de matrícula' })
    expect(INTERNAL_PAYLOAD_KEYS.has('source')).toBe(true)
    expect(INTERNAL_PAYLOAD_KEYS.has('category_slug')).toBe(true)
    expect(INTERNAL_PAYLOAD_KEYS.has('section_code')).toBe(true)
    expect(INTERNAL_PAYLOAD_KEYS.has('domain_code')).toBe(true)
  })
})
