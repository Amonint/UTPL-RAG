// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RagWorkbench } from '@/components/rag-workbench'

describe('RagWorkbench', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not render internal panel headings', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.endsWith('/api/search-services')) {
          const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {}
          if (body.taxonomyOnly) {
            return { ok: true, json: async () => ({ results: [], taxonomy: [] }) }
          }
        }
        return { ok: true, json: async () => ({ results: [], taxonomy: [] }) }
      }),
    )

    render(<RagWorkbench />)

    expect(screen.queryByText('Panel de consulta')).toBeNull()
    expect(screen.queryByText('Navegación por servicios')).toBeNull()
    expect(screen.queryByText('Panel de búsqueda')).toBeNull()
    expect(screen.queryByText('Buscador de servicios')).toBeNull()
  })

  it('shows live suggestions while typing', async () => {
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
          expect(body.category).toBeUndefined()
          expect(body.subcategory).toBeUndefined()
          expect(body.element).toBeUndefined()
          return {
            ok: true,
            json: async () => ({
              results: [
                {
                  serviceId: 'servicios-matricula__solicitar-retiro-voluntario',
                  serviceName: 'Solicitar retiro voluntario',
                  category: 'SERVICIOS-MATRÍCULA',
                  score: 0.98,
                  hasPdfs: true,
                },
              ],
            }),
          }
        }

        return {
          ok: true,
          json: async () => ({
            answer: 'Debes completar el formato de retiro voluntario.',
            selectedService: {
              serviceId: 'servicios-matricula__solicitar-retiro-voluntario',
              serviceName: 'Solicitar retiro voluntario',
              category: 'SERVICIOS-MATRÍCULA',
              studentTypes: ['CONTINUO'],
            },
            usedSources: [],
            needsDisambiguation: false,
            serviceCandidates: [],
          }),
        }
      }),
    )

    render(<RagWorkbench />)

    const textbox = screen.getByRole('textbox')
    await user.type(textbox, 'retiro voluntario')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /solicitar retiro voluntario/i })).toBeTruthy()
    })
  })
})
