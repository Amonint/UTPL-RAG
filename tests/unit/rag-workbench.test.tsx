// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RagWorkbench } from '@/components/rag-workbench'

describe('RagWorkbench', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('submits a query with Enter and renders the assistant reply in the thread', async () => {
    const user = userEvent.setup()

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
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
      }),
    )

    render(<RagWorkbench />)

    const textbox = screen.getByRole('textbox')
    await user.type(textbox, '¿Cómo solicito retiro voluntario?{enter}')

    await waitFor(() => {
      expect(screen.getByText('Debes completar el formato de retiro voluntario.')).toBeTruthy()
    })
  })
})
