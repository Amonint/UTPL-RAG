'use client'

import type { RefObject } from 'react'
import { PanelLeft } from 'lucide-react'

import { AudienceBadges } from '@/components/kb/audience-badges'
import { contentTypeLabel } from '@/lib/kb/content-labels'
import type { ChatTurn } from '@/lib/chat/create-assistant-turn'
import type { SearchResult } from '@/lib/types'
import { cn } from '@/lib/utils'

import { ChatMessage } from '../chat-message'
import { AIPromptBox } from '../ui/ai-prompt-box'

type Props = {
  messages: ChatTurn[]
  liveResults: SearchResult[]
  draft: string
  loading: boolean
  searching: boolean
  threadScrollRef: RefObject<HTMLDivElement | null>
  promptTextareaRef: RefObject<HTMLTextAreaElement | null>
  onDraftChange: (value: string) => void
  onSubmit: () => void
  onResultClick: (result: SearchResult) => void
  onThreadResultClick: (serviceId: string) => void
  onOpenKnowledgePanel?: () => void
}

function contentTypeBadge(result: SearchResult): string {
  const payload = (result.jsonPayload ?? {}) as Record<string, unknown>
  const sectionCode = typeof payload.section_code === 'string' ? payload.section_code : null
  return contentTypeLabel(payload.content_type, sectionCode)
}

function LiveResultsList({
  liveResults,
  searching,
  onResultClick,
}: {
  liveResults: SearchResult[]
  searching: boolean
  onResultClick: (result: SearchResult) => void
}) {
  return (
    <div className="max-h-[min(40vh,320px)] w-full overflow-y-auto rounded-lg border border-chalk bg-white p-2 shadow-[0_12px_28px_rgba(0,0,0,0.08)]">
      <p className="m-0 px-2 py-1 text-xs uppercase tracking-[0.05em] text-gravel">
        {searching ? 'Buscando...' : 'Coincidencias'}
      </p>
      {liveResults.length === 0 && !searching ? (
        <p className="m-0 px-2 py-2 text-sm text-gravel">Sin coincidencias.</p>
      ) : (
        <ul className="m-0 grid gap-1 p-0">
          {liveResults.map((result) => (
            <li key={result.serviceId} className="list-none">
              <button
                type="button"
                onClick={() => onResultClick(result)}
                className="w-full rounded-md border border-transparent px-3 py-2 text-left transition hover:border-chalk hover:bg-powder"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="m-0 min-w-0 text-sm font-medium text-obsidian">{result.serviceName}</p>
                  <span className="shrink-0 text-[11px] uppercase tracking-[0.05em] text-gravel">
                    {contentTypeBadge(result)}
                  </span>
                </div>
                <AudienceBadges
                  payload={(result.jsonPayload ?? {}) as Record<string, unknown>}
                  studentTypes={result.studentTypes}
                  compact
                />
                {result.snippet ? (
                  <p className="m-0 mt-1 line-clamp-2 text-xs text-cinder">{result.snippet}</p>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function KbSearchPanel({
  messages,
  liveResults,
  draft,
  loading,
  searching,
  threadScrollRef,
  promptTextareaRef,
  onDraftChange,
  onSubmit,
  onResultClick,
  onThreadResultClick,
  onOpenKnowledgePanel,
}: Props) {
  const hasDraft = draft.trim().length > 0
  const showLiveResults = hasDraft
  const isEmptyState = messages.length === 0
  const centerComposer = isEmptyState && !hasDraft

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-gradient-to-b from-white to-eggshell">
      {onOpenKnowledgePanel ? (
        <div className="flex shrink-0 items-center border-b border-chalk/80 bg-white/90 px-4 py-2 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={onOpenKnowledgePanel}
            className="inline-flex items-center gap-2 rounded-md border border-chalk bg-eggshell px-3 py-2 text-sm text-obsidian transition hover:bg-powder"
          >
            <PanelLeft className="size-4" aria-hidden />
            Explorar base de conocimiento
          </button>
        </div>
      ) : null}

      {messages.length > 0 ? (
        <div ref={threadScrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 md:px-6">
          <div className="mx-auto grid w-full max-w-[50rem] gap-5">
            {messages.map((turn) => (
              <ChatMessage key={turn.id} turn={turn} onSelectService={onThreadResultClick} />
            ))}
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          'z-10 flex w-full shrink-0 flex-col items-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]',
          centerComposer
            ? 'absolute inset-0 justify-center pt-4'
            : 'border-t border-chalk bg-[rgba(253,252,252,0.95)] pt-3 backdrop-blur',
        )}
      >
        {centerComposer ? (
          <h1 className="m-0 mb-6 max-w-[50rem] px-2 text-center text-2xl font-normal text-obsidian md:text-3xl">
            ¿Qué necesitas resolver?
          </h1>
        ) : null}

        <div className="flex w-full max-w-[50rem] flex-col items-stretch gap-3">
          {showLiveResults ? (
            <LiveResultsList
              liveResults={liveResults}
              searching={searching}
              onResultClick={onResultClick}
            />
          ) : null}

          <AIPromptBox
            ref={promptTextareaRef}
            value={draft}
            onValueChange={onDraftChange}
            onSubmit={onSubmit}
            isLoading={loading}
            disabled={false}
            placeholder="Busca servicios, incidencias, respuestas o fechas"
          />
        </div>
      </div>
    </div>
  )
}
