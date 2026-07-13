const SPANISH_MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const

function parseIsoDate(isoDate: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year, month, day }
}

/** Tokens used for natural-language date search (e.g. "15 junio", "junio 2026"). */
export function buildSpanishDateSearchTokens(isoDate: string): string[] {
  const parsed = parseIsoDate(isoDate)
  if (!parsed) return []

  const monthName = SPANISH_MONTHS[parsed.month - 1]
  const day = String(parsed.day)
  const dayPadded = day.padStart(2, '0')
  const monthPadded = String(parsed.month).padStart(2, '0')
  const year = String(parsed.year)

  return [
    day,
    dayPadded,
    monthName,
    `${day} ${monthName}`,
    `${dayPadded} ${monthName}`,
    `${day} de ${monthName}`,
    `${monthName} ${day}`,
    `${monthName} ${year}`,
    `${day} ${monthName} ${year}`,
    `${dayPadded} ${monthName} ${year}`,
    `${monthPadded}-${dayPadded}`,
    `${year}-${monthPadded}-${dayPadded}`,
  ]
}

export function buildSpanishDateSearchText(...isoDates: string[]): string {
  const tokens = new Set<string>()
  for (const isoDate of isoDates) {
    for (const token of buildSpanishDateSearchTokens(isoDate)) {
      tokens.add(token)
    }
  }
  return [...tokens].join(' ')
}
