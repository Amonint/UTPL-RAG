/**
 * Lee data/derived/textract-calendar-candidates.json y genera el calendario
 * SOLO desde filas Textract (deduplicadas), sin mezclar academic-calendar-events.
 *
 * Salida: src/data/calendar-events-active.json
 *
 * Uso: npm run calendar:emit-from-textract
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { AcademicCalendarEventRecord } from '../src/data/academic-calendar-events'
import { normalizeTitle } from './lib/textract-calendar-parse'

const REPO = process.cwd()
const CANDIDATES_PATH = path.join(REPO, 'data', 'derived', 'textract-calendar-candidates.json')
const OUT_JSON = path.join(REPO, 'src', 'data', 'calendar-events-active.json')

type Candidate = {
  sourceRelative: string
  rawText: string
  inferredStart: string | null
  inferredEnd: string | null
}

function candidateTitle(c: Candidate): string {
  const first = c.rawText.split('|')[0]?.trim() ?? c.rawText.trim()
  return first.replace(/\s+/g, ' ').slice(0, 400)
}

function guessCategory(title: string): string {
  const t = title.toLowerCase()
  if (/feriado|carnaval|navidad|año nuevo|independencia|difuntos|pichincha|viernes santo|guayaquil|cuenca|loja|grito/i.test(t))
    return 'Feriado'
  if (/vacacion/i.test(t)) return 'Vacaciones'
  if (/matrícula|matricula|reserva de cupo/i.test(t)) return 'Matrículas'
  if (/validación general|validacion general|validación de inglés|validacion de ingles|suficiencia|listening|speaking/i.test(t))
    return 'Val. General'
  if (/inglés|ingles|ielts|toefl/i.test(t)) return 'Inglés'
  if (/evaluación|evaluacion|examen complexivo|heteroevaluación/i.test(t)) return 'Evaluación'
  if (/nota|publicación de notas|publicacion de notas|gradebook|recalificaci/i.test(t)) return 'Notas'
  if (/retiro|recalific|solicitud|impugnaci|trámite|tramite|reconocimiento de estudios/i.test(t))
    return 'Trámite'
  if (/recuperación|recuperacion|tutoría|tutoria/i.test(t)) return 'Recuperación'
  if (/doctorado|química|admisión|admision/i.test(t)) return 'Doctorado Química'
  if (/titulación|titulacion|ute|uic|complexivo|trabajo de titulación/i.test(t)) return 'Titulación'
  if (/cce|competencias específicas|competencias especificas/i.test(t)) return 'CCE'
  if (/modular/i.test(t)) return 'Modular'
  if (/inicio del ciclo|bimestre|académic|academic|jornadas de presentación/i.test(t)) return 'Académico'
  return 'Académico'
}

function guessModality(relPath: string): string {
  const p = relPath.toUpperCase()
  if (p.includes('_GR_P_') && p.includes('ESTUDIANTE')) return 'GR P'
  if (p.includes('_GR_P_') && p.includes('DOCENTE')) return 'GR P'
  if (p.includes('GR__P__') || p.includes('GR_P')) return 'GR P'
  if (p.includes('POSGRADOS_P') || p.includes('POS_P')) return 'POS P'
  if (p.includes('POSGRADOS_EL') || p.includes('POS_EL')) return 'POS EL-HI'
  if (p.includes('TEC_EL')) return 'TEC EL'
  if (p.includes('GR_D-EL') || p.includes('GR_D_EL') || p.includes('GR-TEC_D')) return 'GR D-EL / TEC EL / POS EL-HI / POS P'
  if (p.includes('PS_P') || p.includes('DOCTORADO')) return 'PS P'
  if (p.includes('MP_') || p.includes('_MP')) return 'Val. General MP'
  if (p.includes('UTE') || p.includes('UIC')) return 'UIC/UTE'
  return 'Todas'
}

function dedupeCandidates(rows: Candidate[]): Candidate[] {
  const seen = new Set<string>()
  const out: Candidate[] = []
  for (const c of rows) {
    if (!c.inferredStart || !c.inferredEnd) continue
    let { inferredStart: s, inferredEnd: e } = c
    if (s > e) [s, e] = [e, s]
    const key = `${s}|${e}|${normalizeTitle(candidateTitle(c))}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ ...c, inferredStart: s, inferredEnd: e })
  }
  return out
}

async function main() {
  const raw = JSON.parse(await readFile(CANDIDATES_PATH, 'utf8')) as {
    candidates?: Candidate[]
  }
  const candidates = raw.candidates ?? []
  const deduped = dedupeCandidates(candidates)

  const events: AcademicCalendarEventRecord[] = []
  let id = 1
  for (const c of deduped) {
    if (!c.inferredStart || !c.inferredEnd) continue
    const title = candidateTitle(c)
    if (!title) continue
    events.push({
      id: id++,
      title,
      start: c.inferredStart,
      end: c.inferredEnd,
      category: guessCategory(title),
      modality: guessModality(c.sourceRelative),
    })
  }

  events.sort((a, b) => {
    const d = a.start.localeCompare(b.start)
    return d !== 0 ? d : a.id - b.id
  })

  await mkdir(path.dirname(OUT_JSON), { recursive: true })
  await writeFile(OUT_JSON, JSON.stringify(events, null, 2), 'utf8')

  console.log(
    `Escrito ${path.relative(REPO, OUT_JSON)} — solo Textract (deduplicado): ${events.length} eventos`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
