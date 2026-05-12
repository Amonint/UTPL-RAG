import { describe, expect, it } from 'vitest'

import {
  buildPdfChipGroups,
  buildPdfSelectionSnapshot,
  defaultSelectedPdfIds,
} from '@/lib/rag/pdf-selection-hierarchy'
import type { PdfRef } from '@/lib/types'

function ref(label: string, url: string, sourcePath: string): PdfRef {
  return {
    label,
    url,
    localPath: `data/pdfs/x-${sourcePath.replace(/\./g, '_')}.pdf`,
    sourcePath,
  }
}

describe('buildPdfChipGroups', () => {
  it('agrupa manuales y pestañas con subsecciones tituladas (estilo prácticum)', () => {
    const urlManual = 'https://portales.utpl.edu.ec/manual.pdf'
    const urlEcts = 'https://portales.utpl.edu.ec/ects.pdf'
    const urlRed = 'https://portales.utpl.edu.ec/red.pdf'
    const urlTec = 'https://portales.utpl.edu.ec/tec.pdf'

    const jsonPayload = {
      manual: [{ texto: 'Manual del trámite', url: urlManual }],
      requisitos_pestanas: [
        {
          pestaña: 'DISTANCIA',
          contenido: [
            {
              lista: [
                {
                  titulo: 'Estudiantes ECTS',
                  items: [{ texto: 'Administración de Empresas', pdf: urlEcts }],
                },
                {
                  titulo: 'Estudiantes REDISEÑO',
                  items: [{ texto: 'Administración de Empresas', pdf: urlRed }],
                },
              ],
            },
          ],
        },
        {
          pestaña: 'TECNOLOGÍAS',
          contenido: [
            {
              lista: [{ texto: 'Programas:' }, { lista: [{ texto: 'Prog A', pdf: urlTec }] }],
            },
          ],
        },
      ],
    }

    const pdfRefs: PdfRef[] = [
      ref('Manual del trámite', urlManual, 'manual.0'),
      ref('Administración de Empresas', urlEcts, 'requisitos_pestanas.0.contenido.0.lista.0.items.0.pdf'),
      ref('Administración de Empresas', urlRed, 'requisitos_pestanas.0.contenido.0.lista.1.items.0.pdf'),
      ref('Prog A', urlTec, 'requisitos_pestanas.1.contenido.0.lista.1.lista.0.pdf'),
    ]

    const groups = buildPdfChipGroups(jsonPayload, pdfRefs)

    expect(groups.map((g) => g.heading)).toEqual(['Manuales', 'DISTANCIA', 'TECNOLOGÍAS'])

    const dist = groups.find((g) => g.heading === 'DISTANCIA')!
    expect(dist.sections.map((s) => s.subsectionTitle)).toEqual(['Estudiantes ECTS', 'Estudiantes REDISEÑO'])
    expect(dist.sections[0]!.options[0]!.selectionId).toBe(
      'requisitos_pestanas.0.contenido.0.lista.0.items.0.pdf',
    )
    expect(dist.sections[1]!.options[0]!.selectionId).toBe(
      'requisitos_pestanas.0.contenido.0.lista.1.items.0.pdf',
    )

    const man = groups.find((g) => g.heading === 'Manuales')!
    expect(man.sections[0]!.options[0]!.selectionId).toBe('manual.0')

    const tec = groups.find((g) => g.heading === 'TECNOLOGÍAS')!
    expect(tec.sections[0]!.options[0]!.selectionId).toBe(
      'requisitos_pestanas.1.contenido.0.lista.1.lista.0.pdf',
    )
  })

  it('buildPdfSelectionSnapshot y defaultSelectedPdfIds para un solo PDF', () => {
    const url = 'https://portales.utpl.edu.ec/one.pdf'
    const payload = { nombre: 'Solo uno' }
    const pdfRefs = [ref('Único', url, 'manual.0')]
    const snap = buildPdfSelectionSnapshot(payload, pdfRefs)
    expect(snap.pdfCount).toBe(1)
    expect(defaultSelectedPdfIds(1, pdfRefs)).toEqual(['manual.0'])
  })
})
