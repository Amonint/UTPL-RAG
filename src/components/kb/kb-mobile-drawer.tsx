'use client'

import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  className?: string
}

export function KbMobileDrawer({ open, title, onClose, children, className }: Props) {
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
      <button
        type="button"
        aria-label="Cerrar panel"
        className="absolute inset-0 bg-obsidian/45"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'absolute inset-y-0 left-0 flex w-[min(100vw-2.5rem,22.5rem)] flex-col border-r border-chalk bg-white shadow-[4px_0_24px_rgba(0,0,0,0.12)]',
          className,
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-chalk px-3 py-3">
          <p className="m-0 truncate text-sm font-medium text-obsidian">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-chalk text-obsidian transition hover:bg-eggshell"
            aria-label="Cerrar"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </aside>
    </div>
  )
}
