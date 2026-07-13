'use client'

import { useEffect, useState } from 'react'

/**
 * Returns whether `query` matches. Always starts as `false` so SSR and the
 * first client paint agree; the real value is applied after mount.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)
    const sync = () => setMatches(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [query])

  return matches
}
