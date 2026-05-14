/**
 * Fase 2: lee JSON crudos de data/derived/textract-raw/*.json (excepto manifest),
 * reconstruye filas de tablas y líneas con fechas, emite candidatos y diff vs EVENTS.
 *
 * Uso:
 *   npm run process:textract-calendar -- [--help]
 */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { EVENTS, type AcademicCalendarEventRecord } from '../src/data/academic-calendar-events'
import {
  type CalendarCandidateRow,
  collectCandidates,
} from './lib/textract-blocks-from-json'
import { normalizeTitle } from './lib/textract-calendar-parse'

const REPO_ROOT = process.cwd()
const RAW_DIR = path.join(REPO_ROOT, 'data', 'derived', 'textract-raw')
const OUT_JSON = path.join(REPO_ROOT, 'data', 'derived', 'textract-calendar-candidates.json')
const OUT_MD = path.join(REPO_ROOT, 'data', 'derived', 'textract-vs-events.md')

type RawFile = {
  version: number
  relativePath?: string
  blocks?: import('@aws-sdk/client-textract').Block[]
}

function parseArgs(argv: string[]) {
  for (const a of argv) {
    if (a === '--help' || a === '-h') {
      console.log(`process-textract-raw-to-calendar

Lee ${path.relative(REPO_ROOT, RAW_DIR)}/*.json (sin manifest) y escribe:
  - ${path.relative(REPO_ROOT, OUT_JSON)}
  - ${path.relative(REPO_ROOT, OUT_MD)}
`)
      process.exit(0)
    }
  }
}

function eventKey(e: AcademicCalendarEventRecord): string {
  return `${e.start}|${e.end}|${normalizeTitle(e.title)}`
}

function bestEventForCandidate(
  c: CalendarCandidateRow,
  events: AcademicCalendarEventRecord[],
): AcademicCalendarEventRecord | null {
  if (!c.inferredStart || !c.inferredEnd) return null
  const nt = normalizeTitle(c.title ?? c.rawText)
  let best: { ev: AcademicCalendarEventRecord; score: number } | null = null
  for (const ev of events) {
    if (ev.start !== c.inferredStart || ev.end !== c.inferredEnd) continue
    const evNt = normalizeTitle(ev.title)
    let score = 0
    if (nt.includes(evNt) || evNt.includes(nt)) score = 100
    else {
      const a = new Set(nt.split(' ').filter((x) => x.length > 3))
      const b = new Set(evNt.split(' ').filter((x) => x.length > 3))
      let inter = 0
      for (const x of a) if (b.has(x)) inter += 1
      score = inter
    }
    if (!best || score > best.score) best = { ev, score }
  }
  return best && best.score >= 2 ? best.ev : null
}

async function main() {
  parseArgs(process.argv.slice(2))

  let files: string[]
  try {
    files = await readdir(RAW_DIR)
  } catch {
    console.error(`No se pudo leer ${RAW_DIR}. Ejecuta antes extract:doop-textract.`)
    process.exit(1)
  }

  const jsonFiles = files.filter((f) => f.endsWith('.json') && f !== 'manifest.json')
  if (jsonFiles.length === 0) {
    console.error('No hay JSON de Textract en textract-raw/.')
    process.exit(1)
  }

  const allCandidates: CalendarCandidateRow[] = []
  for (const jf of jsonFiles.sort()) {
    const full = path.join(RAW_DIR, jf)
    let raw: RawFile
    try {
      raw = JSON.parse(await readFile(full, 'utf8')) as RawFile
    } catch {
      continue
    }
    if (raw.version !== 1 || !Array.isArray(raw.blocks)) continue
    allCandidates.push(...collectCandidates(jf, raw.relativePath, raw.blocks))
  }

  const matched: { candidate: CalendarCandidateRow; eventId: number; eventTitle: string }[] = []
  const gaps: CalendarCandidateRow[] = []

  for (const c of allCandidates) {
    const ev = bestEventForCandidate(c, EVENTS)
    if (ev) {
      matched.push({ candidate: c, eventId: ev.id, eventTitle: ev.title })
      continue
    }
    if (c.inferredStart && c.inferredEnd) {
      const k = `${c.inferredStart}|${c.inferredEnd}|${normalizeTitle(c.title ?? c.rawText)}`
      const ev2 = EVENTS.find((e) => eventKey(e) === k)
      if (ev2) {
        matched.push({ candidate: c, eventId: ev2.id, eventTitle: ev2.title })
        continue
      }
    }
    if (c.datesIso.length > 0) gaps.push(c)
  }

  const matchedEventIds = new Set(matched.map((m) => m.eventId))
  const eventsWithoutCandidate = EVENTS.filter((e) => !matchedEventIds.has(e.id))

  const summary = {
    generatedAt: new Date().toISOString(),
    rawFiles: jsonFiles.length,
    candidateRows: allCandidates.length,
    matchedApprox: matched.length,
    gaps: gaps.length,
    eventsWithoutCandidate: eventsWithoutCandidate.length,
  }

  await writeFile(
    OUT_JSON,
    JSON.stringify(
      {
        version: 1,
        summary,
        candidates: allCandidates,
        matched,
        gaps,
        eventsWithoutCandidate,
      },
      null,
      2,
    ),
    'utf8',
  )

  const md: string[] = []
  md.push('# Textract vs calendario académico (EVENTS)', '')
  md.push(`Generado: ${summary.generatedAt}`, '')
  md.push('## Resumen', '')
  md.push('| Métrica | Valor |', '|---------|-------|')
  md.push(`| Archivos JSON Textract | ${summary.rawFiles} |`)
  md.push(`| Filas candidatas (tabla o línea con fechas) | ${summary.candidateRows} |`)
  md.push(`| Candidatos emparejados con un evento | ${summary.matchedApprox} |`)
  md.push(`| Candidatos con fechas sin match claro (huecos) | ${summary.gaps} |`)
  md.push(`| Eventos sin ningún candidato emparejado | ${summary.eventsWithoutCandidate} |`)
  md.push('', '## Candidatos sin match (revisar)', '')
  for (const g of gaps.slice(0, 200)) {
    md.push(
      `- **${g.sourceRelative}** (${g.kind}) — ${g.inferredStart ?? '?'} … ${g.inferredEnd ?? '?'} — ${g.rawText.slice(0, 160)}${g.rawText.length > 160 ? '…' : ''}`,
    )
  }
  if (gaps.length > 200) md.push('', `_…y ${gaps.length - 200} más (ver JSON)._`)
  md.push('', '## Eventos sin candidato emparejado (primeros 80)', '')
  for (const e of eventsWithoutCandidate.slice(0, 80)) {
    md.push(`- **#${e.id}** ${e.start}–${e.end} [${e.modality}] — ${e.title}`)
  }
  if (eventsWithoutCandidate.length > 80) {
    md.push('', `_…y ${eventsWithoutCandidate.length - 80} más (ver JSON)._`)
  }

  await writeFile(OUT_MD, md.join('\n'), 'utf8')
  console.log(`Escrito ${path.relative(REPO_ROOT, OUT_JSON)}`)
  console.log(`Escrito ${path.relative(REPO_ROOT, OUT_MD)}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
