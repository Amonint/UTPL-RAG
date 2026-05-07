// @vitest-environment jsdom
import * as React from 'react'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AIPromptBox } from '@/components/ui/ai-prompt-box'

function PromptBoxHarness({
  initialValue = '',
  isLoading = false,
  onSubmit = vi.fn(),
}: {
  initialValue?: string
  isLoading?: boolean
  onSubmit?: () => void
}) {
  const [value, setValue] = React.useState(initialValue)

  return (
    <AIPromptBox
      value={value}
      onValueChange={setValue}
      onSubmit={onSubmit}
      isLoading={isLoading}
      placeholder="Pregunta"
    />
  )
}

describe('AIPromptBox', () => {
  it('submits on Enter and keeps Shift+Enter available for line breaks', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<PromptBoxHarness initialValue="Hola" onSubmit={onSubmit} />)

    const textbox = screen.getByLabelText('Pregunta por un trámite o servicio UTPL')
    const hint = screen.getByText('Enter envía · Shift+Enter salta línea')

    expect(textbox.getAttribute('aria-describedby')).toBe(hint.id)

    await user.click(textbox)
    await user.keyboard('{Shift>}{Enter}{/Shift}')

    expect(onSubmit).not.toHaveBeenCalled()
    expect(textbox).toHaveProperty('value', 'Hola\n')

    await user.keyboard('{Enter}')

    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('blocks submit when the input is trimmed-empty or loading', async () => {
    const user = userEvent.setup()
    const onEmptySubmit = vi.fn()

    const { unmount } = render(<PromptBoxHarness initialValue="   " onSubmit={onEmptySubmit} />)

    const textbox = screen.getByLabelText('Pregunta por un trámite o servicio UTPL')
    const sendButton = screen.getByRole('button', { name: 'Enviar consulta' })

    expect(sendButton).toHaveProperty('disabled', true)

    await user.click(textbox)
    await user.keyboard('{Enter}')

    expect(onEmptySubmit).not.toHaveBeenCalled()

    const onLoadingSubmit = vi.fn()

    unmount()
    render(<PromptBoxHarness initialValue="Hola" isLoading onSubmit={onLoadingSubmit} />)

    const loadingTextbox = screen.getByLabelText('Pregunta por un trámite o servicio UTPL')
    const loadingButton = screen.getByRole('button', { name: 'Enviar consulta' })

    expect(loadingButton).toHaveProperty('disabled', true)

    await user.click(loadingTextbox)
    await user.keyboard('{Enter}')

    expect(onLoadingSubmit).not.toHaveBeenCalled()
  })
})
