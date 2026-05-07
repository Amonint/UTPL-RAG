'use client'

import * as React from 'react'

import { motion } from 'framer-motion'
import { ArrowUp } from 'lucide-react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'

import { cn } from '@/lib/utils'

interface AIPromptBoxProps {
  value: string
  onValueChange: (value: string) => void
  onSubmit: () => void
  isLoading?: boolean
  placeholder?: string
}

export function AIPromptBox({
  value,
  onValueChange,
  onSubmit,
  isLoading = false,
  placeholder = 'Escribe tu consulta',
}: AIPromptBoxProps) {
  const textareaId = React.useId()
  const hintId = React.useId()
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  React.useEffect(() => {
    const node = textareaRef.current

    if (!node) {
      return
    }

    node.style.height = 'auto'
    node.style.height = `${Math.min(node.scrollHeight, 160)}px`
  }, [value])

  const canSubmit = value.trim().length > 0 && !isLoading

  return (
    <TooltipPrimitive.Provider>
      <motion.div
        layout
        className="rounded-[28px] border border-chalk bg-white px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.08)]"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-chalk bg-powder px-3 py-1 text-[11px] uppercase tracking-[0.08em] text-gravel">
              Texto
            </span>
            <span id={hintId} className="text-xs text-slate">
              Enter envía · Shift+Enter salta línea
            </span>
          </div>
        </div>

        <label htmlFor={textareaId} className="sr-only">
          Pregunta por un trámite o servicio UTPL
        </label>
        <textarea
          id={textareaId}
          ref={textareaRef}
          value={value}
          rows={1}
          placeholder={placeholder}
          aria-describedby={hintId}
          className="min-h-[44px] w-full resize-none border-0 bg-transparent px-1 py-2 text-[15px] leading-7 text-obsidian outline-none placeholder:text-slate"
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()

              if (canSubmit) {
                onSubmit()
              }
            }
          }}
        />

        <div className="mt-3 flex items-center justify-end">
          <TooltipPrimitive.Root>
            <TooltipPrimitive.Trigger asChild>
              <button
                type="button"
                aria-label="Enviar consulta"
                disabled={!canSubmit}
                onClick={onSubmit}
                className={cn(
                  'inline-flex h-10 w-10 items-center justify-center rounded-full transition',
                  canSubmit ? 'bg-obsidian text-eggshell hover:scale-[1.02]' : 'bg-powder text-fog',
                )}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </TooltipPrimitive.Trigger>
            <TooltipPrimitive.Portal>
              <TooltipPrimitive.Content
                sideOffset={8}
                className="rounded-md border border-chalk bg-white px-3 py-1.5 text-xs text-gravel shadow-md"
              >
                {isLoading ? 'Consultando...' : 'Enviar'}
              </TooltipPrimitive.Content>
            </TooltipPrimitive.Portal>
          </TooltipPrimitive.Root>
        </div>
      </motion.div>
    </TooltipPrimitive.Provider>
  )
}
