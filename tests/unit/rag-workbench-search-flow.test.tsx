// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { RagWorkbench } from '@/components/rag-workbench'

describe('RagWorkbench search flow', () => {
  it('searches first, allows selecting a service, then queries /api/rag in service context', async () => {
    const user = userEvent.setup()

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.endsWith('/api/search-services')) {
        return new Response(
          JSON.stringify({
            results: [
              {
                serviceId: 'servicios-matricula__solicitar-retiro-voluntario',
                serviceName: 'Solicitar retiro voluntario',
                category: 'SERVICIOS-MATRICULA',
                score: 0.97,
                hasPdfs: true,
                snippet: 'Tramite con soporte documental',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      if (url.endsWith('/api/rag')) {
        return new Response(
          JSON.stringify({
            answer: 'Respuesta de prueba',
            selectedService: {
              serviceId: 'servicios-matricula__solicitar-retiro-voluntario',
              serviceName: 'Solicitar retiro voluntario',
              category: 'SERVICIOS-MATRICULA',
              studentTypes: ['CONTINUO'],
            },
            usedSources: [],
            needsDisambiguation: false,
            serviceCandidates: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 })
    })

    vi.stubGlobal('fetch', fetchMock)

    render(<RagWorkbench />)

    const searchTextarea = screen.getByRole('textbox')
    await user.type(searchTextarea, 'retiro voluntario')

    const resultButton = await screen.findByRole('button', { name: /solicitar retiro voluntario/i })
    await user.click(resultButton)

    const followupTextarea = screen.getByRole('textbox')
    await user.type(followupTextarea, 'cual es el costo')
    await user.keyboard('{Enter}')

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    const secondCall = fetchMock.mock.calls[1]
    expect(String(secondCall?.[0])).toBe('/api/rag')
    expect(secondCall?.[1]?.method).toBe('POST')

    const parsedBody = JSON.parse(String(secondCall?.[1]?.body))
    expect(parsedBody).toMatchObject({
      question: 'cual es el costo',
      selectedServiceId: 'servicios-matricula__solicitar-retiro-voluntario',
      allowPdf: false,
    })
  })
})
