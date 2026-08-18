'use client'

import { ArrowLeft } from 'lucide-react'

import { cn } from '@/lib/utils'
import { AudienceBadges } from '@/components/kb/audience-badges'
import { labelModality, labelProgramLevel, labelLifecycle } from '@/lib/kb/audience-labels'
import type { SearchResult } from '@/lib/types'

import { KbServiceDetailBody } from './kb-service-detail-body'
import type { KbNavSection } from './types'

type Props = {
  items: SearchResult[]
  activeItemId: string | null
  loading: boolean
  error: string | null
  trailLabel?: string
  uiSection?: KbNavSection
  backLabel?: string
  showBorder?: boolean
  onBackToChat: () => void
  onSelectItem: (serviceId: string) => void
}

function variantLabel(payload: Record<string, unknown>): string {
  const parts = [
    labelModality(typeof payload.modality === 'string' ? payload.modality : null),
    labelProgramLevel(typeof payload.program_level === 'string' ? payload.program_level : null),
    labelLifecycle(typeof payload.student_lifecycle === 'string' ? payload.student_lifecycle : null),
  ]
  return parts.join(' · ')
}

export function KbDetailPanel({
  items,
  activeItemId,
  loading,
  error,
  trailLabel,
  uiSection,
  backLabel = 'Volver al chat',
  showBorder = true,
  onBackToChat,
  onSelectItem,
}: Props) {
  const activeItem =
    items.find((item) => item.serviceId === activeItemId) ?? (items.length === 1 ? items[0] : null)

  return (
    <aside
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden bg-white',
        showBorder && 'border-l border-chalk',
      )}
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-chalk px-4 py-3">
        <button
          type="button"
          onClick={onBackToChat}
          className="inline-flex items-center gap-2 rounded-md border border-chalk bg-eggshell px-3 py-2 text-sm text-obsidian transition hover:bg-powder"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {backLabel}
        </button>
        {trailLabel ? <p className="m-0 min-w-0 truncate text-xs text-gravel">{trailLabel}</p> : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
        {loading ? <p className="m-0 text-sm text-gravel">Cargando contenido...</p> : null}
        {error ? <p className="m-0 text-sm text-red-700">{error}</p> : null}

        {!loading && !error && items.length === 0 ? (
          <p className="m-0 text-sm text-gravel">No hay contenido para esta selección.</p>
        ) : null}

        {!loading && !error && items.length > 1 ? (
          <div className="mb-5 grid gap-2">
            <p className="m-0 text-xs uppercase tracking-[0.05em] text-gravel">
              {items.length} variantes en esta sección
            </p>
            <ul className="m-0 grid gap-1 p-0">
              {items.map((item) => (
                <li key={item.serviceId} className="list-none">
                  <button
                    type="button"
                    onClick={() => onSelectItem(item.serviceId)}
                    className={cn(
                      'w-full rounded-md border px-3 py-2 text-left transition',
                      activeItem?.serviceId === item.serviceId
                        ? 'border-obsidian bg-obsidian text-eggshell'
                        : 'border-chalk bg-eggshell text-obsidian hover:bg-powder',
                    )}
                  >
                    <p className="m-0 text-sm font-medium">{item.serviceName}</p>
                    <p
                      className={cn(
                        'm-0 mt-1 text-xs',
                        activeItem?.serviceId === item.serviceId ? 'text-eggshell/80' : 'text-gravel',
                      )}
                    >
                      {variantLabel((item.jsonPayload ?? {}) as Record<string, unknown>)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!loading && !error && activeItem ? (
          <KbServiceDetailBody
            item={{
              serviceId: activeItem.serviceId,
              serviceName: activeItem.serviceName,
              category: activeItem.category,
              jsonPayload: (activeItem.jsonPayload ?? {}) as Record<string, unknown>,
              studentTypes: activeItem.studentTypes,
              pdfRefs: activeItem.pdfRefs,
              referenceUrl: activeItem.referenceUrl,
              uiSection,
            }}
          />
        ) : null}
      </div>
    </aside>
  )
}
