'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  createAssistantTurn,
  createSearchResultsTurn,
  createErrorTurn,
  type ChatTurn,
  type RagResponsePayload,
} from '@/lib/chat/create-assistant-turn'
import { buildPdfChipGroups, defaultSelectedPdfIds } from '@/lib/rag/pdf-selection-hierarchy'
import type { SearchResult } from '@/lib/types'
import { cn } from '@/lib/utils'

import { ChatMessage } from './chat-message'
import { AIPromptBox } from './ui/ai-prompt-box'

type RagResponse = RagResponsePayload

/** Columna búsqueda inicial: ~20% más ancha que `max-w-xl` (36rem → 43.2rem). */
const SEARCH_COLUMN_MAX = 'max-w-[43.2rem]'

export function RagWorkbench() {
  const [messages, setMessages] = useState<ChatTurn[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [liveResults, setLiveResults] = useState<SearchResult[]>([])
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const threadScrollRef = useRef<HTMLDivElement | null>(null)
  const dockedComposerRef = useRef<HTMLDivElement | null>(null)
  const [dockedComposerHeight, setDockedComposerHeight] = useState(0)
  const [docsPanelOpen, setDocsPanelOpen] = useState(true)
  const [selectedPdfIds, setSelectedPdfIds] = useState<string[]>([])
  const [selectedService, setSelectedService] = useState<{
    serviceId: string
    serviceName: string
    category: string
    hasPdfs: boolean
    snippet?: string
    pdfRefs: NonNullable<SearchResult['pdfRefs']>
    jsonPayload: Record<string, unknown>
  } | null>(null)

  const welcomeNoMessages = messages.length === 0 && !loading
  const shouldDockComposer = messages.length > 0 || loading
  const canShowLiveResults = !selectedService && draft.trim().length >= 2

  const pdfCount = selectedService?.pdfRefs.length ?? 0
  const pdfChipGroups = useMemo(() => {
    if (!selectedService || pdfCount === 0) return []
    return buildPdfChipGroups(selectedService.jsonPayload, selectedService.pdfRefs)
  }, [selectedService, pdfCount])

  const composerDisabled =
    Boolean(selectedService) &&
    (pdfCount === 0 || (pdfCount > 1 && selectedPdfIds.length === 0))

  const composerDisabledHint = useMemo(() => {
    if (!selectedService) return undefined
    if (pdfCount === 0) {
      return 'Este trámite no tiene PDFs para consulta asistida con documentos oficiales.'
    }
    if (pdfCount > 1 && selectedPdfIds.length === 0) {
      return 'Selecciona uno o más documentos debajo para habilitar la pregunta.'
    }
    return undefined
  }, [selectedService, pdfCount, selectedPdfIds.length])

  useEffect(() => {
    if (!selectedService) {
      setSelectedPdfIds([])
      return
    }
    const refs = selectedService.pdfRefs
    setSelectedPdfIds(defaultSelectedPdfIds(refs.length, refs))
    setDocsPanelOpen(true)
  }, [selectedService?.serviceId])

  const scrollThreadToEnd = useCallback(() => {
    const el = threadScrollRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
  }, [])

  useEffect(() => {
    scrollThreadToEnd()
  }, [messages, loading, scrollThreadToEnd])

  useEffect(() => {
    const el = dockedComposerRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      setDockedComposerHeight(el.offsetHeight)
    })
    observer.observe(el)
    setDockedComposerHeight(el.offsetHeight)
    return () => observer.disconnect()
  }, [shouldDockComposer])

  const conversationHint = useMemo(() => {
    if (!selectedService) {
      return null
    }

    if (pdfCount === 0) {
      return 'Este servicio no incluye PDFs en el catálogo; no es posible chatear con documentos.'
    }
    if (pdfCount === 1) {
      return 'Puedes preguntar usando el documento indicado abajo.'
    }
    return 'Selecciona los PDFs de referencia y escribe tu pregunta.'
  }, [selectedService, pdfCount])

  function togglePdfSelection(id: string) {
    setSelectedPdfIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

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
        studentTypes: result.studentTypes ?? [],
        pdfRefs: result.pdfRefs ?? [],
        jsonPayload: result.jsonPayload ?? {},
        hasPdfs: result.hasPdfs,
        snippet: result.snippet,
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
  }

  async function handleSubmit() {
    const question = draft.trim()

    if (!question || loading || composerDisabled) {
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
    requestAnimationFrame(() => {
      requestAnimationFrame(scrollThreadToEnd)
    })

    try {
      if (!selectedService) {
        const results = liveResults
        setDraft('')
        setLiveResults([])

        setMessages((current) =>
          current.map((turn) =>
            turn.id === loadingTurn.id
              ? results.length > 0
                ? createSearchResultsTurn(results, question)
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
            selectedPdfIds,
          }),
        })

        const body = (await response.json()) as RagResponse | Record<string, unknown>

        if (!response.ok) {
          const rawMsg = 'message' in body && typeof body.message === 'string' ? body.message.trim() : ''
          const detail =
            rawMsg || 'No se pudo completar la consulta. Revisa el backend o la clave de Gemini.'
          setMessages((current) =>
            current.map((turn) => (turn.id === loadingTurn.id ? createErrorTurn(detail) : turn)),
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
      pdfRefs: result.pdfRefs ?? [],
      jsonPayload: (result.jsonPayload ?? {}) as Record<string, unknown>,
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

  function renderLiveSuggestions(fillVertical?: boolean) {
    if (!canShowLiveResults) {
      return null
    }

    return (
      <div
        className={cn(
          'mt-3 overflow-auto rounded-xl border border-chalk bg-white p-2 shadow-[0_12px_28px_rgba(0,0,0,0.08)]',
          fillVertical ? 'min-h-0 flex-1' : 'max-h-[320px]',
        )}
      >
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
                  className="w-full rounded-lg border border-transparent px-3 py-2 text-left transition hover:border-chalk hover:bg-powder"
                >
                  <p className="m-0 text-sm font-medium text-obsidian">{result.serviceName}</p>
                  <p className="m-0 text-xs uppercase tracking-[0.04em] text-gravel">
                    {result.category}
                    {result.pdfRefs && result.pdfRefs.length > 0
                      ? ` · ${result.pdfRefs.length} documento${result.pdfRefs.length === 1 ? '' : 's'}`
                      : null}
                  </p>
                  {result.snippet ? (
                    <p className="m-0 mt-1 text-xs italic text-cinder">"{result.snippet}"</p>
                  ) : null}
                  {result.matchHints && result.matchHints.length > 0 ? (
                    <ul className="m-0 mt-1 list-none space-y-0.5 p-0">
                      {result.matchHints.map((hint, i) => (
                        <li key={i} className="text-[11px] leading-snug text-gravel">
                          {hint}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  function renderPromptBlock(
    extraClasses?: string,
    options?: { suggestionsFill?: boolean },
  ) {
    return (
      <div className={cn('flex min-h-0 flex-col', extraClasses)}>
        {selectedService ? (
          <div className="mb-3 flex shrink-0 items-start justify-between gap-3 rounded-xl border border-chalk bg-white px-4 py-3 text-sm text-obsidian">
            <div className="min-w-0 flex-1">
              <p className="m-0">
                Conversando sobre: <strong>{selectedService.serviceName}</strong>
              </p>
              <p className="mb-0 mt-1 text-xs italic text-gravel">{conversationHint}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedService(null)
                setSelectedPdfIds([])
                setMessages([])
                setDraft('')
                setLiveResults([])
                setLoading(false)
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    promptTextareaRef.current?.focus()
                  })
                })
              }}
              className="shrink-0 rounded-full border border-chalk px-3 py-1.5 text-left text-[11px] font-medium uppercase leading-tight tracking-[0.03em] text-gravel transition hover:bg-powder sm:text-xs sm:tracking-[0.04em]"
            >
              Volver a buscar un servicio
            </button>
          </div>
        ) : null}

        {selectedService && pdfCount > 0 ? (
          <div className="mb-3 shrink-0 rounded-xl border border-chalk bg-white px-3 py-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="m-0 text-[11px] font-medium uppercase tracking-[0.06em] text-gravel">
                Documentos de consulta
              </p>
              <button
                type="button"
                onClick={() => setDocsPanelOpen((o) => !o)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-chalk px-2 py-1 text-[11px] font-medium text-gravel transition hover:bg-powder"
                aria-expanded={docsPanelOpen}
                aria-controls="rag-docs-panel-body"
              >
                {docsPanelOpen ? (
                  <>
                    <ChevronUp className="size-3.5" aria-hidden />
                    <span className="hidden sm:inline">Ocultar</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-3.5" aria-hidden />
                    <span className="hidden sm:inline">Mostrar</span>
                  </>
                )}
              </button>
            </div>
            {!docsPanelOpen ? (
              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-xs text-obsidian">
                <span>
                  {selectedPdfIds.length === 0
                    ? 'Ningún documento seleccionado.'
                    : selectedPdfIds.length === 1
                      ? `Seleccionado: ${selectedService.pdfRefs.find((r) => r.sourcePath === selectedPdfIds[0])?.label ?? '1 documento'}.`
                      : `${selectedPdfIds.length} documentos seleccionados.`}
                </span>
                <button
                  type="button"
                  onClick={() => setDocsPanelOpen(true)}
                  className="font-medium text-primary underline underline-offset-2"
                >
                  Abrir lista
                </button>
              </div>
            ) : (
              <div
                id="rag-docs-panel-body"
                className="max-h-[min(40vh,14rem)] overflow-y-auto"
              >
                {pdfCount === 1 ? (
                  <span className="inline-flex max-w-full items-center rounded-full border border-chalk bg-powder px-3 py-1 text-xs text-obsidian">
                    <span className="truncate">{selectedService.pdfRefs[0]?.label ?? 'PDF'}</span>
                  </span>
                ) : pdfChipGroups.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {pdfChipGroups.map((group) => (
                      <div key={group.groupId}>
                        <p className="m-0 mb-1.5 text-xs font-semibold text-obsidian">{group.heading}</p>
                        <div className="flex flex-col gap-2">
                          {group.sections.map((section, si) => (
                            <div key={`${group.groupId}-s${si}`}>
                              {section.subsectionTitle ? (
                                <p className="m-0 mb-1 text-[11px] uppercase tracking-[0.04em] text-gravel">
                                  {section.subsectionTitle}
                                </p>
                              ) : null}
                              <div className="flex flex-wrap gap-1.5">
                                {section.options.map((opt) => {
                                  const on = selectedPdfIds.includes(opt.selectionId)
                                  return (
                                    <button
                                      key={opt.selectionId}
                                      type="button"
                                      onClick={() => togglePdfSelection(opt.selectionId)}
                                      className={cn(
                                        'max-w-full truncate rounded-full border px-2.5 py-1 text-left text-xs transition',
                                        on
                                          ? 'border-obsidian bg-obsidian text-eggshell'
                                          : 'border-chalk bg-white text-obsidian hover:bg-powder',
                                      )}
                                      title={opt.label}
                                    >
                                      {opt.label}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedService.pdfRefs.map((ref) => {
                      const on = selectedPdfIds.includes(ref.sourcePath)
                      return (
                        <button
                          key={ref.sourcePath}
                          type="button"
                          onClick={() => togglePdfSelection(ref.sourcePath)}
                          className={cn(
                            'max-w-full truncate rounded-full border px-2.5 py-1 text-left text-xs transition',
                            on
                              ? 'border-obsidian bg-obsidian text-eggshell'
                              : 'border-chalk bg-white text-obsidian hover:bg-powder',
                          )}
                          title={ref.label}
                        >
                          {ref.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : selectedService && pdfCount === 0 ? (
          <p className="mb-3 shrink-0 rounded-xl border border-dashed border-chalk bg-white px-3 py-2 text-xs text-gravel">
            Este trámite no tiene PDFs en el catálogo; la consulta con documentos no está disponible.
          </p>
        ) : null}

        <div className="shrink-0">
          <AIPromptBox
            ref={promptTextareaRef}
            value={draft}
            onValueChange={handleDraftChange}
            onSubmit={handleSubmit}
            isLoading={loading}
            disabled={Boolean(selectedService && composerDisabled)}
            disabledHint={composerDisabledHint}
            placeholder={
              selectedService
                ? composerDisabled && pdfCount === 0
                  ? 'Consulta con documentos no disponible para este trámite'
                  : composerDisabled && pdfCount > 1
                    ? 'Primero elige uno o más PDFs arriba'
                    : `Escribe tu pregunta sobre ${selectedService.serviceName}...`
                : 'Escribe para buscar servicios (ej. "matri", "retiro", "certificado")'
            }
          />
        </div>
        {renderLiveSuggestions(options?.suggestionsFill)}
      </div>
    )
  }

  return (
    <section className="flex min-h-[72vh] max-h-[min(92dvh,calc(100dvh-5rem))] flex-col overflow-hidden rounded-2xl bg-gradient-to-b from-white to-eggshell shadow-[0_0_0_0.5px_rgba(0,0,0,0.06)_inset]">
      {welcomeNoMessages ? (
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col bg-eggshell px-5 transition-all duration-300 md:px-6',
            draft.trim()
              ? 'justify-start overflow-y-auto overscroll-contain pb-8 pt-6'
              : 'items-center justify-center gap-10 py-10',
          )}
          aria-live="polite"
        >
          <div
            className={cn(
              'mx-auto flex w-full flex-col',
              SEARCH_COLUMN_MAX,
              draft.trim() ? 'min-h-0 flex-1 gap-5' : 'items-center gap-10',
            )}
          >
            <p
              className={cn(
                'm-0 text-3xl font-normal text-obsidian',
                draft.trim()
                  ? 'w-full shrink-0 text-left text-2xl leading-snug md:text-3xl'
                  : 'max-w-[22ch] text-center',
              )}
            >
              ¿En qué puedo ayudarte?
            </p>
            <div
              className={cn(
                'w-full',
                draft.trim() ? 'flex min-h-0 min-w-0 flex-1 flex-col' : 'shrink-0',
              )}
            >
              {draft.trim()
                ? renderPromptBlock('w-full flex min-h-0 flex-1 flex-col', { suggestionsFill: true })
                : renderPromptBlock()}
            </div>
          </div>
        </div>
      ) : (
        <div
          ref={threadScrollRef}
          className="grid min-h-0 flex-1 content-start gap-5 overflow-y-auto overscroll-contain px-5 pt-6 md:px-6"
          style={{ paddingBottom: dockedComposerHeight > 0 ? dockedComposerHeight + 24 : undefined }}
          aria-live="polite"
        >
          {messages.map((turn) => (
            <ChatMessage key={turn.id} turn={turn} onSelectService={handleSelectService} />
          ))}
        </div>
      )}

      {shouldDockComposer ? (
        <div ref={dockedComposerRef} className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto w-[min(calc(100%-20px),960px)] rounded-2xl border border-chalk bg-[rgba(253,252,252,0.95)] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.14)] backdrop-blur">
            {renderPromptBlock('w-full')}
          </div>
        </div>
      ) : null}
    </section>
  )
}
