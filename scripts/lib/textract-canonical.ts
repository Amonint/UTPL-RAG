/**
 * Modelo canónico de un evento extraído de Textract (título, rango, contexto).
 * Ver comentario al final sobre extensiones opcionales (QUERIES / LLM).
 */

export type CanonicalEvent = {
  title: string
  start: string | null
  end: string | null
  sectionPath: string[]
  sourceKind: 'table_row' | 'line' | 'layout_list'
  page?: number
  tableIndex?: number
  rowIndex?: number
  parentActivity?: string
  rawText: string
  datesIso: string[]
}

/**
 * Extensiones opcionales (no implementadas en código; evaluación):
 *
 * 1) **Amazon Textract Queries** (`FeatureType.QUERIES`): en `StartDocumentAnalysis` añadir
 *    `QUERIES` y `QueriesConfig` con preguntas por alias (p. ej. "fecha de inicio de matrícula").
 *    Requiere definir plantillas por familia de PDF. Útil cuando la heurística de tablas/listas falla.
 *
 * 2) **LLM sobre texto linearizado**: por página, concatenar bloques en orden (LINE / LAYOUT) y
 *    pedir solo JSON de eventos cuando `collectCanonicalCandidates` devuelva pocos o ningún candidato.
 *    Mantener Textract como fuente de verdad de geometría y texto.
 */
