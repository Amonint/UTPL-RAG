// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RagWorkbench } from '@/components/rag-workbench'

describe('RagWorkbench search flow', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows results only after typing and opens selected content in the detail panel', async () => {
    const user = userEvent.setup()

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.endsWith('/api/search-services')) {
          const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {}
          if (body.taxonomyOnly) {
            return {
              ok: true,
              json: async () => ({ taxonomy: [], results: [] }),
            }
          }
          return {
            ok: true,
            json: async () => ({
              taxonomy: [],
              results: [
                {
                  serviceId: 'item-1',
                  serviceName: 'Error en solicitud de certificados',
                  category: 'Certificados',
                  score: 0.9,
                  hasPdfs: false,
                  snippet: 'No se puede completar la solicitud.',
                  jsonPayload: {
                    content_type: 'incident',
                    question: 'Tengo error en solicitud de certificados',
                    answer: 'Verifica credenciales y vuelve a generar la solicitud.',
                  },
                },
              ],
            }),
          }
        }

        return {
          ok: true,
          json: async () => ({
            answer: 'Verifica credenciales y vuelve a generar la solicitud.',
            selectedService: null,
            usedSources: [],
            needsDisambiguation: false,
            serviceCandidates: [],
          }),
        }
      }),
    )

    render(<RagWorkbench />)

    expect(screen.queryByRole('button', { name: /error en solicitud/i })).toBeNull()

    await user.type(screen.getByRole('textbox'), 'certificado')

    const result = await screen.findByRole('button', { name: /error en solicitud de certificados/i })
    await user.click(result)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /volver al chat/i })).toBeTruthy()
      expect(screen.getByText(/verifica credenciales/i)).toBeTruthy()
    })

    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('returns to chat mode when clicking Volver al chat', async () => {
    const user = userEvent.setup()

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.endsWith('/api/search-services')) {
          const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {}
          if (body.taxonomyOnly) {
            return {
              ok: true,
              json: async () => ({ taxonomy: [], results: [] }),
            }
          }
          return {
            ok: true,
            json: async () => ({
              taxonomy: [],
              results: [
                {
                  serviceId: 'item-1',
                  serviceName: 'Error en solicitud de certificados',
                  category: 'Certificados',
                  score: 0.9,
                  hasPdfs: false,
                  jsonPayload: {
                    answer: 'Verifica credenciales y vuelve a generar la solicitud.',
                  },
                },
              ],
            }),
          }
        }
        return { ok: true, json: async () => ({}) }
      }),
    )

    render(<RagWorkbench />)

    await user.type(screen.getByRole('textbox'), 'cert')
    const result = await screen.findByRole('button', { name: /error en solicitud de certificados/i })
    await user.click(result)

    await user.click(screen.getByRole('button', { name: /volver al chat/i }))

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeTruthy()
    })
    expect(screen.queryByRole('button', { name: /volver al chat/i })).toBeNull()
  })
})
