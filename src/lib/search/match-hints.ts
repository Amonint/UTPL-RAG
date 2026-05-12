import type { FuseResultMatch } from 'fuse.js'

import { SEARCH_LAYER_HINT_LABELS } from '@/lib/search/payload-field-labels'

type FuseMatchLike = Pick<FuseResultMatch, 'key' | 'value' | 'indices'>

function excerptAround(value: string, start: number, end: number, pad = 28): string {
  const a = Math.max(0, start - pad)
  const b = Math.min(value.length, end + pad + 1)
  let chunk = value.slice(a, b).replace(/\s+/g, ' ').trim()
  if (a > 0) chunk = `…${chunk}`
  if (b < value.length) chunk = `${chunk}…`
  return chunk
}

/** Genera 1–2 pistas legibles a partir de `matches` de Fuse (sin exponer score). */
export function hintsFromFuseMatches(matches: ReadonlyArray<FuseMatchLike> | undefined, max = 2): string[] {
  if (!matches?.length) return []
  const out: string[] = []
  const seenKeys = new Set<string>()
  for (const m of matches) {
    const key = m.key ?? ''
    if (!key || seenKeys.has(key)) continue
    seenKeys.add(key)
    const label = SEARCH_LAYER_HINT_LABELS[key] ?? 'Información del servicio'
    const value = m.value ?? ''
    const firstRange = m.indices?.[0]
    if (value && firstRange && firstRange.length >= 2) {
      const [s, e] = firstRange
      const ex = excerptAround(value, s, e)
      if (ex) out.push(`${label}: «${ex}»`)
      else out.push(label)
    } else {
      out.push(label)
    }
    if (out.length >= max) break
  }
  return out
}
