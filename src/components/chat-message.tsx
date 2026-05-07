import type { ChatTurn } from '@/lib/chat/create-assistant-turn'
import { cn } from '@/lib/utils'

interface ChatMessageProps {
  turn: ChatTurn
}

export function ChatMessage({ turn }: ChatMessageProps) {
  const isUser = turn.role === 'user'

  return (
    <article className={cn('grid gap-2', isUser ? 'justify-items-end' : 'justify-items-start')}>
      <div className="flex items-center gap-2">
        <span className="text-[12px] uppercase tracking-[0.05em] text-gravel">{isUser ? 'Tú' : '24h'}</span>
        {turn.selectedService?.serviceName ? (
          <span className="rounded-full border border-chalk bg-white px-2.5 py-1 text-[11px] uppercase tracking-[0.05em] text-gravel">
            {turn.selectedService.serviceName}
          </span>
        ) : null}
      </div>

      <div
        className={cn(
          'w-full max-w-[720px] rounded-[20px] px-4 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.06)]',
          isUser ? 'bg-obsidian text-eggshell' : 'border border-chalk bg-white text-obsidian',
        )}
      >
        <p className="m-0 whitespace-pre-wrap text-[15px] leading-7">{turn.content}</p>

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
