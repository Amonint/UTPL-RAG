export type StudentType =
  | 'ALUMNI'
  | 'CONTINUO'
  | 'NUEVO'
  | 'POSTULANTE'
  | 'SIN_TIPO_EN_API'

export interface PdfRef {
  label: string
  url: string
  localPath: string
  sourcePath: string
  /** Pestaña de `requisitos_pestanas` (p. ej. GRADO / POSGRADO), si aplica. */
  pestana?: string
}

export interface PdfFacet {
  facetId: string
  pestana: string
  titulo: string
  itemTexto: string
  pdfRefs: PdfRef[]
  pdfCount: number
}

export interface CanonicalServiceRecord {
  serviceId: string
  serviceName: string
  category: string
  studentTypes: StudentType[]
  jsonPayload: Record<string, unknown>
  pdfRefs: PdfRef[]
}

export type SearchResult = {
  serviceId: string
  serviceName: string
  category: string
  /** Relevancia interna (0..1) para ordenar; no mostrar como % al usuario. */
  score: number
  hasPdfs: boolean
  snippet?: string
  /** Pistas breves según capa/campo donde coincidió la búsqueda. */
  matchHints?: string[]
  studentTypes?: StudentType[]
  pdfRefs?: PdfRef[]
  jsonPayload?: Record<string, unknown>
}
