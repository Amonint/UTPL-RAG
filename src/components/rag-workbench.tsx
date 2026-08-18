'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useMediaQuery } from '@/hooks/use-media-query'
import {
  createAssistantTurn,
  createErrorTurn,
  createSearchResultsTurn,
  type ChatTurn,
  type RagResponsePayload,
} from '@/lib/chat/create-assistant-turn'
import type { SearchResult } from '@/lib/types'

import { KbDetailPanel } from './kb/kb-detail-panel'
import { KbLeftNav } from './kb/kb-left-nav'
import { KbMobileDrawer } from './kb/kb-mobile-drawer'
import { KbSearchPanel } from './kb/kb-search-panel'
import type {
  KbFilters,
  KbLeafSelection,
  KbNavSection,
  KbTaxonomyCategory,
  KbViewMode,
} from './kb/types'

type RagResponse = RagResponsePayload

type SelectedKbItem = {
  serviceId: string
  serviceName: string
  category: string
  hasPdfs: boolean
  snippet?: string
  jsonPayload: Record<string, unknown>
}

const STUDENT_SEARCH_CONTEXT = {
  profileCode: 'student' as const,
  profileTypeCode: undefined,
  programLevelCode: undefined,
  studentLifecycleCode: undefined,
}

function resultToSelected(result: SearchResult): SelectedKbItem {
  return {
    serviceId: result.serviceId,
    serviceName: result.serviceName,
    category: result.category,
    hasPdfs: result.hasPdfs,
    snippet: result.snippet,
    jsonPayload: (result.jsonPayload ?? {}) as Record<string, unknown>,
  }
}

export function RagWorkbench() {
  const router = useRouter()
  const [messages, setMessages] = useState<ChatTurn[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [liveResults, setLiveResults] = useState<SearchResult[]>([])
  const [taxonomy, setTaxonomy] = useState<KbTaxonomyCategory[]>([])
  const [taxonomyLoading, setTaxonomyLoading] = useState(false)
  const [filters, setFilters] = useState<KbFilters>({ category: '', subcategory: '', element: '' })
  const [viewMode, setViewMode] = useState<KbViewMode>('chat')
  const [leafSelection, setLeafSelection] = useState<KbLeafSelection | null>(null)
  const [detailItems, setDetailItems] = useState<SearchResult[]>([])
  const [activeDetailId, setActiveDetailId] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [selectedService, setSelectedService] = useState<SelectedKbItem | null>(null)
  const [navSection, setNavSection] = useState<KbNavSection>('services_incidents')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const isLargeScreen = useMediaQuery('(min-width: 1024px)')

  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const threadScrollRef = useRef<HTMLDivElement | null>(null)

  const scrollThreadToEnd = useCallback(() => {
    const el = threadScrollRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
  }, [])

  useEffect(() => {
    if (viewMode === 'chat' && messages.length > 0) {
      scrollThreadToEnd()
    }
  }, [messages, loading, scrollThreadToEnd, viewMode])

  useEffect(() => {
    let cancelled = false
    setTaxonomyLoading(true)
    ;(async () => {
      try {
        const response = await fetch('/api/search-services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taxonomyOnly: true,
            uiSection: navSection,
            ...STUDENT_SEARCH_CONTEXT,
          }),
        })
        const body = (await response.json()) as { taxonomy?: KbTaxonomyCategory[] }
        if (!cancelled && response.ok && Array.isArray(body.taxonomy)) {
          setTaxonomy(body.taxonomy)
        }
      } catch {
        // taxonomy stays empty until a search response provides it
      } finally {
        if (!cancelled) setTaxonomyLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [navSection])

  useEffect(() => {
    if (viewMode !== 'chat') return

    const query = draft.trim()
    if (!query) {
      setLiveResults([])
      return
    }

    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const response = await fetch('/api/search-services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            limit: 20,
            crossSection: true,
            ...STUDENT_SEARCH_CONTEXT,
          }),
        })
        const body = (await response.json()) as {
          results?: SearchResult[]
          taxonomy?: KbTaxonomyCategory[]
        }
        if (!response.ok) {
          setLiveResults([])
          return
        }
        setLiveResults(Array.isArray(body.results) ? body.results : [])
        if (Array.isArray(body.taxonomy) && body.taxonomy.length > 0) {
          setTaxonomy(body.taxonomy)
        }
      } catch {
        setLiveResults([])
      } finally {
        setSearching(false)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [draft, viewMode])

  const loadLeafDetail = useCallback(async (leaf: KbLeafSelection) => {
    setViewMode('detail')
    if (!isLargeScreen) {
      setMobileNavOpen(true)
    }
    setLeafSelection(leaf)
    setFilters({
      category: leaf.category,
      subcategory: leaf.subcategory,
      element: leaf.element,
    })
    setDetailLoading(true)
    setDetailError(null)
    setDetailItems([])
    setActiveDetailId(null)
    setSelectedService(null)

    try {
      const response = await fetch('/api/search-services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: leaf.category,
          subcategory: leaf.subcategory,
          element: leaf.element,
          limit: 50,
          uiSection: navSection,
          includeUnfiltered: true,
          ...STUDENT_SEARCH_CONTEXT,
        }),
      })
      const body = (await response.json()) as { results?: SearchResult[]; message?: string }
      if (!response.ok) {
        setDetailError(body.message ?? 'No se pudo cargar el contenido.')
        return
      }
      const results = Array.isArray(body.results) ? body.results : []
      setDetailItems(results)
      setActiveDetailId(results.length === 1 ? results[0].serviceId : null)
      if (results.length === 1) {
        setSelectedService(resultToSelected(results[0]))
      }
    } catch {
      setDetailError('No se pudo cargar el contenido.')
    } finally {
      setDetailLoading(false)
    }
  }, [isLargeScreen, navSection])

  function openDetailFromSearch(result: SearchResult) {
    const payload = (result.jsonPayload ?? {}) as Record<string, unknown>
    const contentType = typeof payload.content_type === 'string' ? payload.content_type : ''
    if (contentType === 'fechas' || contentType === 'calendar') {
      const rawEventId =
        (typeof payload.event_id === 'string' && payload.event_id) ||
        result.serviceId.replace(/^calendar-event-/, '')
      const target = rawEventId
        ? `/calendario?eventId=${encodeURIComponent(rawEventId)}`
        : '/calendario'
      router.push(target)
      return
    }

    setViewMode('detail')
    if (!isLargeScreen) {
      setMobileNavOpen(true)
    }
    setLeafSelection(null)
    setDetailItems([result])
    setActiveDetailId(result.serviceId)
    setDetailError(null)
    setDetailLoading(false)
    setSelectedService(resultToSelected(result))
    setDraft('')
    setLiveResults([])
  }

  function handleBackToChat() {
    setViewMode('chat')
    setLeafSelection(null)
    setDetailItems([])
    setActiveDetailId(null)
    setDetailError(null)
    setDetailLoading(false)
    setSelectedService(null)
    requestAnimationFrame(() => {
      promptTextareaRef.current?.focus()
    })
  }

  function handleSelectDetailItem(serviceId: string) {
    setActiveDetailId(serviceId)
    const item = detailItems.find((row) => row.serviceId === serviceId)
    if (item) {
      setSelectedService(resultToSelected(item))
    }
  }

  function handleSelectService(serviceId: string) {
    const fromThread = messages
      .flatMap((turn) => turn.searchResults ?? [])
      .find((item) => item.serviceId === serviceId)
    if (fromThread) {
      openDetailFromSearch(fromThread)
      return
    }
    const fromLive = liveResults.find((item) => item.serviceId === serviceId)
    if (fromLive) {
      openDetailFromSearch(fromLive)
    }
  }

  async function handleSubmit() {
    const question = draft.trim()
    if (!question || loading) return

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
        const queryResults = liveResults
        setDraft('')
        setMessages((current) =>
          current.map((turn) =>
            turn.id === loadingTurn.id
              ? queryResults.length > 0
                ? createSearchResultsTurn(queryResults, question)
                : createErrorTurn('No encontré servicios para esa consulta. Ajusta filtros o prueba otro término.')
              : turn,
          ),
        )
      } else {
        setDraft('')
        const response = await fetch('/api/rag-service', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceId: selectedService.serviceId,
            question,
          }),
        })

        const body = (await response.json()) as RagResponse | { message?: string }
        if (!response.ok) {
          const detail = 'message' in body && body.message ? body.message : 'No se pudo resolver la consulta.'
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

  const detailTrail = (() => {
    if (!leafSelection) return undefined
    const cat = taxonomy.find((c) => c.slug === leafSelection.category)
    const sub = cat?.subcategories.find((s) => s.slug === leafSelection.subcategory)
    const el = sub?.elements.find((e) => e.slug === leafSelection.element)
    return [cat?.name, sub?.name, el?.name].filter(Boolean).join(' / ')
  })()

  function handleNavSectionChange(next: KbNavSection) {
    if (next === navSection) return
    setNavSection(next)
    setTaxonomy([])
    setViewMode('chat')
    setLeafSelection(null)
    setFilters({ category: '', subcategory: '', element: '' })
    setDetailItems([])
    setActiveDetailId(null)
    setDetailError(null)
    setDetailLoading(false)
    setSelectedService(null)
  }

  const leftNav = (
    <KbLeftNav
      taxonomy={taxonomy}
      loading={taxonomyLoading}
      filters={filters}
      activeSection={navSection}
      sectionPickerVariant={isLargeScreen ? 'tabs' : 'select'}
      onChange={setFilters}
      onSectionChange={handleNavSectionChange}
      onLeafSelect={loadLeafDetail}
    />
  )

  const detailPanel = (
    <KbDetailPanel
      items={detailItems}
      activeItemId={activeDetailId}
      loading={detailLoading}
      error={detailError}
      trailLabel={detailTrail}
      uiSection={navSection}
      backLabel={isLargeScreen ? 'Volver al chat' : 'Volver al índice'}
      showBorder={isLargeScreen}
      onBackToChat={handleBackToChat}
      onSelectItem={handleSelectDetailItem}
    />
  )

  const drawerTitle =
    viewMode === 'detail'
      ? detailTrail ?? 'Detalle'
      : navSection === 'documentation'
        ? 'Información'
        : 'Preguntas frecuentes'

  return (
    <section className="grid h-full min-h-0 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(260px,420px)_minmax(0,1fr)]">
      {isLargeScreen ? (
        <div className="flex h-full min-h-0 flex-col overflow-hidden border-r border-chalk bg-white">
          {leftNav}
        </div>
      ) : null}

      {!isLargeScreen ? (
        <KbMobileDrawer
          open={mobileNavOpen}
          title={drawerTitle}
          onClose={() => setMobileNavOpen(false)}
        >
          {viewMode === 'detail' ? detailPanel : leftNav}
        </KbMobileDrawer>
      ) : null}

      {!(isLargeScreen && viewMode === 'detail') ? (
        <div className="flex min-h-0 flex-col overflow-hidden">
          <KbSearchPanel
          messages={messages}
          liveResults={liveResults}
          draft={draft}
          loading={loading}
          searching={searching}
          threadScrollRef={threadScrollRef}
          promptTextareaRef={promptTextareaRef}
          onDraftChange={setDraft}
          onSubmit={handleSubmit}
          onResultClick={openDetailFromSearch}
          onThreadResultClick={handleSelectService}
          onOpenKnowledgePanel={isLargeScreen ? undefined : () => setMobileNavOpen(true)}
          />
        </div>
      ) : null}

      {isLargeScreen && viewMode === 'detail' ? (
        <div className="flex min-h-0 flex-col overflow-hidden">{detailPanel}</div>
      ) : null}
    </section>
  )
}
