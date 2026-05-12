/** @vitest-environment jsdom */
import { render } from '@testing-library/react'
import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import goldenQueries from '../fixtures/golden-queries.json'

const { generateServiceAnswerWithGeminiMock } = vi.hoisted(() => ({
  generateServiceAnswerWithGeminiMock: vi.fn(async () => 'La información disponible corresponde al PDF de retiro voluntario.'),
}))

vi.mock('@/lib/data', () => ({
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
      {
        serviceId: 'servicios-matricula__tramite-con-pdf',
        serviceName: 'Trámite con PDF',
        category: 'SERVICIOS-MATRÍCULA',
        studentTypes: ['CONTINUO'],
        jsonPayload: { descripcion: 'Tiene PDF' },
        pdfRefs: [
          {
            label: 'Formato retiro',
            url: 'https://portales.utpl.edu.ec/sites/default/files/ejemplo.pdf',
            localPath: 'data/pdfs/mock.pdf',
            sourcePath: 'manual.0',
          },
        ],
      },
    ],
    chunks: [],
  }),
}))

vi.mock('@/lib/rag/gemini-service-qa', () => ({
  generateServiceAnswerWithGemini: generateServiceAnswerWithGeminiMock,
}))

import { POST } from '@/app/api/rag/route'
import HomePage from '@/app/page'

describe('POST /api/rag', () => {
  it('rechaza servicios sin PDFs', async () => {
    generateServiceAnswerWithGeminiMock.mockClear()

    const request = new Request('http://localhost/api/rag', {
      method: 'POST',
      body: JSON.stringify({
        question: 'Necesito informacion del tramite',
        selectedServiceId: 'servicios-matricula__solicitar-retiro-voluntario',
        selectedPdfIds: ['manual.0'],
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(generateServiceAnswerWithGeminiMock).not.toHaveBeenCalled()
    expect(typeof body.message).toBe('string')
  })

  it('llama a Gemini cuando hay PDFs y selectedPdfIds válidos', async () => {
    generateServiceAnswerWithGeminiMock.mockClear()

    const request = new Request('http://localhost/api/rag', {
      method: 'POST',
      body: JSON.stringify({
        question: '¿Qué requisitos hay?',
        selectedServiceId: 'servicios-matricula__tramite-con-pdf',
        selectedPdfIds: ['manual.0'],
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.selectedService.serviceId).toBe('servicios-matricula__tramite-con-pdf')
    expect(generateServiceAnswerWithGeminiMock).toHaveBeenCalledTimes(1)
    expect(body.usedSources.some((item: { sourceKind: string }) => item.sourceKind === 'pdf')).toBe(true)
    expect(body.answer).toContain('PDF de retiro voluntario')
  })
})

describe('HomePage', () => {
  it('renderiza el contenedor principal del chat', () => {
    const { container } = render(React.createElement(HomePage))
    const main = container.querySelector('main')
    expect(main).toBeTruthy()
    expect(main?.className).toContain('mx-auto')
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
