import Fuse, { type FuseResultMatch } from 'fuse.js'

import { buildServiceSearchIndexRow, type ServiceSearchIndexRow } from '@/lib/search/build-service-search-doc'
import { hintsFromFuseMatches } from '@/lib/search/match-hints'
import { normalizeText } from '@/lib/search/normalize'
import type { CanonicalServiceRecord, SearchResult } from '@/lib/types'

function pickSnippet(service: CanonicalServiceRecord): string | undefined {
  const p = service.jsonPayload
  const raw =
    (typeof p?.descripcion === 'string' && p.descripcion) ||
    (typeof p?.nota === 'string' && p.nota) ||
    (typeof p?.modalidad_nivel === 'string' && p.modalidad_nivel) ||
    ''
  const s = String(raw).trim()
  return s || undefined
}

function queryTokens(q: string): string[] {
  return q.split(/\s+/).filter((t) => t.length >= 2)
}

function hasNameOrCategoryOverlap(row: ServiceSearchIndexRow, q: string): boolean {
  if (row.serviceNameNorm.includes(q) || row.categoryNorm.includes(q)) return true
  return queryTokens(q).some((t) => row.serviceNameNorm.includes(t) || row.categoryNorm.includes(t))
}

function hasL2Overlap(row: ServiceSearchIndexRow, q: string): boolean {
  if (!row.l2) return false
  if (row.l2.includes(q)) return true
  return queryTokens(q).some((t) => t.length >= 2 && row.l2.includes(t))
}

function onlyL4Matches(matches: ReadonlyArray<{ key?: string }> | undefined): boolean {
  if (!matches?.length) return false
  return matches.every((m) => m.key === 'l4')
}

const FUSE_KEYS: Array<{ name: keyof Pick<ServiceSearchIndexRow, 'l1' | 'l2' | 'l3' | 'l4'>; weight: number }> = [
  { name: 'l1', weight: 0.45 },
  { name: 'l2', weight: 0.28 },
  { name: 'l3', weight: 0.17 },
  { name: 'l4', weight: 0.1 },
]

function runFuseSearch(rows: ServiceSearchIndexRow[], q: string, limit: number, threshold: number) {
  const fuse = new Fuse(rows, {
    keys: FUSE_KEYS,
    includeScore: true,
    includeMatches: true,
    threshold,
    ignoreLocation: true,
    minMatchCharLength: 2,
    ignoreFieldNorm: false,
  })
  return fuse.search(q, { limit: Math.min(Math.max(limit * 4, limit), rows.length) })
}

function rowToSearchResult(
  row: ServiceSearchIndexRow,
  relevance: number,
  matches: ReadonlyArray<FuseResultMatch> | undefined,
): SearchResult {
  const s = row.service
  return {
    serviceId: s.serviceId,
    serviceName: s.serviceName,
    category: s.category,
    score: relevance,
    hasPdfs: Boolean(s.pdfRefs?.length),
    snippet: pickSnippet(s),
    studentTypes: s.studentTypes,
    pdfRefs: s.pdfRefs ?? [],
    jsonPayload: s.jsonPayload,
    matchHints: hintsFromFuseMatches(matches),
  }
}

export function searchServices(input: {
  query: string
  services: CanonicalServiceRecord[]
  limit: number
}): SearchResult[] {
  const limit = Math.max(0, Math.min(input.limit, input.services.length))
  const q = normalizeText(input.query)
  if (!q) return []

  const rows = input.services.map(buildServiceSearchIndexRow)

  let raw = runFuseSearch(rows, q, limit, 0.42)
  if (raw.length === 0) {
    raw = runFuseSearch(rows, q, limit, 0.55)
  }

  const scored = raw.map((r) => {
    const row = r.item
    const fuseScore = r.score ?? 1
    let relevance = 1 - fuseScore

    if (onlyL4Matches(r.matches) && !hasNameOrCategoryOverlap(row, q) && !hasL2Overlap(row, q)) {
      relevance *= 0.55
    }

    return { row, relevance, matches: r.matches }
  })

  scored.sort((a, b) => {
    if (b.relevance !== a.relevance) return b.relevance - a.relevance
    return a.row.serviceNameNorm.localeCompare(b.row.serviceNameNorm)
  })

  return scored.slice(0, limit).map(({ row, relevance, matches }) => rowToSearchResult(row, relevance, matches))
}
