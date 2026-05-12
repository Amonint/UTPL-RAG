import type { PdfRef } from '@/lib/types'

function isPdfUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const t = value.trim().toLowerCase()
  return t.startsWith('http') && t.includes('.pdf')
}

export interface PdfChipOption {
  /** Igual a `PdfRef.sourcePath` del artefacto canonical. */
  selectionId: string
  label: string
  url: string
}

export interface PdfChipSection {
  /** Subtítulo (ej. «Estudiantes REDISEÑO»); null = chips directos bajo la pestaña. */
  subsectionTitle: string | null
  options: PdfChipOption[]
}

export interface PdfChipGroup {
  groupId: string
  /** Pestaña o «Manuales». */
  heading: string
  sections: PdfChipSection[]
}

function refByUrl(pdfRefs: PdfRef[]): Map<string, PdfRef> {
  const m = new Map<string, PdfRef>()
  for (const r of pdfRefs) {
    if (!m.has(r.url)) m.set(r.url, r)
  }
  return m
}

function optionFromUrl(url: string, label: string, byUrl: Map<string, PdfRef>): PdfChipOption | null {
  const ref = byUrl.get(url)
  if (!ref) return null
  return {
    selectionId: ref.sourcePath,
    label: label.trim() || ref.label || 'Documento PDF',
    url: ref.url,
  }
}

function slugHeading(heading: string, index: number) {
  const s = heading
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${s.length > 0 ? s : 'grupo'}-${index}`
}

/**
 * Recorre `lista` (y `lista` anidadas) con prefijos alineados a `collectPdfRefs` en load-artifacts.
 */
function collectListaSections(
  lista: unknown,
  prefix: string,
  byUrl: Map<string, PdfRef>,
): PdfChipSection[] {
  if (!Array.isArray(lista)) return []

  const sections: PdfChipSection[] = []
  let flatBuffer: PdfChipOption[] = []

  function flushFlat() {
    if (flatBuffer.length === 0) return
    sections.push({ subsectionTitle: null, options: flatBuffer })
    flatBuffer = []
  }

  for (let li = 0; li < lista.length; li++) {
    const item = lista[li]
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const o = item as Record<string, unknown>

    if (typeof o.titulo === 'string' && Array.isArray(o.items)) {
      flushFlat()
      const subOpts: PdfChipOption[] = []
      const items = o.items as unknown[]
      for (let ii = 0; ii < items.length; ii++) {
        const row = items[ii]
        if (!row || typeof row !== 'object' || Array.isArray(row)) continue
        const pdf = (row as Record<string, unknown>).pdf
        const texto = (row as Record<string, unknown>).texto
        if (!isPdfUrl(pdf)) continue
        const opt = optionFromUrl(pdf, typeof texto === 'string' ? texto : 'PDF', byUrl)
        if (opt) subOpts.push(opt)
      }
      if (subOpts.length > 0) {
        sections.push({ subsectionTitle: o.titulo.trim() || null, options: subOpts })
      }
      continue
    }

    if (isPdfUrl(o.pdf)) {
      const texto = o.texto
      const url = o.pdf
      const opt = optionFromUrl(url, typeof texto === 'string' ? texto : 'PDF', byUrl)
      if (opt) flatBuffer.push(opt)
      continue
    }

    if (Array.isArray(o.lista)) {
      flushFlat()
      const nested = collectListaSections(o.lista, `${prefix}.${li}.lista`, byUrl)
      sections.push(...nested)
    }
  }

  flushFlat()
  return sections
}

function mergeSectionsForGroup(sections: PdfChipSection[]): PdfChipSection[] {
  const out: PdfChipSection[] = []
  for (const s of sections) {
    if (s.options.length === 0) continue
    const prev = out[out.length - 1]
    if (prev && prev.subsectionTitle === null && s.subsectionTitle === null) {
      prev.options.push(...s.options)
    } else {
      out.push({ ...s, options: [...s.options] })
    }
  }
  return out
}

export function buildPdfChipGroups(
  jsonPayload: Record<string, unknown>,
  pdfRefs: PdfRef[],
): PdfChipGroup[] {
  if (pdfRefs.length === 0) return []

  const byUrl = refByUrl(pdfRefs)
  const groups: PdfChipGroup[] = []

  const manual = jsonPayload.manual
  if (Array.isArray(manual)) {
    const manualOpts: PdfChipOption[] = []
    manual.forEach((entry, i) => {
      if (!entry || typeof entry !== 'object') return
      const row = entry as Record<string, unknown>
      const url = row.url ?? row.pdf
      if (!isPdfUrl(url)) return
      const label = typeof row.texto === 'string' ? row.texto : 'Manual'
      const byPath = pdfRefs.find((r) => r.sourcePath === `manual.${i}`)
      if (byPath) {
        manualOpts.push({
          selectionId: byPath.sourcePath,
          label: label.trim() || byPath.label,
          url: byPath.url,
        })
        return
      }
      const opt = optionFromUrl(url, label, byUrl)
      if (opt) manualOpts.push(opt)
    })
    if (manualOpts.length > 0) {
      groups.push({
        groupId: 'manuales',
        heading: 'Manuales',
        sections: [{ subsectionTitle: null, options: manualOpts }],
      })
    }
  }

  const tabs = jsonPayload.requisitos_pestanas
  if (!Array.isArray(tabs)) return groups

  for (let ti = 0; ti < tabs.length; ti++) {
    const tab = tabs[ti]
    if (!tab || typeof tab !== 'object') continue
    const pestaña = String((tab as Record<string, unknown>).pestaña ?? `Pestaña ${ti + 1}`).trim()
    const contenido = (tab as Record<string, unknown>).contenido
    if (!Array.isArray(contenido)) continue

    const allSections: PdfChipSection[] = []
    for (let ci = 0; ci < contenido.length; ci++) {
      const block = contenido[ci]
      if (!block || typeof block !== 'object') continue
      const lista = (block as Record<string, unknown>).lista
      const prefix = `requisitos_pestanas.${ti}.contenido.${ci}.lista`
      allSections.push(...collectListaSections(lista, prefix, byUrl))
    }

    const merged = mergeSectionsForGroup(allSections)
    const nonEmpty = merged.filter((s) => s.options.length > 0)
    if (nonEmpty.length === 0) continue

    groups.push({
      groupId: `pestana-${slugHeading(pestaña, ti)}`,
      heading: pestaña,
      sections: nonEmpty,
    })
  }

  return groups
}

export function buildPdfSelectionSnapshot(jsonPayload: Record<string, unknown>, pdfRefs: PdfRef[]) {
  const pdfCount = pdfRefs.length
  const groups = buildPdfChipGroups(jsonPayload, pdfRefs)
  return { groups, pdfCount }
}

/** Ids seleccionados por defecto: el único PDF si `pdfCount === 1`. */
export function defaultSelectedPdfIds(pdfCount: number, pdfRefs: PdfRef[]): string[] {
  if (pdfCount !== 1 || pdfRefs.length !== 1) return []
  return [pdfRefs[0]!.sourcePath]
}
