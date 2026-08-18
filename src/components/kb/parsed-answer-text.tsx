'use client'

import type { ReactNode } from 'react'
import { extractEmbeddedLinks } from '@/lib/kb/sanitize-public-answer'

export function ParsedAnswerText({ text }: { text: string }) {
  const links = extractEmbeddedLinks(text)

  if (links.length === 0) {
    return <>{text}</>
  }

  // Reemplazar cada link con componente
  let displayText = text
  const elements: (string | ReactNode)[] = []
  let lastIndex = 0

  for (let i = 0; i < links.length; i++) {
    const link = links[i]!
    const startIdx = displayText.indexOf(link.text, lastIndex)

    if (startIdx === -1) continue

    // Texto antes del link
    if (startIdx > lastIndex) {
      elements.push(displayText.substring(lastIndex, startIdx))
    }

    // Link renderizado
    elements.push(
      <a
        key={`link-${i}`}
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2 hover:text-primary/90"
      >
        Ver enlace
      </a>,
    )

    lastIndex = startIdx + link.text.length
  }

  // Texto restante
  if (lastIndex < displayText.length) {
    elements.push(displayText.substring(lastIndex))
  }

  return <>{elements}</>
}
