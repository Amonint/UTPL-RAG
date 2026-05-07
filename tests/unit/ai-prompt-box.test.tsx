// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AIPromptBox } from '@/components/ui/ai-prompt-box'

describe('AIPromptBox', () => {
  it('submits on Enter and keeps Shift+Enter available for line breaks', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const onValueChange = vi.fn()

    render(
      <AIPromptBox
        value="Hola"
        onValueChange={onValueChange}
        onSubmit={onSubmit}
        isLoading={false}
        placeholder="Pregunta"
      />,
    )

    const textbox = screen.getByRole('textbox')
    await user.click(textbox)
    await user.keyboard('{Enter}')

    expect(onSubmit).toHaveBeenCalledTimes(1)
  })
})
