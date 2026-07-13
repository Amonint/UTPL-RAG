// @vitest-environment jsdom
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useMediaQuery } from '@/hooks/use-media-query'

function stubMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>()
  const media = {
    matches,
    media: '(min-width: 1024px)',
    addEventListener: (_event: string, listener: () => void) => {
      listeners.add(listener)
    },
    removeEventListener: (_event: string, listener: () => void) => {
      listeners.delete(listener)
    },
  }
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => media),
  )
  return {
    setMatches(next: boolean) {
      media.matches = next
      listeners.forEach((listener) => listener())
    },
  }
}

function Probe({
  onRender,
}: {
  onRender: (matches: boolean) => void
}) {
  const matches = useMediaQuery('(min-width: 1024px)')
  onRender(matches)
  return <span data-testid="mq">{String(matches)}</span>
}

describe('useMediaQuery', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('starts false on first paint even when the media query already matches', async () => {
    stubMatchMedia(true)
    const paints: boolean[] = []

    render(<Probe onRender={(value) => paints.push(value)} />)

    // First paint must match SSR (false) so hydration does not diverge.
    expect(paints[0]).toBe(false)

    await waitFor(() => {
      expect(paints.at(-1)).toBe(true)
    })
  })

  it('updates when the media query match changes', async () => {
    const control = stubMatchMedia(false)
    const paints: boolean[] = []

    render(<Probe onRender={(value) => paints.push(value)} />)

    await waitFor(() => {
      expect(paints.at(-1)).toBe(false)
    })

    act(() => {
      control.setMatches(true)
    })

    await waitFor(() => {
      expect(paints.at(-1)).toBe(true)
    })
  })
})
