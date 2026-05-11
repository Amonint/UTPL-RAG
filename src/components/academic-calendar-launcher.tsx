'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState } from 'react'

const AcademicCalendar = dynamic(() => import('@/components/calendar'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[50vh] items-center justify-center text-[var(--color-gravel)]">
      Cargando calendario…
    </div>
  ),
})

export function AcademicCalendarLauncher() {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, close])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed top-4 right-4 z-40 rounded-full border border-[var(--color-chalk)] bg-[var(--color-eggshell)] px-4 py-2.5 text-sm font-semibold text-[var(--color-cinder)] shadow-md transition hover:bg-[var(--color-powder)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cinder)] md:top-6 md:right-6 md:px-5 md:text-[0.9375rem]"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        Calendario académico
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] md:p-6"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-[var(--color-obsidian)]/45 backdrop-blur-[2px]"
            aria-label="Cerrar calendario"
            onClick={close}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Calendario académico UTPL"
            className="relative z-10 mt-0 flex max-h-[min(92vh,920px)] w-full max-w-[min(1180px,calc(100vw-16px))] flex-col overflow-hidden rounded-2xl border border-[var(--color-chalk)] bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-center justify-end gap-2 border-b border-[var(--color-chalk)] bg-[var(--color-eggshell)] px-3 py-2 md:px-4">
              <button
                type="button"
                onClick={close}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-[var(--color-cinder)] hover:bg-[var(--color-powder)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cinder)]"
              >
                Cerrar
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <AcademicCalendar />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
