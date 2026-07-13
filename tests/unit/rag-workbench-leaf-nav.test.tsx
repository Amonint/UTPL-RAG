// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RagWorkbench } from '@/components/rag-workbench'

function mockMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
}

function stubSearchFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (!url.endsWith('/api/search-services')) {
        return { ok: true, json: async () => ({}) }
      }

      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {}

      if (body.taxonomyOnly) {
        return {
          ok: true,
          json: async () => ({
            taxonomy: [
              {
                slug: 'admision',
                name: 'Admisión',
                count: 1,
                subcategories: [
                  {
                    slug: 'general',
                    name: 'General',
                    count: 1,
                    elements: [{ slug: 'publico-objetivo', name: 'Público objetivo', count: 1 }],
                  },
                ],
              },
            ],
            results: [],
          }),
        }
      }

      if (body.element === 'publico-objetivo') {
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                serviceId: 'adm-1',
                serviceName: 'Público objetivo de admisión',
                category: 'Admisión',
                score: 1,
                hasPdfs: false,
                jsonPayload: {
                  content_type: 'faq',
                  answer: 'Estudiantes de bachillerato y transferencia.',
                },
              },
            ],
          }),
        }
      }

      return { ok: true, json: async () => ({ results: [], taxonomy: [] }) }
    }),
  )
}

describe('RagWorkbench leaf navigation', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('opens detail panel when clicking a leaf on desktop', async () => {
    mockMatchMedia(true)
    stubSearchFetch()
    const user = userEvent.setup()

    render(<RagWorkbench />)

    const leaf = await screen.findByRole('button', { name: /público objetivo/i })
    await user.click(leaf)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /volver al chat/i })).toBeTruthy()
      expect(screen.getByText(/estudiantes de bachillerato/i)).toBeTruthy()
    })
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('keeps chat visible and shows detail in the drawer on mobile', async () => {
    mockMatchMedia(false)
    stubSearchFetch()
    const user = userEvent.setup()

    render(<RagWorkbench />)

    await user.click(screen.getByRole('button', { name: /explorar base de conocimiento/i }))

    const leaf = await screen.findByRole('button', { name: /público objetivo/i })
    await user.click(leaf)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /volver al índice/i })).toBeTruthy()
      expect(screen.getByText(/estudiantes de bachillerato/i)).toBeTruthy()
    })
    expect(screen.getByRole('textbox')).toBeTruthy()
  })
})
