/**
 * Utilidades para pasar de texto Textract a fechas ISO (yyyy-mm-dd).
 */

const DATE_RE = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g

function pad(n: string): string {
  return n.length === 1 ? `0${n}` : n
}

export function ddmmyyyyToIso(day: string, month: string, year: string): string | null {
  const d = parseInt(day, 10)
  const m = parseInt(month, 10)
  const y = parseInt(year, 10)
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null
  return `${y}-${pad(String(m))}-${pad(String(d))}`
}

/** Extrae todas las fechas dd/mm/yyyy en orden de aparición. */
export function extractIsoDatesFromText(text: string): string[] {
  const out: string[] = []
  DATE_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = DATE_RE.exec(text)) !== null) {
    const iso = ddmmyyyyToIso(m[1], m[2], m[3])
    if (iso) out.push(iso)
  }
  return out
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
