'use client'

import { useState } from 'react'

import {
  createAssistantTurn,
  createSearchResultsTurn,
  createErrorTurn,
  type ChatTurn,
  type RagResponsePayload,
} from '@/lib/chat/create-assistant-turn'
import { pdfNeeded } from '@/lib/search/pdf-needed'
import type { SearchResult } from '@/lib/types'

import { ChatMessage } from './chat-message'
import { PromptBox } from './ui/chatgpt-prompt-input'

interface RagResponse extends RagResponsePayload {}

export function RagWorkbench() {
  const [messages, setMessages] = useState<ChatTurn[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedService, setSelectedService] = useState<{
    serviceId: string
    serviceName: string
    hasPdfs: boolean
  } | null>(null)
  const isStartScreen = messages.length === 0 && !loading

  function buildServiceSelectedTurn(result: SearchResult): ChatTurn {
    return {
      id: `assistant-${crypto.randomUUID()}`,
      role: 'assistant',
      status: 'done',
      content: result.hasPdfs
        ? `Servicio seleccionado: ${result.serviceName}. Este servicio tiene PDFs de apoyo. Te respondere con JSON y usare PDF solo cuando haga falta.`
        : `Servicio seleccionado: ${result.serviceName}. Este servicio se respondera solo con informacion del JSON.`,
      usedSources: [],
      serviceCandidates: [],
      selectedService: {
        serviceId: result.serviceId,
        serviceName: result.serviceName,
        category: result.category,
        studentTypes: [],
      },
    }
  }

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
      if (!selectedService) {
        const response = await fetch('/api/search-services', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: question, limit: 12 }),
        })
        const body = (await response.json()) as { results?: SearchResult[]; message?: string }

        if (!response.ok) {
          setMessages((current) =>
            current.map((turn) =>
              turn.id === loadingTurn.id
                ? createErrorTurn(
                    body.message ??
                      'No se pudo ejecutar la busqueda. Revisa artefactos o backend.',
                  )
                : turn,
            ),
          )
          return
        }

        const results = Array.isArray(body.results) ? body.results : []
        setMessages((current) =>
          current.map((turn) =>
            turn.id === loadingTurn.id
              ? results.length > 0
                ? createSearchResultsTurn(results)
                : createErrorTurn(
                    'No encontre servicios relacionados. Prueba con otra palabra clave.',
                  )
              : turn,
          ),
        )
      } else {
        const response = await fetch('/api/rag', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            question,
            selectedServiceId: selectedService.serviceId,
            allowPdf: selectedService.hasPdfs && pdfNeeded(question),
          }),
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
      }
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

  function handleSelectService(serviceId: string) {
    const result = messages
      .flatMap((turn) => turn.searchResults ?? [])
      .find((item) => item.serviceId === serviceId)

    if (!result) {
      return
    }

    setSelectedService({
      serviceId: result.serviceId,
      serviceName: result.serviceName,
      hasPdfs: result.hasPdfs,
    })
    setMessages((current) => [...current, buildServiceSelectedTurn(result)])
  }

  return (
    <section className="grid min-h-[72vh] overflow-hidden rounded-[28px] bg-gradient-to-b from-white to-eggshell shadow-[0_0_0_0.5px_rgba(0,0,0,0.06)_inset]">
      {isStartScreen ? (
        <div
          className="flex min-h-[420px] flex-col items-center justify-center gap-10 px-5 py-10 md:px-6"
          aria-live="polite"
        >
          <p className="m-0 max-w-[22ch] text-center text-3xl font-semibold text-obsidian">
            ¿En qué puedo ayudarte?
          </p>
          <div className="w-full max-w-xl">
            <PromptBox
              value={draft}
              onValueChange={setDraft}
              onSubmit={handleSubmit}
              isLoading={loading}
              placeholder="Escribe tu consulta"
            />
          </div>
        </div>
      ) : (
        <div className="grid min-h-[420px] content-start gap-5 px-5 py-6 md:px-6" aria-live="polite">
          {messages.map((turn) => (
            <ChatMessage key={turn.id} turn={turn} onSelectService={handleSelectService} />
          ))}
        </div>
      )}

      {isStartScreen ? null : (
        <div className="border-t border-chalk bg-[rgba(255,255,255,0.88)] px-5 py-5 md:px-6">
          {selectedService ? (
            <div className="mb-3 flex items-center justify-between rounded-2xl border border-chalk bg-white px-4 py-3 text-sm text-obsidian">
              <span>
                En contexto: <strong>{selectedService.serviceName}</strong>
              </span>
              <button
                type="button"
                onClick={() => setSelectedService(null)}
                className="rounded-full border border-chalk px-3 py-1 text-xs uppercase tracking-[0.04em] text-gravel transition hover:bg-powder"
              >
                Volver a buscar
              </button>
            </div>
          ) : null}
          <PromptBox
            value={draft}
            onValueChange={setDraft}
            onSubmit={handleSubmit}
            isLoading={loading}
            placeholder="Escribe tu consulta"
          />
        </div>
      )}
    </section>
  )
}
