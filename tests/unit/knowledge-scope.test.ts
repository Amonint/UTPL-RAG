import { describe, expect, it } from 'vitest'

import { buildKnowledgeScopeParts, formatKnowledgeScopeLine } from '@/lib/kb/audience-labels'

describe('knowledge scope line', () => {
  it('muestra área, modalidad, tipo y periodo en orden', () => {
    const line = formatKnowledgeScopeLine({
      payload: {
        domain_name: 'Estudiantes',
        modality: 'presencial',
        student_lifecycle: 'NUEVO',
        period_label: 'Abril – agosto 2026',
        applies_to_all: false,
      },
      studentTypes: ['NUEVO'],
    })

    expect(line).toBe('Estudiantes · Presencial · Nuevo · Abril – agosto 2026')
  })

  it('usa categoría como área si no hay dominio', () => {
    const parts = buildKnowledgeScopeParts({
      payload: {
        category: 'Matrícula',
        applies_to_all: true,
      },
    })

    expect(parts).toEqual(['Matrícula', 'Todas las modalidades', 'Todos los tipos'])
  })

  it('no repite la sección Servicios e Incidencias', () => {
    const line = formatKnowledgeScopeLine({
      payload: {
        section_code: 'faq',
        category: 'Idiomas',
        modality: 'en_linea',
        applies_to_all: false,
      },
    })

    expect(line).not.toContain('Servicios e Incidencias')
    expect(line).toContain('Idiomas')
    expect(line).toContain('En línea')
  })
})
