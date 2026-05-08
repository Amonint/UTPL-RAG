import type { ChatTurn } from '@/lib/chat/create-assistant-turn'
import { cn } from '@/lib/utils'

interface ChatMessageProps {
  turn: ChatTurn
  onSelectService?: (serviceId: string) => void
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
        {quoted ? <em>"{quoted[1]}"</em> : value}
      </p>
    )
  }

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
                  <span className="text-xs uppercase tracking-[0.05em] text-gravel">
                    {result.category}
                  </span>
                  {result.snippet ? (
                    <span className="text-xs leading-5 text-cinder">{result.snippet}</span>
                  ) : null}
                  <span className="rounded-full border border-chalk bg-white px-2 py-1 text-[11px] text-gravel">
                    {result.hasPdfs ? 'Tiene PDF' : 'Solo JSON'}
                  </span>
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
