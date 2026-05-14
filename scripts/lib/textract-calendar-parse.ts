/**
 * Utilidades para pasar de texto Textract a fechas ISO (yyyy-mm-dd).
 *
 * Soporta:
 * - dd/mm/yyyy (común en tablas digitales)
 * - «15 de marzo de 2026», «15 de marzo 2026», «15 de marzo del 2026» (escaneados UTPL)
 * - Rangos lista/bullet: «Del 2 al 6 de abril de 2026», «Del 12 de febrero al 1 de abril de 2026»
 * - PDF nativos UTPL: «vie 6/3/26», «mié 10/12/25» (día abreviado opcional, año 2 o 4 cifras)
 */

/** Opcional prefijo lun–dom; año `/26` → 2026. */
const DATE_SLASH_RE =
  /\b(?:(?:lun|mar|mi[eé]|jue|vie|s[aá]b|dom)\s+)?(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\b/gi

/**
 * Tras el nombre del mes: «de 2025», «del 2025» o solo «2025».
 * El día de la semana largo («Lunes», …) puede preceder al día; no hace falta capturarlo.
 */
const DATE_ES_LONG_RE =
  /\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+(?:de\s+|del\s+)?(\d{4})\b/gi

/** «Del 2 al 6 de abril de 2026» (mismo mes y año). */
const RANGE_SAME_MONTH_RE =
  /\b(?:Del\s+|del\s+)?(\d{1,2})\s+al\s+(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+(?:de\s+|del\s+)?(\d{4})\b/gi

/**
 * «Del 12 de febrero al 1 de abril de 2026» — solo el segundo extremo lleva año explícito.
 * Si mes1 > mes2 (ej. dic → ene), el primer año se toma como año_anterior.
 */
const RANGE_CROSS_MONTH_RE =
  /\b(?:Del\s+|del\s+)?(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+al\s+(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+(?:de\s+|del\s+)?(\d{4})\b/gi

const MONTH_ES: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
}

function pad(n: string): string {
  return n.length === 1 ? `0${n}` : n
}

function stripAccents(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** True si y-m-d existe en calendario gregoriano (UTC). */
export function isValidCalendarIso(y: number, m: number, d: number): boolean {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/** Año `/26` → 2000+26; `/2026` literal (documentos UTPL 2000–2099). */
function normalizeSlashYearPart(yearStr: string): number | null {
  if (yearStr.length === 4) {
    const y = parseInt(yearStr, 10)
    return Number.isNaN(y) ? null : y
  }
  if (yearStr.length === 2) {
    const y = parseInt(yearStr, 10)
    return Number.isNaN(y) ? null : 2000 + y
  }
  return null
}

export function ddmmyyyyToIso(day: string, month: string, year: string): string | null {
  const d = parseInt(day, 10)
  const m = parseInt(month, 10)
  const y = normalizeSlashYearPart(year)
  if (y === null || !isValidCalendarIso(y, m, d)) return null
  return `${y}-${pad(String(m))}-${pad(String(d))}`
}

function spanishLongToIso(day: string, monthName: string, year: string): string | null {
  const d = parseInt(day, 10)
  const y = parseInt(year, 10)
  const mo = MONTH_ES[stripAccents(monthName)]
  if (mo === undefined) return null
  if (!isValidCalendarIso(y, mo, d)) return null
  return `${y}-${pad(String(mo))}-${pad(String(d))}`
}

function isoFromParts(day: string, monthName: string, yearNum: number): string | null {
  const d = parseInt(day, 10)
  const mo = MONTH_ES[stripAccents(monthName)]
  if (mo === undefined) return null
  if (!isValidCalendarIso(yearNum, mo, d)) return null
  return `${yearNum}-${pad(String(mo))}-${pad(String(d))}`
}

/** Si mes_inicio > mes_fin en calendario (ej. diciembre → enero), cruza años. */
function inferYearsCrossMonth(month1: string, month2: string, yearEnd: number): [number, number] | null {
  const i1 = MONTH_ES[stripAccents(month1)]
  const i2 = MONTH_ES[stripAccents(month2)]
  if (i1 === undefined || i2 === undefined) return null
  if (i1 < i2) return [yearEnd, yearEnd]
  if (i1 > i2) return [yearEnd - 1, yearEnd]
  return [yearEnd, yearEnd]
}

type DateHit = { index: number; iso: string }
type Span = { start: number; end: number }

function overlapsAnySpan(start: number, end: number, spans: Span[]): boolean {
  return spans.some((s) => start < s.end && end > s.start)
}

function hitsSpanishLong(text: string, spans: Span[]): DateHit[] {
  const out: DateHit[] = []
  DATE_ES_LONG_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = DATE_ES_LONG_RE.exec(text)) !== null) {
    const start = m.index
    const end = start + m[0].length
    if (overlapsAnySpan(start, end, spans)) continue
    const iso = spanishLongToIso(m[1], m[2], m[3])
    if (iso) out.push({ index: start, iso })
  }
  return out
}

function hitsDdmmyyyyFiltered(text: string, spans: Span[]): DateHit[] {
  const out: DateHit[] = []
  DATE_SLASH_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = DATE_SLASH_RE.exec(text)) !== null) {
    const start = m.index
    const end = start + m[0].length
    if (overlapsAnySpan(start, end, spans)) continue
    const iso = ddmmyyyyToIso(m[1], m[2], m[3])
    if (iso) out.push({ index: start, iso })
  }
  return out
}

/** Rangos compactos en listas (excluyen segmentos para no quedarse solo con una fecha suelta). */
function hitsSpanishRangePatterns(text: string): { hits: DateHit[]; spans: Span[] } {
  const hits: DateHit[] = []
  const spans: Span[] = []

  RANGE_SAME_MONTH_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = RANGE_SAME_MONTH_RE.exec(text)) !== null) {
    const iso1 = isoFromParts(m[1], m[3], parseInt(m[4], 10))
    const iso2 = isoFromParts(m[2], m[3], parseInt(m[4], 10))
    if (iso1 && iso2) {
      spans.push({ start: m.index, end: m.index + m[0].length })
      hits.push({ index: m.index, iso: iso1 }, { index: m.index, iso: iso2 })
    }
  }

  RANGE_CROSS_MONTH_RE.lastIndex = 0
  while ((m = RANGE_CROSS_MONTH_RE.exec(text)) !== null) {
    const start = m.index
    const end = start + m[0].length
    if (overlapsAnySpan(start, end, spans)) continue
    const yEnd = parseInt(m[5], 10)
    const years = inferYearsCrossMonth(m[2], m[4], yEnd)
    if (!years) continue
    const [y1, y2] = years
    const iso1 = isoFromParts(m[1], m[2], y1)
    const iso2 = isoFromParts(m[3], m[4], y2)
    if (iso1 && iso2) {
      spans.push({ start, end })
      hits.push({ index: start, iso: iso1 }, { index: start, iso: iso2 })
    }
  }

  return { hits, spans }
}

/** Extrae todas las fechas reconocidas en orden de aparición en el texto. */
export function extractIsoDatesFromText(text: string): string[] {
  const { hits: rangeHits, spans } = hitsSpanishRangePatterns(text)
  const merged = [
    ...rangeHits,
    ...hitsDdmmyyyyFiltered(text, spans),
    ...hitsSpanishLong(text, spans),
  ].sort((a, b) => {
    if (a.index !== b.index) return a.index - b.index
    return a.iso.localeCompare(b.iso)
  })
  return merged.map((h) => h.iso)
}

/** Primera y última fecha del texto como rango (una sola fecha → start === end). */
export function inferRangeFromText(text: string): { start: string; end: string } | null {
  const dates = extractIsoDatesFromText(text)
  if (dates.length === 0) return null
  const sorted = [...dates].sort()
  return { start: sorted[0], end: sorted[sorted.length - 1] }
}

export function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9áéíóúüñ\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
