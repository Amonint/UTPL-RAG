'use client'

import { formatKnowledgeScopeLine } from '@/lib/kb/audience-labels'

type Props = {
  payload?: Record<string, unknown>
  studentTypes?: string[]
  compact?: boolean
}

export function AudienceBadges({ payload, studentTypes, compact = false }: Props) {
  const line = formatKnowledgeScopeLine({ payload, studentTypes })
  if (!line) return null

  return (
    <p
      className={
        compact
          ? 'm-0 text-[11px] leading-snug text-gravel'
          : 'm-0 text-xs leading-relaxed text-gravel'
      }
    >
      {line}
    </p>
  )
}
