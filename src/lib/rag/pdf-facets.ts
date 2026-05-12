import type { PdfFacet, PdfRef } from '@/lib/types'

function isPdfUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const t = value.trim().toLowerCase()
  return t.startsWith('http') && t.includes('.pdf')
}

function slugFacet(raw: string) {
  const s = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s.length > 0 ? s : 'facet'
}

export function derivePdfFacetsFromPayload(
  jsonPayload: Record<string, unknown>,
  pdfRefsSubset: PdfRef[],
): PdfFacet[] {
  const tabs = jsonPayload.requisitos_pestanas
  if (!Array.isArray(tabs) || tabs.length === 0) {
    return []
  }

  const byUrl = new Map(pdfRefsSubset.map((r) => [r.url, r]))

  const facets: PdfFacet[] = []
  for (let ti = 0; ti < tabs.length; ti++) {
    const tab = tabs[ti]
    if (!tab || typeof tab !== 'object') continue
    const pestana = String((tab as Record<string, unknown>).pestaña ?? `Pestaña ${ti + 1}`).trim()
    const contenido = (tab as Record<string, unknown>).contenido
    const collected: PdfRef[] = []

    if (Array.isArray(contenido)) {
      for (const block of contenido) {
        if (!block || typeof block !== 'object') continue
        const lista = (block as Record<string, unknown>).lista
        if (!Array.isArray(lista)) continue
        for (const item of lista) {
          if (!item || typeof item !== 'object') continue
          const pdf = (item as Record<string, unknown>).pdf
          if (!isPdfUrl(pdf)) continue
          const hit = byUrl.get(pdf)
          if (hit) collected.push(hit)
        }
      }
    }

    const seen = new Set<string>()
    const unique = collected.filter((r) => {
      if (seen.has(r.url)) return false
      seen.add(r.url)
      return true
    })

    if (unique.length === 0) continue

    const itemTexto = unique
      .map((r) => r.label)
      .filter(Boolean)
      .slice(0, 4)
      .join(' · ')

    facets.push({
      facetId: `pestana-${slugFacet(pestana)}-${ti}`,
      pestana,
      titulo: pestana,
      itemTexto: itemTexto || 'Documentos PDF',
      pdfRefs: unique,
      pdfCount: unique.length,
    })
  }

  return facets
}

export function filterPdfRefsByFacetIds(
  refs: PdfRef[],
  facetIds: string[],
  facets: PdfFacet[],
): PdfRef[] {
  if (!facetIds.length) return refs
  const urls = new Set<string>()
  for (const f of facets) {
    if (!facetIds.includes(f.facetId)) continue
    for (const r of f.pdfRefs) urls.add(r.url)
  }
  return refs.filter((r) => urls.has(r.url))
}
