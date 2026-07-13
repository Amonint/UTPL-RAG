'use client'

import { type RefObject, useEffect } from 'react'

export function useClickOutside(ref: RefObject<HTMLElement | null>, callback: () => void) {
  useEffect(() => {
    function handlePointer(event: Event) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback()
      }
    }

    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('touchstart', handlePointer)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('touchstart', handlePointer)
    }
  }, [ref, callback])
}
