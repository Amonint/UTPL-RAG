import Fuse from 'fuse.js'

import type { PdfCatalogEntry } from '@/lib/pdf-catalog'

export type PdfSearchResult = {
  pdfId: string
  name: string
  canonicalPath: string
  sourceFolders: string[]
  hierarchy: PdfCatalogEntry['hierarchy']
  score: number
}

function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function searchPdfCatalog(input: {
  query: string
  entries: PdfCatalogEntry[]
  limit: number
}): PdfSearchResult[] {
  const query = normalize(input.query)
  if (!query) return []

  const fuse = new Fuse(input.entries, {
    includeScore: true,
    threshold: 0.42,
    ignoreLocation: true,
    minMatchCharLength: 2,
    keys: [
      { name: 'name', weight: 0.4 },
      { name: 'hierarchy.modalidad', weight: 0.2 },
      { name: 'hierarchy.nivel', weight: 0.15 },
      { name: 'hierarchy.tipo', weight: 0.15 },
      { name: 'searchText', weight: 0.1 },
    ],
  })

  return fuse
    .search(query, { limit: Math.max(1, Math.min(input.limit, 100)) })
    .map((m) => ({
      pdfId: m.item.pdfId,
      name: m.item.name,
      canonicalPath: m.item.canonicalPath,
      sourceFolders: m.item.sourceFolders,
      hierarchy: m.item.hierarchy,
      score: 1 - (m.score ?? 1),
    }))
}
