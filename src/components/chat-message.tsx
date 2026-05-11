import type { ChatTurn, SelectedServiceMeta } from '@/lib/chat/create-assistant-turn'
import type { PdfRef } from '@/lib/types'
import { cn } from '@/lib/utils'

interface ChatMessageProps {
  turn: ChatTurn
  onSelectService?: (serviceId: string) => void
}

const JSON_FIELD_LABELS: Record<string, string> = {
  descripcion: 'Descripción',
  nota: 'Nota',
  requisitos: 'Requisitos',
  costo: 'Costo',
  tiempo_respuesta: 'Tiempo de respuesta',
  modalidad_nivel: 'Modalidad / nivel',
  titulo: 'Título',
  nombre: 'Nombre',
  enlace: 'Enlace',
  url: 'URL',
}

function humanizeJsonKey(key: string): string {
  return JSON_FIELD_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatJsonValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function SelectedServiceDetails({ meta }: { meta: SelectedServiceMeta }) {
  const pdfs: PdfRef[] = meta.pdfRefs ?? []
  const payload = meta.jsonPayload ?? {}
  const entries = Object.entries(payload).filter(([, v]) => {
    if (v === null || v === undefined) return false
    if (typeof v === 'string' && v.trim() === '') return false
    return true
  })
  const types = meta.studentTypes ?? []

  if (pdfs.length === 0 && entries.length === 0 && types.length === 0) {
    return null
  }

  return (
    <div className="mt-4 grid gap-4 border-t border-chalk pt-4">
      {types.length > 0 ? (
        <div className="grid gap-1">
          <p className="m-0 text-xs font-medium uppercase tracking-[0.05em] text-gravel">Tipos de estudiante</p>
          <p className="m-0 text-sm text-obsidian">{types.join(', ')}</p>
        </div>
      ) : null}

      {entries.length > 0 ? (
        <div className="grid gap-2">
          <p className="m-0 text-xs font-medium uppercase tracking-[0.05em] text-gravel">Datos del servicio (JSON)</p>
          <dl className="m-0 grid gap-2">
            {entries.map(([key, value]) => (
              <div key={key} className="grid gap-0.5 rounded-xl border border-chalk bg-powder/60 px-3 py-2">
                <dt className="text-xs font-medium text-gravel">{humanizeJsonKey(key)}</dt>
                <dd className="m-0 text-sm leading-6 text-obsidian">
                  <span className="whitespace-pre-wrap break-words">{formatJsonValue(value)}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {pdfs.length > 0 ? (
        <div className="grid gap-2">
          <p className="m-0 text-xs font-medium uppercase tracking-[0.05em] text-gravel">Documentos PDF</p>
          <ul className="m-0 grid gap-2 p-0">
            {pdfs.map((ref) => {
              const href = ref.url?.trim()
              if (!href) return null
              return (
                <li key={`${ref.url}-${ref.label ?? 'pdf'}`} className="list-none">
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-chalk bg-white px-3 py-2 text-sm font-medium text-primary underline-offset-4 transition hover:bg-powder hover:underline"
                  >
                    {ref.label?.trim() || 'Abrir PDF'}
                  </a>
                  {ref.sourcePath ? (
                    <span className="mt-1 block pl-1 font-mono text-[11px] text-gravel">{ref.sourcePath}</span>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {Object.keys(payload).length > 0 ? (
        <details className="rounded-xl border border-chalk bg-powder/40 px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.05em] text-gravel">
            JSON completo (referencia)
          </summary>
          <pre className="mt-2 max-h-[240px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-3 font-mono text-[11px] leading-relaxed text-cinder">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </details>
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
          'w-full max-w-[720px] rounded-[20px] px-4 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.06)]',
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
                  className="flex w-full flex-col items-start gap-2 rounded-2xl border border-chalk bg-powder px-4 py-3 text-left text-sm text-obsidian transition hover:bg-white"
                >
                  <div className="flex w-full items-center justify-between gap-3">
                    <span className="font-medium">{result.serviceName}</span>
                    <span className="rounded-full border border-chalk px-2 py-1 text-[11px] uppercase tracking-[0.05em] text-gravel">
                      {Math.round(result.score * 100)}%
                    </span>
                  </div>
                  <span className="text-xs uppercase tracking-[0.05em] text-gravel">{result.category}</span>
                  {result.snippet ? <span className="text-xs leading-5 text-cinder">{result.snippet}</span> : null}
                  <span className="rounded-full border border-chalk bg-white px-2 py-1 text-[11px] text-gravel">
                    {result.hasPdfs ? 'Tiene PDF' : 'Solo JSON'}
                  </span>
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
                className="flex list-none items-center justify-between rounded-2xl border border-chalk bg-powder px-4 py-3 text-sm text-obsidian"
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
                <article key={source.chunkId} className="grid gap-2 rounded-2xl border border-chalk bg-powder px-4 py-3">
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
