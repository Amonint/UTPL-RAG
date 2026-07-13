import { describe, expect, it } from 'vitest'

import { classifyGuideTopic, rawBlocksToGuideSegments } from '../../scripts/lib/utpl-matriculas-guides-parse'
import { taxonomyForGuideTopic } from '../../scripts/lib/utpl-matriculas-guides-taxonomy'

describe('utpl-matriculas-guides-parse', () => {
  it('clasifica inscripción presencial', () => {
    expect(classifyGuideTopic('Revisa el proceso de inscripción👌', 'presencial', '')).toBe('inscripcion')
  })

  it('clasifica proceso de matrícula continuos', () => {
    expect(
      classifyGuideTopic('Revisa el proceso de matrícula para estudiantes continuos', 'presencial', ''),
    ).toBe('proceso_matricula')
  })

  it('clasifica planes de pago', () => {
    expect(classifyGuideTopic('Plan de pagos', 'enlinea', 'Paga 50% al momento de la matrícula')).toBe(
      'pagos_planes',
    )
  })

  it('mapea taxonomía a Matriculas / Inscripcion', () => {
    const row = taxonomyForGuideTopic('inscripcion', 'Proceso de inscripción — presencial', 'x')
    expect(row?.categorySlug).toBe('matriculas')
    expect(row?.subcategorySlug).toBe('inscripcion')
  })

  it('mapea pagos a Pagos / Planes y descuentos', () => {
    const row = taxonomyForGuideTopic('pagos_planes', 'Plan de pagos', 'x')
    expect(row?.categorySlug).toBe('pagos')
    expect(row?.subcategorySlug).toBe('planes-y-descuentos')
  })

  it('descarta bloques vacíos', () => {
    const { segments } = rawBlocksToGuideSegments([
      {
        tab_id: 'presencial',
        block_kind: 'modal',
        trigger_label: 'Ver oferta',
        body_text: 'Ver oferta',
        body_html: '',
        images: [],
        links: [],
      },
    ])
    expect(segments).toHaveLength(0)
  })
})
