import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { AcademicCalendarEventRecord } from '../src/data/academic-calendar-events'

type HighConfidenceRow = {
  archivo: string
  ruta?: string
  pagina?: number
  tabla?: number
  seccion?: string
  titulo: string
  categoria: 'feriado' | 'matricula' | 'actividad_academica' | 'evaluacion' | 'administrativo' | 'docente' | 'otro'
  inicio: string
  fin: string
  precision: 'alta'
  razonPrecision: string
  rawText?: string
}

const REPO = process.cwd()
const IN_PATH = path.join(REPO, 'data', 'derived', 'utpl-events-2026-high-confidence.json')
const OUT_PATH = path.join(REPO, 'src', 'data', 'calendar-events-high-confidence.json')

const CATEGORY_MAP: Record<HighConfidenceRow['categoria'], string> = {
  feriado: 'Feriado',
  matricula: 'Matrículas',
  actividad_academica: 'Académico',
  evaluacion: 'Evaluación',
  administrativo: 'Administrativo',
  docente: 'Docente',
  otro: 'Otro',
}

function normalizeUpperAscii(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasToken(text: string, phrase: string): boolean {
  return (` ${text} `).includes(` ${phrase} `)
}

function dedupeKeepOrder(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of values) {
    if (seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}

/**
 * Modalidad/alcance 100% desde evidencia textual explícita (sin inferencia):
 * - archivo
 * - titulo
 * - rawText
 * - seccion
 */
function deriveScopeLabel(row: HighConfidenceRow): string {
  const sourceText = normalizeUpperAscii(
    [row.archivo, row.titulo, row.rawText ?? '', row.seccion ?? ''].filter(Boolean).join(' '),
  )

  if (hasToken(sourceText, 'TODAS LAS MODALIDADES') || hasToken(sourceText, 'TODAS MODALIDADES')) {
    return 'Todas'
  }

  const modalities: string[] = []
  const roles: string[] = []

  const addMod = (value: string) => modalities.push(value)
  const addRole = (value: string) => roles.push(value)

  if (hasToken(sourceText, 'GR P')) addMod('GR P')
  if (hasToken(sourceText, 'GR D EL')) addMod('GR D-EL')
  if (hasToken(sourceText, 'GR D') && !modalities.includes('GR D-EL')) addMod('GR D')
  if (hasToken(sourceText, 'GR EL') && !modalities.includes('GR D-EL')) addMod('GR EL')

  if (hasToken(sourceText, 'PS P')) addMod('PS P')
  if (hasToken(sourceText, 'PS D EL P H')) addMod('PS D-EL-P-H')
  else if (hasToken(sourceText, 'PS D EL P')) addMod('PS D-EL-P')
  if (hasToken(sourceText, 'PS D P')) addMod('PS D-P')

  if (hasToken(sourceText, 'POS P') || hasToken(sourceText, 'POSGRADOS P')) addMod('POS P')
  if (hasToken(sourceText, 'POS EL HI') || hasToken(sourceText, 'POS EL') || hasToken(sourceText, 'POSGRADOS EL')) {
    addMod('POS EL-HI')
  }

  if (hasToken(sourceText, 'TEC EL')) addMod('TEC EL')
  if (hasToken(sourceText, 'TEC P')) addMod('TEC P')
  if (hasToken(sourceText, 'TEC') && !modalities.some((m) => m.startsWith('TEC '))) addMod('TEC')

  if (hasToken(sourceText, 'MP')) addMod('MP')
  if (hasToken(sourceText, 'MEL')) addMod('MEL')
  if (hasToken(sourceText, 'UIC')) addMod('UIC')
  if (hasToken(sourceText, 'UTE')) addMod('UTE')

  if (hasToken(sourceText, 'ESTUDIANTES') || hasToken(sourceText, 'ESTUDIANTE')) addRole('Estudiantes')
  if (hasToken(sourceText, 'DOCENTES') || hasToken(sourceText, 'DOCENTE')) addRole('Docentes')
  if (hasToken(sourceText, 'INTEGRO')) addRole('Íntegro')

  const modLabel = dedupeKeepOrder(modalities).join(' / ')
  const roleLabel = dedupeKeepOrder(roles).join(' / ')

  if (modLabel && roleLabel) return `${modLabel} · ${roleLabel}`
  if (modLabel) return modLabel
  if (roleLabel) return roleLabel
  return 'No especificada'
}

async function main() {
  const rows = JSON.parse(await readFile(IN_PATH, 'utf8')) as HighConfidenceRow[]

  const events: AcademicCalendarEventRecord[] = rows.map((row, index) => ({
    id: index + 1,
    title: row.titulo.trim(),
    start: row.inicio,
    end: row.fin,
    category: CATEGORY_MAP[row.categoria] ?? 'Otro',
    modality: deriveScopeLabel(row),
  }))

  await mkdir(path.dirname(OUT_PATH), { recursive: true })
  await writeFile(OUT_PATH, JSON.stringify(events, null, 2), 'utf8')

  const noSpec = events.filter((e) => e.modality === 'No especificada').length
  console.log(`Escrito ${path.relative(REPO, OUT_PATH)} con ${events.length} eventos`)
  console.log(`Modalidad 'No especificada': ${noSpec}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
