import { describe, expect, it, vi } from 'vitest'
import goldenQueries from '../fixtures/golden-queries.json'

const { generateGroundedAnswerMock } = vi.hoisted(() => ({
  generateGroundedAnswerMock: vi.fn(
    async () => 'La información disponible corresponde a retiro voluntario.',
  ),
}))

vi.mock('@/lib/data/load-artifacts', () => ({
  loadArtifacts: async () => ({
    services: [
      {
        serviceId: 'servicios-matricula__solicitar-retiro-voluntario',
        serviceName: 'Solicitar retiro voluntario',
        category: 'SERVICIOS-MATRÍCULA',
        studentTypes: ['CONTINUO'],
        jsonPayload: { descripcion: 'Trámite de retiro voluntario' },
        pdfRefs: [],
      },
    ],
    chunks: [
      {
        chunkId: 'servicios-matricula__solicitar-retiro-voluntario::json',
        serviceId: 'servicios-matricula__solicitar-retiro-voluntario',
        sourceKind: 'json',
        text: 'Servicio: Solicitar retiro voluntario',
        metadata: {},
      },
      {
        chunkId: 'servicios-matricula__solicitar-retiro-voluntario::manual.pdf::1',
        serviceId: 'servicios-matricula__solicitar-retiro-voluntario',
        sourceKind: 'pdf',
        text: 'Manual de retiro voluntario',
        metadata: {},
      },
    ],
  }),
}))

vi.mock('@/lib/rag/generate-answer', () => ({
  generateGroundedAnswer: generateGroundedAnswerMock,
}))

import { POST } from '@/app/api/rag/route'
import HomePage from '@/app/page'

describe('POST /api/rag', () => {
  it('returns a JSON-only answer when selectedServiceId is provided with allowPdf false', async () => {
    generateGroundedAnswerMock.mockClear()

    const request = new Request('http://localhost/api/rag', {
      method: 'POST',
      body: JSON.stringify({
        question: 'Necesito informacion del tramite',
        selectedServiceId: 'servicios-matricula__solicitar-retiro-voluntario',
        allowPdf: false,
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(generateGroundedAnswerMock).not.toHaveBeenCalled()
    expect(body.usedSources).toHaveLength(1)
    expect(body.usedSources[0]?.sourceKind).toBe('json')
    expect(body.answer).toContain('Servicio: Solicitar retiro voluntario')
  })

  it('returns an answer with selected service and evidence', async () => {
    generateGroundedAnswerMock.mockClear()

    const request = new Request('http://localhost/api/rag', {
      method: 'POST',
      body: JSON.stringify({
        question: '¿Cómo solicito retiro voluntario?',
        selectedServiceId: 'servicios-matricula__solicitar-retiro-voluntario',
        allowPdf: true,
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.selectedService.serviceId).toBe('servicios-matricula__solicitar-retiro-voluntario')
    expect(generateGroundedAnswerMock).toHaveBeenCalledTimes(1)
    expect(body.usedSources.some((item: { sourceKind: string }) => item.sourceKind === 'pdf')).toBe(true)
  })
})

describe('HomePage', () => {
  it('renders the minimal chat shell for UTPL questions', () => {
    const tree = HomePage()
    const serialized = JSON.stringify(tree)

    expect(serialized).toContain('UTPL service-linked RAG')
  })
})

describe('golden queries', () => {
  it('covers a no-pdf service, a single-pdf service, and a multi-pdf service', () => {
    expect(goldenQueries.map((item) => item.kind)).toEqual([
      'no-pdf',
      'single-pdf',
      'multi-pdf',
      'ambiguous',
      'student-type-sensitive',
    ])
  })
})
