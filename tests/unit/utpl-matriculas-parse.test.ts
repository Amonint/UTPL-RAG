import { describe, expect, it } from 'vitest'

import {
  blocksToSegments,
  buildEventsFromBlock,
  inferEventTypeUi,
  inferStudentTypesFromLine,
  resolvePeriodFromText,
  sha1Hex,
} from '../../scripts/lib/utpl-matriculas-parse'
import type { RawScrapedBlock } from '../../scripts/lib/utpl-matriculas-types'

describe('utpl-matriculas-parse', () => {
  it('resuelve periodo abril-agosto 2026', () => {
    const period = resolvePeriodFromText('Periodo abril - agosto 2026')
    expect(period?.label).toBe('Abril – Agosto 2026')
    expect(period?.validFrom).toBe('2026-04-01')
    expect(period?.validTo).toBe('2026-08-31')
  })

  it('clasifica matrículas ordinarias', () => {
    expect(inferEventTypeUi('Matrículas ordinarias: desde el 19 de noviembre de 2025 al 1 de abril de 2026')).toBe(
      'Matrículas',
    )
    expect(inferEventTypeUi('Inicio de actividades académicas: 6 de abril de 2026')).toBe('Académico')
    expect(inferEventTypeUi('Confirmación de cupo: desde el 20 de enero al 5 de marzo de 2026')).toBe('Trámite')
  })

  it('infiere tipos de estudiante', () => {
    expect(inferStudentTypesFromLine('Matrícula ordinaria (continuos)')).toEqual(['CONTINUO'])
    expect(inferStudentTypesFromLine('Matrícula extraordinaria (n y c)')).toEqual(['NUEVO', 'CONTINUO'])
  })

  it('parsea fechas de bullet a eventos', () => {
    const warnings: string[] = []
    const period = {
      label: 'Abril – Agosto 2026',
      validFrom: '2026-04-01',
      validTo: '2026-08-31',
    }
    const events = buildEventsFromBlock(
      ['Matrículas ordinarias: desde el 19 de noviembre de 2025 al 1 de abril de 2026'],
      ['en_linea'],
      ['NUEVO'],
      period,
      'academic',
      warnings,
    )
    expect(warnings).toHaveLength(0)
    expect(events).toHaveLength(1)
    expect(events[0].starts_on).toBe('2025-11-19')
    expect(events[0].ends_on).toBe('2026-04-01')
    expect(events[0].event_type_ui).toBe('Matrículas')
    expect(events[0].scope.periodLabel).toBe('Abril – Agosto 2026')
  })

  it('hash estable por segmento', () => {
    expect(sha1Hex('texto fijo')).toHaveLength(40)
  })

  it('excluye segmento de navegación del sitio', () => {
    const navBlock: RawScrapedBlock = {
      path: ['Matrículas UTPL'],
      lines: [
        'Carreras a distancia y en línea',
        'Carreras presencial',
        'Carreras tecnológicas',
        'Posgrados',
        'Becas',
        'Formación permanente',
        'Noticias',
        'Trabaja con nosotros',
        'Eventos',
      ],
      links: Array.from({ length: 10 }, (_, i) => ({
        title: `Link ${i}`,
        url: `https://www.utpl.edu.ec/l${i}`,
      })),
    }
    const { segments } = blocksToSegments([navBlock])
    expect(segments.some((s) => s.segment_id.includes('general-sin-periodo'))).toBe(false)
  })
})
