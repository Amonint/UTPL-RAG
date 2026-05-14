import { extractIsoDatesFromText, normalizeTitle } from './textract-calendar-parse'
import type { CleanDocument, CleanTable, CleanTableRow } from './textract-clean-document-parser'

export type ConfidenceLevel = 'alta' | 'media' | 'baja'

export type ConfidenceEvent = {
  archivo: string
  ruta: string
  pagina: number
  tabla: number | null
  seccion: string | null
  titulo: string
  categoria:
    | 'feriado'
    | 'matricula'
    | 'actividad_academica'
    | 'evaluacion'
    | 'administrativo'
    | 'docente'
    | 'otro'
  inicio: string | null
  fin: string | null
  precision: ConfidenceLevel
  razonPrecision: string
  rawText: string
}

export type ExtractionOutput = {
  generatedAt: string
  source: string
  summary: {
    documents: number
    high: number
    medium: number
    low: number
  }
  alta_precision: ConfidenceEvent[]
  media_precision: ConfidenceEvent[]
  baja_precision_revision: ConfidenceEvent[]
}

type HeaderProfile =
  | { kind: 'simple'; titleIndex: number; startIndex: number; endIndex: number }
  | { kind: 'complex' }
  | { kind: 'unknown' }

type BuildOptions = {
  targetYear: number
  sourceLabel?: string
}

const STOP_TITLES = new Set([
  'utpl',
  'vicerrectorado academico',
  'la universidad catolica de loja',
  'actividad',
  'actividades academicas',
  'inicio',
  'fin',
  'evento',
  'observacion',
  'responsables',
  'rol ejecutor',
  'rol',
  'header',
])

const MONTH_YEAR_RE =
  /\b(ene(?:ro)?|feb(?:rero)?|mar(?:zo)?|abr(?:il)?|may(?:o)?|jun(?:io)?|jul(?:io)?|ago(?:sto)?|sep(?:tiembre)?|set(?:iembre)?|oct(?:ubre)?|nov(?:iembre)?|dic(?:iembre)?)\s+20\d{2}\b/i

function categoryFromTitle(title: string): ConfidenceEvent['categoria'] {
  const t = normalizeTitle(title)
  if (
    /(feriado|carnaval|viernes santo|dia del trabajo|batalla de pichincha|independencia|vacaciones institucionales)/i.test(
      t,
    )
  ) {
    return 'feriado'
  }
  if (/(matricula|matriculas|inscripcion|legalizacion|reserva de cupo)/i.test(t)) return 'matricula'
  if (/(evaluacion|examen|calificacion|recalificacion|impugnacion|siette)/i.test(t))
    return 'evaluacion'
  if (/(publicacion de notas|registro de notas|resultado|resultados|retiro|solicitud|reporte)/i.test(t))
    return 'administrativo'
  if (/(docente|plan docente|capacitacion|tutoria)/i.test(t)) return 'docente'
  if (/(actividad academica|clases|curso|inicio de actividades)/i.test(t)) return 'actividad_academica'
  return 'otro'
}

function splitHeaderCols(headersRaw: string[]): string[] {
  if (headersRaw.length === 0) return []
  const scored = headersRaw
    .map((raw) => raw.split('|').map((x) => x.trim()))
    .map((cols) => {
      let score = 0
      for (const c of cols) {
        const n = normalizeTitle(c)
        if (/actividad|evento|servicio|fase|nombre de tarea|actividad academica|actividades academicas/.test(n))
          score += 2
        if (/inicio|comienzo|fecha inicio|dia inicio|desde/.test(n)) score += 2
        if (/fin|fecha fin|dia fin|hasta/.test(n)) score += 2
      }
      return { cols, score }
    })
    .sort((a, b) => b.score - a.score || b.cols.length - a.cols.length)
  return scored[0]?.cols ?? []
}

function detectHeaderProfile(table: CleanTable): HeaderProfile {
  const cols = splitHeaderCols(table.headersRaw)
  if (cols.length === 0) return { kind: 'unknown' }

  const startIdx: number[] = []
  const endIdx: number[] = []
  const titleIdx: number[] = []

  cols.forEach((col, idx) => {
    const n = normalizeTitle(col)
    if (/^(actividad|evento|servicio|fase)$/.test(n) || /nombre de tarea|actividad academica|actividades academicas/.test(n)) {
      titleIdx.push(idx)
    }
    if (/fecha inicio|dia inicio|inicio|comienzo|desde/.test(n)) startIdx.push(idx)
    if (/fecha fin|dia fin|fin|hasta/.test(n)) endIdx.push(idx)
  })

  if (startIdx.length === 1 && endIdx.length === 1 && titleIdx.length >= 1) {
    return {
      kind: 'simple',
      titleIndex: titleIdx[0],
      startIndex: startIdx[0],
      endIndex: endIdx[0],
    }
  }

  if (startIdx.length > 1 || endIdx.length > 1) return { kind: 'complex' }
  return { kind: 'unknown' }
}

function validTitle(title: string): boolean {
  const n = normalizeTitle(title)
  if (!n) return false
  if (STOP_TITLES.has(n)) return false
  return true
}

function isoInYear(iso: string, year: number): boolean {
  return iso.startsWith(`${year}-`)
}

function minDate(dates: string[]): string {
  return [...dates].sort()[0]
}

function maxDate(dates: string[]): string {
  return [...dates].sort()[dates.length - 1]
}

function makeEvent(input: {
  doc: CleanDocument
  pageNumber: number
  tableIndex: number | null
  row: CleanTableRow | null
  title: string
  start: string | null
  end: string | null
  precision: ConfidenceLevel
  reason: string
}): ConfidenceEvent {
  return {
    archivo: input.doc.metadata.archivo || input.doc.sourceName,
    ruta: input.doc.metadata.ruta || input.doc.sourceName,
    pagina: input.pageNumber,
    tabla: input.tableIndex,
    seccion: input.row?.section ?? null,
    titulo: input.title.trim(),
    categoria: categoryFromTitle(input.title),
    inicio: input.start,
    fin: input.end,
    precision: input.precision,
    razonPrecision: input.reason,
    rawText: input.row?.raw ?? input.title,
  }
}

function dedupe(events: ConfidenceEvent[]): ConfidenceEvent[] {
  const out: ConfidenceEvent[] = []
  const seen = new Set<string>()
  for (const ev of events) {
    const base = `${normalizeTitle(ev.titulo)}|${ev.inicio ?? ''}|${ev.fin ?? ''}|${ev.categoria}`
    const key = ev.categoria === 'feriado' ? base : `${ev.archivo}|${base}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(ev)
  }
  return out
}

function parseSimpleRow(
  doc: CleanDocument,
  pageNumber: number,
  table: CleanTable,
  row: CleanTableRow,
  profile: Extract<HeaderProfile, { kind: 'simple' }>,
  targetYear: number,
): ConfidenceEvent | null {
  const title = row.cells[profile.titleIndex]?.trim() ?? ''
  if (!validTitle(title)) return null
  const startCell = row.cells[profile.startIndex] ?? ''
  const endCell = row.cells[profile.endIndex] ?? ''

  const ds = extractIsoDatesFromText(startCell)
  const de = extractIsoDatesFromText(endCell)
  if (ds.length !== 1 || de.length !== 1) {
    const all = extractIsoDatesFromText(row.raw)
    if (all.length >= 2) {
      return makeEvent({
        doc,
        pageNumber,
        tableIndex: table.tableIndex,
        row,
        title,
        start: minDate(all),
        end: maxDate(all),
        precision: 'media',
        reason: 'fila_simple_fechas_multiples',
      })
    }
    return makeEvent({
      doc,
      pageNumber,
      tableIndex: table.tableIndex,
      row,
      title,
      start: null,
      end: null,
      precision: 'baja',
      reason: 'fila_simple_fecha_incompleta',
    })
  }

  let start = ds[0]
  let end = de[0]
  let reason = 'tabla_header_simple_fechas_columnas_inicio_fin'
  let precision: ConfidenceLevel = 'alta'
  if (start > end) {
    ;[start, end] = [end, start]
    precision = 'media'
    reason = 'tabla_simple_fechas_invertidas_normalizadas'
  }

  const yearOk = isoInYear(start, targetYear) || isoInYear(end, targetYear)
  if (!yearOk) {
    return makeEvent({
      doc,
      pageNumber,
      tableIndex: table.tableIndex,
      row,
      title,
      start,
      end,
      precision: 'baja',
      reason: 'fecha_fuera_de_anio_objetivo',
    })
  }

  return makeEvent({
    doc,
    pageNumber,
    tableIndex: table.tableIndex,
    row,
    title,
    start,
    end,
    precision,
    reason,
  })
}

function parseComplexRow(
  doc: CleanDocument,
  pageNumber: number,
  table: CleanTable,
  row: CleanTableRow,
): ConfidenceEvent | null {
  const first = row.cells.find((c) => c.trim().length > 0) ?? ''
  if (!validTitle(first)) return null
  const all = extractIsoDatesFromText(row.raw)
  if (all.length < 2) {
    return makeEvent({
      doc,
      pageNumber,
      tableIndex: table.tableIndex,
      row,
      title: first,
      start: null,
      end: null,
      precision: 'baja',
      reason: 'tabla_compleja_sin_par_de_fechas',
    })
  }
  return makeEvent({
    doc,
    pageNumber,
    tableIndex: table.tableIndex,
    row,
    title: first,
    start: minDate(all),
    end: maxDate(all),
    precision: 'media',
    reason: 'tabla_compleja_multiples_fechas',
  })
}

function freeTextCandidates(doc: CleanDocument, pageNumber: number, line: string): ConfidenceEvent | null {
  const t = line.trim()
  if (!t) return null
  if (!validTitle(t)) return null
  const dates = extractIsoDatesFromText(t)
  if (dates.length >= 2) {
    return makeEvent({
      doc,
      pageNumber,
      tableIndex: null,
      row: null,
      title: t,
      start: minDate(dates),
      end: maxDate(dates),
      precision: 'baja',
      reason: 'texto_libre_fechas_sin_tabla',
    })
  }
  if (dates.length === 1) {
    return makeEvent({
      doc,
      pageNumber,
      tableIndex: null,
      row: null,
      title: t,
      start: dates[0],
      end: dates[0],
      precision: 'baja',
      reason: 'texto_libre_fecha_unica',
    })
  }
  if (MONTH_YEAR_RE.test(t)) {
    return makeEvent({
      doc,
      pageNumber,
      tableIndex: null,
      row: null,
      title: t,
      start: null,
      end: null,
      precision: 'baja',
      reason: 'texto_libre_mes_sin_dia',
    })
  }
  return null
}

export function extractEventsByConfidence(
  docs: CleanDocument[],
  options: BuildOptions,
): ExtractionOutput {
  const high: ConfidenceEvent[] = []
  const medium: ConfidenceEvent[] = []
  const low: ConfidenceEvent[] = []

  for (const doc of docs) {
    for (const page of doc.pages) {
      for (const table of page.tables) {
        const profile = detectHeaderProfile(table)
        for (const row of table.rows) {
          let ev: ConfidenceEvent | null = null
          if (profile.kind === 'simple') {
            ev = parseSimpleRow(doc, page.pageNumber, table, row, profile, options.targetYear)
          } else if (profile.kind === 'complex') {
            ev = parseComplexRow(doc, page.pageNumber, table, row)
          } else {
            const all = extractIsoDatesFromText(row.raw)
            const title = row.cells.find((c) => validTitle(c)) ?? ''
            if (!title) continue
            ev =
              all.length >= 2
                ? makeEvent({
                    doc,
                    pageNumber: page.pageNumber,
                    tableIndex: table.tableIndex,
                    row,
                    title,
                    start: minDate(all),
                    end: maxDate(all),
                    precision: 'media',
                    reason: 'tabla_sin_header_pero_con_fechas',
                  })
                : makeEvent({
                    doc,
                    pageNumber: page.pageNumber,
                    tableIndex: table.tableIndex,
                    row,
                    title,
                    start: null,
                    end: null,
                    precision: 'baja',
                    reason: 'tabla_sin_header_fecha_incompleta',
                  })
          }
          if (!ev) continue
          if (ev.precision === 'alta') high.push(ev)
          else if (ev.precision === 'media') medium.push(ev)
          else low.push(ev)
        }
      }

      for (const line of page.freeTextLines) {
        const ev = freeTextCandidates(doc, page.pageNumber, line)
        if (ev) low.push(ev)
      }
    }
  }

  const highDedup = dedupe(high)
  const mediumDedup = dedupe(medium)
  const lowDedup = dedupe(low)

  return {
    generatedAt: new Date().toISOString(),
    source: options.sourceLabel ?? 'textract-clean',
    summary: {
      documents: docs.length,
      high: highDedup.length,
      medium: mediumDedup.length,
      low: lowDedup.length,
    },
    alta_precision: highDedup,
    media_precision: mediumDedup,
    baja_precision_revision: lowDedup,
  }
}
