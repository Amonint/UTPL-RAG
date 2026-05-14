export type CleanTableRow = {
  section: string | null
  raw: string
  cells: string[]
}

export type CleanTable = {
  tableIndex: number
  headersRaw: string[]
  rows: CleanTableRow[]
}

export type CleanPage = {
  pageNumber: number
  freeTextLines: string[]
  tables: CleanTable[]
}

export type CleanDocument = {
  label: string
  sourceName: string
  metadata: {
    archivo: string
    ruta: string
    bytes: number | null
  }
  pages: CleanPage[]
}

type Mode = 'none' | 'metadata' | 'free_text' | 'table'

const DOC_RE = /^\s*=====\s*(?:UNIQUE\s+|FUTURE\s+)?DOCUMENTO\s+\d+:\s*(.+?)\s*=====\s*$/i
const PAGE_RE = /^\s*===\s*P[ÁA]GINA\s+(\d+)\s*===\s*$/i
const TABLE_RE = /^\s*\[TABLA\s+(\d+)\]\s*$/i
const METADATA_RE = /^\s*\[METADATA\]\s*$/i
const FREE_TEXT_RE = /^\s*\[TEXTO LIBRE\]\s*$/i
const HEADER_RE = /^\s*HEADER:\s*(.*)\s*$/i
const SECTION_RE = /^\s*##\s*(.+?)\s*$/

function splitCells(raw: string): string[] {
  return raw.split('|').map((x) => x.trim())
}

export function parseTextractCleanText(input: string): CleanDocument[] {
  const lines = input.split(/\r?\n/)
  const docs: CleanDocument[] = []

  let mode: Mode = 'none'
  let currentDoc: CleanDocument | null = null
  let currentPage: CleanPage | null = null
  let currentTable: CleanTable | null = null
  let currentSection: string | null = null

  const flushTable = () => {
    if (!currentPage || !currentTable) return
    currentPage.tables.push(currentTable)
    currentTable = null
    currentSection = null
  }

  const flushPage = () => {
    flushTable()
    if (!currentDoc || !currentPage) return
    currentDoc.pages.push(currentPage)
    currentPage = null
  }

  const flushDoc = () => {
    flushPage()
    if (!currentDoc) return
    docs.push(currentDoc)
    currentDoc = null
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, '  ')
    const trimmed = line.trim()

    const docMatch = line.match(DOC_RE)
    if (docMatch) {
      flushDoc()
      currentDoc = {
        label: docMatch[1].trim(),
        sourceName: docMatch[1].trim(),
        metadata: { archivo: '', ruta: '', bytes: null },
        pages: [],
      }
      mode = 'none'
      continue
    }

    if (!currentDoc) continue

    if (METADATA_RE.test(line)) {
      flushTable()
      mode = 'metadata'
      continue
    }

    const pageMatch = line.match(PAGE_RE)
    if (pageMatch) {
      flushPage()
      currentPage = {
        pageNumber: parseInt(pageMatch[1], 10),
        freeTextLines: [],
        tables: [],
      }
      mode = 'none'
      continue
    }

    if (FREE_TEXT_RE.test(line)) {
      flushTable()
      if (!currentPage) {
        currentPage = { pageNumber: 1, freeTextLines: [], tables: [] }
      }
      mode = 'free_text'
      continue
    }

    const tableMatch = line.match(TABLE_RE)
    if (tableMatch) {
      flushTable()
      if (!currentPage) {
        currentPage = { pageNumber: 1, freeTextLines: [], tables: [] }
      }
      currentTable = {
        tableIndex: parseInt(tableMatch[1], 10),
        headersRaw: [],
        rows: [],
      }
      mode = 'table'
      continue
    }

    if (mode === 'metadata') {
      if (!trimmed) continue
      const idx = trimmed.indexOf(':')
      if (idx < 0) continue
      const key = trimmed.slice(0, idx).trim().toLowerCase()
      const value = trimmed.slice(idx + 1).trim()
      if (key === 'archivo') currentDoc.metadata.archivo = value
      else if (key === 'ruta') currentDoc.metadata.ruta = value
      else if (key === 'bytes') {
        const n = parseInt(value, 10)
        currentDoc.metadata.bytes = Number.isNaN(n) ? null : n
      }
      continue
    }

    if (mode === 'free_text') {
      if (!currentPage || !trimmed) continue
      currentPage.freeTextLines.push(trimmed)
      continue
    }

    if (mode === 'table' && currentTable) {
      if (!trimmed) continue
      const hm = line.match(HEADER_RE)
      if (hm) {
        currentTable.headersRaw.push(hm[1].trim())
        continue
      }
      const sm = line.match(SECTION_RE)
      if (sm) {
        currentSection = sm[1].trim()
        continue
      }
      if (!trimmed.includes('|')) continue
      currentTable.rows.push({
        section: currentSection,
        raw: trimmed,
        cells: splitCells(trimmed),
      })
      continue
    }
  }

  flushDoc()
  return docs
}
