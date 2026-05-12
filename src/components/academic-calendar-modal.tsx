'use client'

import dynamic from 'next/dynamic'
import { X } from 'lucide-react'
import { useCallback, useEffect } from 'react'

const AcademicCalendar = dynamic(() => import('@/components/calendar'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-[#003978]/70">
      Cargando calendario…
    </div>
  ),
})

export function AcademicCalendarModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const close = useCallback(() => onClose(), [onClose])

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

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] md:p-6"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-obsidian/45 backdrop-blur-[2px]"
        aria-label="Cerrar calendario"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Calendario académico UTPL"
        className="relative z-10 mt-0 flex max-h-[min(92vh,920px)] w-full max-w-[min(1180px,calc(100vw-16px))] flex-col overflow-hidden rounded-lg border border-[#003978]/20 bg-white shadow-[0_24px_64px_rgba(0,57,120,0.12)]"
      >
        <div className="flex shrink-0 items-center justify-end border-b border-white/10 bg-[#003978] px-3 py-2.5 md:px-4">
          <button
            type="button"
            onClick={close}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded text-white/90 transition hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            aria-label="Cerrar"
          >
            <X className="size-5" strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white">
          <AcademicCalendar />
        </div>
      </div>
    </div>
  )
}
