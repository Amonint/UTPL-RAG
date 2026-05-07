'use client'

import { useState } from 'react'

import {
  createAssistantTurn,
  createErrorTurn,
  type ChatTurn,
  type RagResponsePayload,
} from '@/lib/chat/create-assistant-turn'

import { ChatMessage } from './chat-message'
import { AIPromptBox } from './ui/ai-prompt-box'

interface RagResponse extends RagResponsePayload {}

const welcomeTurn: ChatTurn = {
  id: 'assistant-welcome',
  role: 'assistant',
  status: 'done',
  content: 'Consulta cualquier trámite UTPL. El chat no guarda nada y se reinicia al refrescar.',
  usedSources: [],
  serviceCandidates: [],
  selectedService: null,
}

export function RagWorkbench() {
  const [messages, setMessages] = useState<ChatTurn[]>([welcomeTurn])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    const question = draft.trim()

    if (!question || loading) {
      return
    }

    const userTurn: ChatTurn = {
      id: `user-${crypto.randomUUID()}`,
      role: 'user',
      status: 'done',
      content: question,
    }

    const loadingTurn: ChatTurn = {
      id: `assistant-loading-${crypto.randomUUID()}`,
      role: 'assistant',
      status: 'loading',
      content: 'Consultando...',
      usedSources: [],
      serviceCandidates: [],
      selectedService: null,
    }

    setLoading(true)
    setDraft('')
    setMessages((current) => [...current, userTurn, loadingTurn])

    try {
      const response = await fetch('/api/rag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question }),
      })

      const body = (await response.json()) as RagResponse | { message: string }

      if (!response.ok) {
        setMessages((current) =>
          current.map((turn) =>
            turn.id === loadingTurn.id
              ? createErrorTurn(
                  'No se pudo completar la consulta. Revisa el backend o la clave de Gemini.',
                )
              : turn,
          ),
        )
        return
      }

      setMessages((current) =>
        current.map((turn) =>
          turn.id === loadingTurn.id ? createAssistantTurn(body as RagResponse) : turn,
        ),
      )
    } catch {
      setMessages((current) =>
        current.map((turn) =>
          turn.id === loadingTurn.id
            ? createErrorTurn('La consulta falló antes de recibir respuesta del servidor.')
            : turn,
        ),
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="grid min-h-[72vh] overflow-hidden rounded-[28px] border border-chalk bg-gradient-to-b from-white to-eggshell shadow-[0_0_0_0.5px_rgba(0,0,0,0.06)_inset]">
      <header className="border-b border-chalk bg-[rgba(253,252,252,0.92)] px-5 py-5 md:px-6">
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-chalk bg-obsidian px-3 py-1 text-[11px] uppercase tracking-[0.08em] text-eggshell">
            24h
          </span>
          <div className="grid gap-1">
            <h2 className="m-0 font-display text-2xl font-normal tracking-[-0.03em] text-obsidian">
              Consulta libre
            </h2>
            <p className="m-0 text-sm text-gravel">Sin cuenta. Sin historial. Se reinicia al refrescar.</p>
          </div>
        </div>
      </header>

      <div className="grid min-h-[420px] content-start gap-5 px-5 py-6 md:px-6" aria-live="polite">
        {messages.map((turn) => (
          <ChatMessage key={turn.id} turn={turn} />
        ))}
      </div>

      <div className="border-t border-chalk bg-[rgba(255,255,255,0.88)] px-5 py-5 md:px-6">
        <AIPromptBox
          value={draft}
          onValueChange={setDraft}
          onSubmit={handleSubmit}
          isLoading={loading}
          placeholder="Pregunta por un trámite o servicio UTPL"
        />
      </div>
    </section>
  )
}
