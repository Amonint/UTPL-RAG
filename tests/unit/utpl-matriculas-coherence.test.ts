import { describe, expect, it } from 'vitest'

import { evaluateEventCoherence } from '../../scripts/lib/utpl-matriculas-coherence'
import type { MatriculasCalendarEvent, MatriculasSegment } from '../../scripts/lib/utpl-matriculas-types'

function baseSegment(overrides: Partial<MatriculasSegment> = {}): MatriculasSegment {
  return {
    segment_id: 'carreras-a-distancia-abril-agosto-2026',
    block_kind: 'calendar',
    domain_code: 'academic',
    content_type: 'calendar',
    program_level_code: 'grado',
    profile_type_codes: ['distancia', 'en_linea'],
    student_type_codes: ['NUEVO'],
    period_preset_id: '2026-abr-ago',
    period_label: 'Abril – Agosto 2026',
    period_valid_from: '2026-04-01',
    period_valid_to: '2026-08-31',
    section_heading: 'Carreras a distancia y en línea',
    subsection: 'Carreras a distancia y en línea',
    admin_title: 'Carreras a distancia y en línea — Abril – Agosto 2026',
    body_markdown:
      '## Carreras a distancia y en línea\nMatrículas ordinarias: desde el 19 de noviembre de 2025 al 1 de abril de 2026',
    body_plain_hash: 'abc',
    events: [],
    links: [],
    audiences: [],
    ...overrides,
  }
}

function baseEvent(overrides: Partial<MatriculasCalendarEvent> = {}): MatriculasCalendarEvent {
  return {
    event_type_ui: 'Matrículas',
    title: 'Matrículas ordinarias',
    source_line: 'Matrículas ordinarias: desde el 19 de noviembre de 2025 al 1 de abril de 2026',
    starts_on: '2025-11-19',
    ends_on: '2026-04-01',
    scope: {
      domainCode: 'academic',
      profileTypeCode: 'distancia',
      studentTypeCode: 'NUEVO',
      periodLabel: 'Abril – Agosto 2026',
      periodValidFrom: '2026-04-01',
      periodValidTo: '2026-08-31',
    },
    ...overrides,
  }
}

describe('utpl-matriculas-coherence', () => {
  it('marca PASS cuando título, fechas y contexto son coherentes', () => {
    const result = evaluateEventCoherence(baseSegment(), baseEvent())
    expect(result.status).toBe('pass')
    expect(result.fail_reasons).toHaveLength(0)
  })

  it('marca FAIL si source_line no está en el segmento', () => {
    const result = evaluateEventCoherence(
      baseSegment({ body_markdown: '## Otro bloque\nSin fechas aquí' }),
      baseEvent(),
    )
    expect(result.status).toBe('fail')
    expect(result.fail_reasons.some((r) => r.includes('source_in_body'))).toBe(true)
  })

  it('marca FAIL si las fechas no coinciden con source_line', () => {
    const result = evaluateEventCoherence(
      baseSegment(),
      baseEvent({ starts_on: '2026-01-01', ends_on: '2026-01-02' }),
    )
    expect(result.status).toBe('fail')
    expect(result.fail_reasons.some((r) => r.includes('dates_in_line'))).toBe(true)
  })
})
