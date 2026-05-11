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
  score: number // 0..1
  hasPdfs: boolean
  snippet?: string
  studentTypes?: StudentType[]
  pdfRefs?: PdfRef[]
  jsonPayload?: Record<string, unknown>
}
