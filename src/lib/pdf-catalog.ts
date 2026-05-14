import fs from 'node:fs/promises'
import path from 'node:path'

export type PdfCatalogEntry = {
  pdfId: string
  sha256: string
  name: string
  canonicalPath: string
  allPaths: string[]
  sourceFolders: string[]
  hierarchy: {
    sourceFolder: string
    grupo: string
    subgrupo: string
    modalidad: string
    nivel: string
    tipo: string
    periodo: string
    rol: string
  }
  searchText: string
}

type PdfCatalog = {
  generatedAt: string
  root: string
  sourceFolders: string[]
  summary: {
    inputPdfCount: number
    uniquePdfCount: number
    duplicateCopies: number
  }
  byHierarchy: Record<string, Record<string, Record<string, PdfCatalogEntry[]>>>
  pdfs: PdfCatalogEntry[]
}

const DEFAULT_PATH = path.join(process.cwd(), 'data', 'derived', 'doop-pdf-catalog.json')

let cache: PdfCatalog | null = null

export async function loadPdfCatalog(): Promise<PdfCatalog> {
  if (cache && process.env.SERVICIOS_UTPL_NO_CACHE !== '1') return cache
  const raw = await fs.readFile(DEFAULT_PATH, 'utf8')
  const parsed = JSON.parse(raw) as PdfCatalog
  cache = parsed
  return parsed
}

export function clearPdfCatalogCache() {
  cache = null
}
