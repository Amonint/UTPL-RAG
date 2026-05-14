import { describe, expect, it } from 'vitest'

import { parseTextractCleanText } from '../../scripts/lib/textract-clean-document-parser'
import { extractEventsByConfidence } from '../../scripts/lib/utpl-events-by-confidence'

const SAMPLE = `
===== DOCUMENTO 1: sample_doc.txt =====
[METADATA]
archivo: Calendario académico_TEC_EL_Estudiantes_202630.pdf
ruta: doop/sample.pdf
bytes: 1234

=== PÁGINA 1 ===
[TEXTO LIBRE]
UTPL
Vicerrectorado Académico
Actividad | Inicio | Fin
Junio 2026
Publicación de resultados en junio 2026
[TABLA 1]
HEADER: Actividad | Inicio | Fin
## Matrículas
Inscripción ordinaria | 02/03/2026 | 31/03/2026
Evaluación parcial | 13/06/2026 | 14/06/2026
[TABLA 2]
HEADER: Nombre de tarea | Responsables | Comienzo | Fin | Comienzo | Fin | Comienzo | Fin
## Evaluaciones
Primera evaluación | Docentes | 30/05/26 | 31/05/26 |  |  | 30/05/26 | 31/05/26
`

describe('textract clean parser', () => {
  it('parsea documentos, metadata, tablas y filas', () => {
    const docs = parseTextractCleanText(SAMPLE)
    expect(docs).toHaveLength(1)
    expect(docs[0].metadata.archivo).toContain('Calendario académico')
    expect(docs[0].pages).toHaveLength(1)
    expect(docs[0].pages[0].tables).toHaveLength(2)
    expect(docs[0].pages[0].tables[0].rows).toHaveLength(2)
  })
})

describe('extractor por confianza', () => {
  it('separa alta, media y baja precision con reglas conservadoras', () => {
    const docs = parseTextractCleanText(SAMPLE)
    const out = extractEventsByConfidence(docs, { targetYear: 2026 })

    expect(out.alta_precision.length).toBeGreaterThanOrEqual(2)
    expect(
      out.alta_precision.some(
        (x) =>
          x.titulo.toLowerCase().includes('inscripción ordinaria') &&
          x.inicio === '2026-03-02' &&
          x.fin === '2026-03-31',
      ),
    ).toBe(true)

    expect(
      out.media_precision.some(
        (x) =>
          x.titulo.toLowerCase().includes('primera evaluación') &&
          x.razonPrecision === 'tabla_compleja_multiples_fechas',
      ),
    ).toBe(true)

    expect(
      out.baja_precision_revision.some(
        (x) =>
          x.titulo.toLowerCase().includes('publicación de resultados en junio 2026') &&
          x.razonPrecision === 'texto_libre_mes_sin_dia',
      ),
    ).toBe(true)
  })

  it('deduplica feriados globalmente', () => {
    const text = `
===== DOCUMENTO 1: a.txt =====
[METADATA]
archivo: A.pdf
ruta: doop/a.pdf
bytes: 1
=== PÁGINA 1 ===
[TABLA 1]
HEADER: Evento | Inicio | Fin | Observación
Carnaval | 16/02/2026 | 17/02/2026 |
===== DOCUMENTO 2: b.txt =====
[METADATA]
archivo: B.pdf
ruta: doop/b.pdf
bytes: 1
=== PÁGINA 1 ===
[TABLA 1]
HEADER: Evento | Inicio | Fin | Observación
Carnaval | 16/02/2026 | 17/02/2026 |
`
    const docs = parseTextractCleanText(text)
    const out = extractEventsByConfidence(docs, { targetYear: 2026 })
    const carnival = out.alta_precision.filter((x) => x.titulo.toLowerCase().includes('carnaval'))
    expect(carnival).toHaveLength(1)
  })
})
