import { FileText } from 'lucide-react'

import type { ChatTurn, SelectedServiceMeta } from '@/lib/chat/create-assistant-turn'
import type { PdfRef } from '@/lib/types'
import { collectPayloadLinkUrls, ServicePayloadProse } from '@/components/service-payload-prose'
import { cn } from '@/lib/utils'

interface ChatMessageProps {
  turn: ChatTurn
  onSelectService?: (serviceId: string) => void
}

function SelectedServiceDetails({ meta }: { meta: SelectedServiceMeta }) {
  const pdfs: PdfRef[] = meta.pdfRefs ?? []
  const payload = meta.jsonPayload ?? {}
  const types = meta.studentTypes ?? []

  const inlinedUrls = collectPayloadLinkUrls(payload)
  const prose = <ServicePayloadProse payload={payload} />

  const extraPdfs = pdfs.filter((ref) => {
    const href = ref.url?.trim()
    if (!href) return false
    return !inlinedUrls.has(href)
  })

  const hasProse = Object.keys(payload).some((k) => {
    if (k.startsWith('_') || k === 'nombre' || k === 'descripcion') return false
    const v = payload[k]
    if (v === null || v === undefined) return false
    if (typeof v === 'string' && v.trim() === '') return false
    if (Array.isArray(v) && v.length === 0) return false
    return true
  })

  if (!hasProse && types.length === 0 && extraPdfs.length === 0) {
    return null
  }

  return (
    <div className="mt-4 space-y-4 border-t border-chalk pt-4 text-[15px] leading-7 text-obsidian">
      {types.length > 0 ? (
        <div className="grid gap-1">
          <p className="m-0">
            <strong>Tipos de estudiante</strong>
          </p>
          <p className="m-0">{types.join(', ')}</p>
        </div>
      ) : null}

      {prose}

      {extraPdfs.length > 0 ? (
        <div className="grid gap-2">
          <p className="m-0">
            <strong>Documentos PDF</strong>
          </p>
          <ul className="m-0 list-none space-y-2 p-0">
            {extraPdfs.map((ref) => {
              const href = ref.url?.trim()
              if (!href) return null
              return (
                <li key={`${ref.url}-${ref.label ?? 'pdf'}`}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-medium text-primary underline underline-offset-2 hover:text-primary/90"
                  >
                    <FileText className="size-4 shrink-0 opacity-80" aria-hidden />
                    {ref.label?.trim() || 'Abrir PDF'}
                  </a>
                  {ref.sourcePath ? (
                    <span className="mt-0.5 block pl-6 font-mono text-[11px] text-gravel">{ref.sourcePath}</span>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export function ChatMessage({ turn, onSelectService }: ChatMessageProps) {
  const isUser = turn.role === 'user'
  const contentLines = turn.content.split('\n').filter((line) => line.trim().length > 0)

  function renderAssistantLine(line: string, index: number) {
    const match = line.match(/^([A-Za-zÀ-ÿ\s]+):\s*(.+)$/)
    if (!match) {
      return (
        <p key={`${turn.id}-line-${index}`} className="m-0 whitespace-pre-wrap text-[15px] leading-7">
          {line}
        </p>
      )
    }

    const [, label, value] = match
    const quoted = value.match(/^"([\s\S]+)"$/)

    return (
      <p key={`${turn.id}-line-${index}`} className="m-0 whitespace-pre-wrap text-[15px] leading-7">
        <strong>{label}:</strong>{' '}
        {quoted ? <em className="italic">{`"${quoted[1]}"`}</em> : value}
      </p>
    )
  }

  const showServiceMeta = !isUser && turn.selectedService

  return (
    <article className={cn('grid gap-2', isUser ? 'justify-items-end' : 'justify-items-start')}>
      <div
        className={cn(
          'w-full max-w-[720px] rounded-xl px-4 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.06)]',
          isUser ? 'bg-obsidian text-eggshell' : 'border border-chalk bg-white text-obsidian',
        )}
      >
        {isUser ? (
          <p className="m-0 whitespace-pre-wrap text-[15px] leading-7">{turn.content}</p>
        ) : (
          <div className="grid gap-1">{contentLines.map((line, index) => renderAssistantLine(line, index))}</div>
        )}

        {showServiceMeta && turn.selectedService ? <SelectedServiceDetails meta={turn.selectedService} /> : null}

        {turn.searchResults && turn.searchResults.length > 0 ? (
          <ul className="mt-4 grid gap-2 p-0">
            {turn.searchResults.map((result) => (
              <li key={result.serviceId} className="list-none">
                <button
                  type="button"
                  onClick={() => onSelectService?.(result.serviceId)}
                  className="flex w-full flex-col items-start gap-2 rounded-xl border border-chalk bg-powder px-4 py-3 text-left text-sm text-obsidian transition hover:bg-white"
                >
                  <div className="flex w-full items-start justify-between gap-3">
                    <span className="min-w-0 flex-1 font-medium">{result.serviceName}</span>
                  </div>
                  <span className="text-xs uppercase tracking-[0.05em] text-gravel">{result.category}</span>
                  {result.matchHints && result.matchHints.length > 0 ? (
                    <ul className="m-0 list-none space-y-1 p-0">
                      {result.matchHints.map((hint, i) => (
                        <li key={i} className="text-[11px] leading-snug text-gravel">
                          {hint}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {result.snippet ? <span className="text-xs leading-5 text-cinder">{result.snippet}</span> : null}
                  {result.pdfRefs && result.pdfRefs.length > 0 ? (
                    <ul className="m-0 w-full space-y-1 p-0 pl-1">
                      {result.pdfRefs.map((ref) =>
                        ref.url ? (
                          <li key={ref.url} className="list-none">
                            <a
                              href={ref.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {ref.label?.trim() || 'PDF'}
                            </a>
                          </li>
                        ) : null,
                      )}
                    </ul>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {turn.serviceCandidates && turn.serviceCandidates.length > 0 ? (
          <ul className="mt-4 grid gap-2 p-0">
            {turn.serviceCandidates.map((candidate) => (
              <li
                key={candidate.serviceId}
                className="flex list-none items-center justify-between rounded-xl border border-chalk bg-powder px-4 py-3 text-sm text-obsidian"
              >
                <span>{candidate.serviceName}</span>
                <span className="rounded-full border border-chalk px-2 py-1 text-[11px] uppercase tracking-[0.05em] text-gravel">
                  {Math.round(candidate.score * 100)}%
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {turn.usedSources && turn.usedSources.length > 0 ? (
          <details className="mt-4 grid gap-3">
            <summary className="cursor-pointer text-sm text-gravel">Fuentes {turn.usedSources.length}</summary>
            <div className="grid gap-3">
              {turn.usedSources.map((source) => (
                <article key={source.chunkId} className="grid gap-2 rounded-xl border border-chalk bg-powder px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full border border-chalk bg-white px-2 py-1 text-[11px] uppercase tracking-[0.05em] text-gravel">
                      {source.sourceKind.toUpperCase()}
                    </span>
                    <span className="font-mono text-xs text-gravel">{source.chunkId}</span>
                  </div>
                  <p className="m-0 text-sm leading-6 text-gravel">{source.text}</p>
                </article>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </article>
  )
}
