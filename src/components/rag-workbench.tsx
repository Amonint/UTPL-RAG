'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import {
  createAssistantTurn,
  createSearchResultsTurn,
  createErrorTurn,
  type ChatTurn,
  type RagResponsePayload,
} from '@/lib/chat/create-assistant-turn'
import type { SearchResult } from '@/lib/types'

import { ChatMessage } from './chat-message'
import { PromptBox } from './ui/chatgpt-prompt-input'

interface RagResponse extends RagResponsePayload {}

export function RagWorkbench() {
  const [messages, setMessages] = useState<ChatTurn[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [hasStartedTyping, setHasStartedTyping] = useState(false)
  const [liveResults, setLiveResults] = useState<SearchResult[]>([])
  const dockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [selectedService, setSelectedService] = useState<{
    serviceId: string
    serviceName: string
    category: string
    hasPdfs: boolean
    snippet?: string
  } | null>(null)
  const isStartScreen = messages.length === 0 && !loading && !hasStartedTyping
  const shouldDockComposer = hasStartedTyping || messages.length > 0
  const canShowLiveResults = !selectedService && draft.trim().length >= 2

  const conversationHint = useMemo(() => {
    if (!selectedService) {
      return null
    }

    return selectedService.hasPdfs
      ? '¿Alguna pregunta sobre este servicio?'
      : '¿Qué te gustaría saber sobre este servicio?'
  }, [selectedService])

  function buildServiceSelectedTurn(result: SearchResult, source: 'live' | 'thread'): ChatTurn {
    const intro =
      source === 'live'
        ? `Perfecto, seleccionaste ${result.serviceName}.`
        : `Listo, abrimos ${result.serviceName} para continuar.`
    const detail = result.snippet ? `Descripción: "${result.snippet}"` : null

    return {
      id: `assistant-${crypto.randomUUID()}`,
      role: 'assistant',
      status: 'done',
      content: [
        intro,
        result.hasPdfs
          ? '¿Alguna pregunta sobre este servicio?'
          : '¿Qué te gustaría saber sobre este servicio?',
        detail,
      ]
        .filter(Boolean)
        .join('\n'),
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

  useEffect(() => {
    if (selectedService) {
      return
    }

    const query = draft.trim()
    if (query.length < 2) {
      setLiveResults([])
      setSearching(false)
      return
    }

    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const response = await fetch('/api/search-services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, limit: 8 }),
        })

        const body = (await response.json()) as { results?: SearchResult[] }
        if (!response.ok) {
          setLiveResults([])
          return
        }

        setLiveResults(Array.isArray(body.results) ? body.results : [])
      } catch {
        setLiveResults([])
      } finally {
        setSearching(false)
      }
    }, 220)

    return () => clearTimeout(timer)
  }, [draft, selectedService])

  function handleDraftChange(next: string) {
    setDraft(next)
    if (!hasStartedTyping && next.trim().length > 0) {
      if (!dockTimerRef.current) {
        dockTimerRef.current = setTimeout(() => {
          setHasStartedTyping(true)
          dockTimerRef.current = null
        }, 280)
      }
    }
  }

  useEffect(() => {
    return () => {
      if (dockTimerRef.current) {
        clearTimeout(dockTimerRef.current)
        dockTimerRef.current = null
      }
    }
  }, [])

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
    setMessages((current) => [...current, userTurn, loadingTurn])

    try {
      if (!selectedService) {
        const results = liveResults
        setDraft('')
        setLiveResults([])

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
        setDraft('')
        const response = await fetch('/api/rag', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            question,
            selectedServiceId: selectedService.serviceId,
            allowPdf: selectedService.hasPdfs,
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

  function activateService(result: SearchResult, source: 'live' | 'thread') {
    setSelectedService({
      serviceId: result.serviceId,
      serviceName: result.serviceName,
      category: result.category,
      hasPdfs: result.hasPdfs,
      snippet: result.snippet,
    })
    setDraft('')
    setLiveResults([])
    setMessages((current) => [...current, buildServiceSelectedTurn(result, source)])
  }

  function handleSelectService(serviceId: string) {
    const fromThread = messages
      .flatMap((turn) => turn.searchResults ?? [])
      .find((item) => item.serviceId === serviceId)

    if (fromThread) {
      activateService(fromThread, 'thread')
      return
    }

    const fromLive = liveResults.find((item) => item.serviceId === serviceId)
    if (fromLive) {
      activateService(fromLive, 'live')
    }
  }

  function renderLiveSuggestions() {
    if (!canShowLiveResults) {
      return null
    }

    return (
      <div className="mt-3 max-h-[320px] overflow-auto rounded-2xl border border-chalk bg-white p-2 shadow-[0_12px_28px_rgba(0,0,0,0.08)]">
        <p className="mb-2 mt-0 px-2 text-xs uppercase tracking-[0.05em] text-gravel">
          {searching ? 'Buscando...' : 'Sugerencias'}
        </p>
        {liveResults.length === 0 && !searching ? (
          <p className="m-0 px-2 py-2 text-sm text-gravel">Sin coincidencias para "{draft.trim()}".</p>
        ) : (
          <ul className="m-0 grid gap-1 p-0">
            {liveResults.map((result) => (
              <li key={result.serviceId} className="list-none">
                <button
                  type="button"
                  onClick={() => activateService(result, 'live')}
                  className="w-full rounded-xl border border-transparent px-3 py-2 text-left transition hover:border-chalk hover:bg-powder"
                >
                  <p className="m-0 text-sm font-medium text-obsidian">{result.serviceName}</p>
                  <p className="m-0 text-xs uppercase tracking-[0.04em] text-gravel">
                    {result.category} · {result.hasPdfs ? 'Con PDF' : 'Solo JSON'}
                  </p>
                  {result.snippet ? (
                    <p className="m-0 mt-1 text-xs italic text-cinder">"{result.snippet}"</p>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  function renderPromptBlock(extraClasses?: string) {
    return (
      <div className={extraClasses}>
        {selectedService ? (
          <div className="mb-3 rounded-2xl border border-chalk bg-white px-4 py-3 text-sm text-obsidian">
            <p className="m-0">
              Conversando sobre: <strong>{selectedService.serviceName}</strong>
            </p>
            <p className="mb-0 mt-1 text-xs italic text-gravel">{conversationHint}</p>
          </div>
        ) : null}

        <PromptBox
          value={draft}
          onValueChange={handleDraftChange}
          onSubmit={handleSubmit}
          isLoading={loading}
          placeholder={
            selectedService
              ? `Escribe tu pregunta sobre ${selectedService.serviceName}...`
              : 'Escribe para buscar servicios (ej. "matri", "retiro", "certificado")'
          }
        />
        {renderLiveSuggestions()}
      </div>
    )
  }

  return (
    <section className="grid min-h-[72vh] overflow-hidden rounded-[28px] bg-gradient-to-b from-white to-eggshell shadow-[0_0_0_0.5px_rgba(0,0,0,0.06)_inset]">
      {isStartScreen ? (
        <div
          className="flex min-h-[420px] flex-col items-center justify-center gap-10 px-5 py-10 transition-all duration-500 md:px-6"
          aria-live="polite"
        >
          <p className="m-0 max-w-[22ch] text-center text-3xl font-semibold text-obsidian">
            ¿En qué puedo ayudarte?
          </p>
          <div className="w-full max-w-xl">{renderPromptBlock()}</div>
        </div>
      ) : (
        <div
          className="grid min-h-[420px] content-start gap-5 px-5 pb-48 pt-6 md:px-6"
          aria-live="polite"
        >
          {messages.map((turn) => (
            <ChatMessage key={turn.id} turn={turn} onSelectService={handleSelectService} />
          ))}
        </div>
      )}

      {shouldDockComposer ? (
        <div className="fixed inset-x-0 bottom-0 z-30 px-4 pb-4">
          <div className="mx-auto w-[min(calc(100%-20px),960px)] rounded-[24px] border border-chalk bg-[rgba(253,252,252,0.95)] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.14)] backdrop-blur">
            {selectedService ? (
              <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl border border-chalk bg-white px-4 py-3 text-sm text-obsidian">
                <span className="line-clamp-1">
                  En contexto: <strong>{selectedService.serviceName}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedService(null)
                    setHasStartedTyping(true)
                  }}
                  className="shrink-0 rounded-full border border-chalk px-3 py-1 text-xs uppercase tracking-[0.04em] text-gravel transition hover:bg-powder"
                >
                  Volver a buscar
                </button>
              </div>
            ) : null}
            {renderPromptBlock('w-full')}
          </div>
        </div>
      ) : null}
    </section>
  )
}
