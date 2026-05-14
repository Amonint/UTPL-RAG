import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const REPO = process.cwd()
const ROOT = path.join(REPO, 'doop')
const TEXTRACT_CLEAN_DIR = path.join(REPO, 'data', 'derived', 'textract-clean')
const OUT = path.join(REPO, 'data', 'derived', 'doop-pdf-catalog.json')

interface ExtractionSource {
  sourceTxtPath: string
  text: string
  textChars: number
  hasRoute: boolean
  isAggregate: boolean
}

interface PdfEntry {
  pdfId: string
  sha256: string
  name: string
  canonicalPath: string
  allPaths: string[]
  sourceFolders: string[]
  hierarchy: {
    sourceFolder: string
    grupo: string
    subgrupo: string
    modalidad: string
    nivel: string
    tipo: string
    periodo: string
    rol: string
  }
  tags: string[]
  extraction: {
    status: 'ok' | 'missing'
    sourceCount: number
    textChars: number
    sourceFiles: string[]
  }
  searchText: string
}

function normalizeAscii(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizePath(input: string): string {
  return input.replace(/\\/g, '/').normalize('NFC')
}

function titleCase(input: string): string {
  const clean = input.replace(/[\s_]+/g, ' ').trim()
  if (!clean) return 'Sin especificar'
  return clean.charAt(0).toUpperCase() + clean.slice(1)
}

function detectNivel(text: string): string {
  const hasDoctorado = /doctorado/.test(text)
  const hasGrado = /\bgr\b|\bgrado\b/.test(text)
  const hasPos = /posgrad|\bps\b/.test(text)
  const hasTec = /tecnico|tecnologico|\btec\b/.test(text)
  const count = Number(hasGrado) + Number(hasPos) + Number(hasTec) + Number(hasDoctorado)
  if (hasDoctorado && count === 1) return 'Doctorado'
  if (count > 1) return 'Multinivel'
  if (hasGrado) return 'Grado'
  if (hasPos) return 'Posgrados'
  if (hasTec) return 'Tecnico/Tecnologico'
  return 'Sin especificar'
}

function detectModalidad(text: string): string {
  const hasPresencial = /modalidad presencial|\bpresencial\b|\bmp\b|\bgr p\b|\bps p\b|\btec p\b/.test(text)
  const hasDistancia = /modalidad a distancia|a distancia|modalidad en linea|en linea|d-el|d el|d-el-p|_d-el_|_d-el\b|_d-el-p\b/.test(text)
  const hasHibrida = /modalidad hibrida|modalidad h i brida|\bhibrida\b/.test(text)
  const hasIntegro = /integro/.test(text)
  const count = Number(hasPresencial) + Number(hasDistancia) + Number(hasHibrida)

  if (count > 1) return hasIntegro ? 'Multimodal (Integro)' : 'Multimodal'
  if (hasHibrida) return 'Hibrida'
  if (hasDistancia) return 'Distancia/En linea'
  if (hasPresencial) return 'Presencial'
  if (hasIntegro) return 'Integro'
  return 'Sin especificar'
}

function detectTipo(text: string): string {
  if (/internado rotativo/.test(text)) return 'Internado rotativo'
  if (/elaboracion materiales?|material educativo/.test(text)) return 'Elaboracion de material educativo'
  if (/servicios? de matricul/.test(text)) return 'Matriculas e inscripciones'
  if (/servicios? de reconocimiento|reconocimiento de estudios|homologacion|titulo extranjero|segunda carrera/.test(text)) {
    return 'Reconocimiento de estudios'
  }
  if (/admisiones?/.test(text)) return 'Admisiones'
  if (/unidad titulacion|titulacion especial|integracion curricular|\buic\b|\bute\b/.test(text)) {
    return 'Unidad de titulacion / integracion curricular'
  }
  if (/validacion|suficiencia|ubicacion|ingles|listening|speaking/.test(text)) {
    return 'Validacion y certificacion de ingles'
  }
  if (/matricul|inscrip/.test(text)) return 'Matriculas e inscripciones'
  if (/competencias especificas|\bcce\b/.test(text)) return 'Competencias especificas (CCE)'
  if (/cronograma academico|calendario academico|cronograma acade|calendario acade/.test(text)) {
    return 'Calendario academico'
  }
  return 'Otros tramites academicos'
}

function detectPeriodo(primary: string, secondary: string): string {
  const combined = `${primary} ${secondary}`
  const hasAbrAgo = /\babr\b.{0,30}\bago\b|\babril\b.{0,30}\bagosto\b/.test(combined)
  const hasJunAgo = /\bjun\b.{0,30}\bago\b|\bjunio\b.{0,30}\bagosto\b/.test(combined)
  const hasOctAgo = /\boct\b.{0,30}\bago\b|\boctubre\b.{0,30}\bagosto\b/.test(combined)
  if (hasAbrAgo) return 'ABR-AGO'
  if (hasJunAgo) return 'JUN-AGO'
  if (hasOctAgo) return 'OCT-AGO'

  const yearsPrimary = [...new Set(primary.match(/20\d{2}/g) ?? [])]
  if (yearsPrimary.length === 1) return yearsPrimary[0]
  if (yearsPrimary.length === 2) return `${yearsPrimary[0]}-${yearsPrimary[1]}`

  const yearsSecondary = [...new Set(secondary.match(/20\d{2}/g) ?? [])]
  if (yearsSecondary.length > 0) return yearsSecondary[0]
  return 'Sin especificar'
}

function detectRol(text: string, canonicalPath: string): string {
  const pathText = normalizeAscii(canonicalPath)
  const pathHasEstudiantes = /estudiantes?/.test(pathText)
  const pathHasDocentes = /docentes?/.test(pathText)
  if (pathHasEstudiantes && pathHasDocentes) return 'Estudiantes y Docentes'
  if (pathHasEstudiantes) return 'Estudiantes'
  if (pathHasDocentes) return 'Docentes'

  const hasEstudiantes = /estudiantes?/.test(text)
  const hasDocentes = /docentes?/.test(text)
  if (hasEstudiantes && hasDocentes) return 'Estudiantes y Docentes'
  if (hasEstudiantes) return 'Estudiantes'
  if (hasDocentes) return 'Docentes'
  return 'Institucional'
}

function chooseCanonicalPath(paths: string[]): string {
  const sorted = [...paths].sort((a, b) => a.localeCompare(b, 'es'))
  function priority(p: string): number {
    if (/\/OneDrive_5_12-5-2026\//.test(p)) return 0
    if (/\/OneDrive_4_12-5-2026\//.test(p)) return 1
    if (/\/OneDrive_3_12-5-2026\//.test(p)) return 2
    if (/\/OneDrive_2_12-5-2026\//.test(p)) return 3
    if (/\/OneDrive_1_12-5-2026\//.test(p)) return 4
    return 9
  }
  sorted.sort((a, b) => {
    const pa = priority(a)
    const pb = priority(b)
    if (pa !== pb) return pa - pb
    if (a.length !== b.length) return a.length - b.length
    return a.localeCompare(b, 'es')
  })
  const preferred = sorted[0]
  return preferred ?? sorted[0] ?? ''
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = []
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      out.push(...(await walk(full)))
      continue
    }
    if (/\.pdf$/i.test(e.name)) out.push(full)
  }
  return out
}

async function walkAllFiles(dir: string): Promise<string[]> {
  const out: string[] = []
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      out.push(...(await walkAllFiles(full)))
      continue
    }
    out.push(full)
  }
  return out
}

async function sha256(file: string): Promise<string> {
  const b = await readFile(file)
  return createHash('sha256').update(b).digest('hex')
}

function parseTextractText(raw: string): string {
  return raw
    .split('\n')
    .filter((line) => {
      const t = line.trim()
      if (!t) return false
      if (/^\[metadata\]$/i.test(t)) return false
      if (/^archivo:/i.test(t)) return false
      if (/^ruta:/i.test(t)) return false
      if (/^bytes:/i.test(t)) return false
      if (/^===/i.test(t)) return false
      if (/^\[[A-ZÁÉÍÓÚ _0-9-]+\]$/u.test(t)) return false
      return true
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function loadTextractIndex() {
  const files = await walkAllFiles(TEXTRACT_CLEAN_DIR)
  const txtFiles = files.filter((f) => f.toLowerCase().endsWith('.txt'))
  const byPath = new Map<string, ExtractionSource[]>()
  const byHashPrefix = new Map<string, ExtractionSource[]>()

  for (const abs of txtFiles) {
    const rel = normalizePath(path.relative(REPO, abs))
    const base = path.basename(abs)
    if (base === 'all_textract_clean.txt') continue
    const hashPrefix = base.slice(0, 8)
    const raw = await readFile(abs, 'utf8')
    const isAggregate = /^===== DOCUMENTO \d+:/m.test(raw)
    if (isAggregate) continue
    const routeMatch = raw.match(/^\s*ruta:\s*(.+)$/im)
    const route = routeMatch?.[1]?.trim()
    const hasRoute = Boolean(route)
    if (!hasRoute) continue
    const text = parseTextractText(raw)
    const entry: ExtractionSource = {
      sourceTxtPath: rel,
      text,
      textChars: text.length,
      hasRoute,
      isAggregate,
    }

    if (route) {
      const routeKey = normalizePath(route)
      const list = byPath.get(routeKey) ?? []
      list.push(entry)
      byPath.set(routeKey, list)
    }

    if (/^[a-f0-9]{8}$/i.test(hashPrefix)) {
      const list = byHashPrefix.get(hashPrefix.toLowerCase()) ?? []
      list.push(entry)
      byHashPrefix.set(hashPrefix.toLowerCase(), list)
    }
  }

  return { byPath, byHashPrefix, txtCount: txtFiles.length }
}

function uniqueTags(input: string[]): string[] {
  return [...new Set(input.filter((s) => s && s !== 'Sin especificar'))]
}

function inferGrupo(input: {
  nivel: string
  tipo: string
  sourceFolder: string
  tokens: string
}): string {
  const { nivel, tipo, sourceFolder, tokens } = input
  const sf = normalizeAscii(sourceFolder)

  if (tipo === 'Reconocimiento de estudios') return 'Trámites y servicios'
  if (tipo === 'Matriculas e inscripciones' && /\bservicios?\b/.test(tokens)) return 'Trámites y servicios'
  if (/tramites y servicios/.test(tokens) || /tramites y servicios/.test(sf)) return 'Trámites y servicios'
  if (/internado rotativo/.test(tokens) || /internado rotativo/.test(sf)) return 'Cronogramas internado rotativo'
  if (tipo === 'Unidad de titulacion / integracion curricular' || /ute|uic|unidad titulacion|integracion curricular/.test(tokens) || /ute-uic-ut/.test(sf)) {
    return 'Cronogramas UTE-UIC-UT'
  }
  if (tipo === 'Validacion y certificacion de ingles' || /validacion general|validacion de ingles/.test(sf)) {
    return 'Cronogramas validación y inglés'
  }
  if (nivel === 'Posgrados') return 'Cronogramas posgrados'
  if (nivel === 'Tecnico/Tecnologico') return 'Cronogramas técnico tecnológico'
  if (nivel === 'Grado') return 'Cronogramas grado'
  if (tipo === 'Admisiones') return 'Admisiones'
  return 'Documentos académicos'
}

function inferSubgrupo(input: {
  modalidad: string
  tipo: string
  sourceFolder: string
  tokens: string
}): string {
  const { modalidad, tipo, sourceFolder, tokens } = input
  const sf = normalizeAscii(sourceFolder)

  if (tipo === 'Reconocimiento de estudios') return 'Servicios de reconocimiento'
  if (tipo === 'Matriculas e inscripciones' && /\bservicios?\b/.test(tokens)) return 'Servicios de matrícula'
  if (/tramites y servicios/.test(tokens) || /tramites y servicios/.test(sf)) {
    if (/reconocimiento/.test(tokens)) return 'Servicios de reconocimiento'
    if (/matricul/.test(tokens)) return 'Servicios de matrícula'
    return 'Servicios académicos'
  }

  if (tipo === 'Elaboracion de material educativo' || /elaboracion material/.test(tokens)) {
    return 'Elaboración de material educativo'
  }
  if (tipo === 'Internado rotativo') return 'Internado rotativo medicina'
  if (tipo === 'Unidad de titulacion / integracion curricular') return 'Unidad de titulación / integración curricular'
  if (tipo === 'Validacion y certificacion de ingles') return 'Validación, suficiencia y ubicación de inglés'

  if (/modalidad presencial/.test(tokens) || /modalidad presencial/.test(sf) || modalidad === 'Presencial') {
    return 'Modalidad presencial'
  }
  if (
    /modalidad a distancia|modalidad en linea|en linea|a distancia/.test(tokens)
    || /modalidad a distancia|modalidad en linea/.test(sf)
    || modalidad === 'Distancia/En linea'
  ) {
    return 'Modalidad a distancia / en línea'
  }
  if (modalidad === 'Multimodal' || modalidad === 'Multimodal (Integro)') return 'Multimodal'
  if (modalidad === 'Integro') return 'Integro'

  return 'Subgrupo académico'
}

function normalizeSubgrupoLabel(input: string): string {
  const t = normalizeAscii(input)
  if (t.includes('modalidad presencial')) return 'Modalidad presencial'
  if (t.includes('modalidad a distancia') || t.includes('modalidad en linea') || t.includes('en linea')) {
    return 'Modalidad a distancia / en línea'
  }
  if (t.includes('tramites y servicios')) return 'Servicios académicos'
  return input
}

function inferRolFromTipo(tipo: string, detectedRol: string): string {
  if (detectedRol !== 'Institucional') return detectedRol
  if (tipo === 'Matriculas e inscripciones' || tipo === 'Admisiones' || tipo === 'Validacion y certificacion de ingles') {
    return 'Estudiantes'
  }
  if (tipo === 'Elaboracion de material educativo') return 'Docentes'
  return 'Institucional'
}

async function main() {
  const folders = (await readdir(ROOT, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, 'es'))

  const textract = await loadTextractIndex()

  const allPaths: string[] = []
  for (const folder of folders) {
    const abs = path.join(ROOT, folder)
    allPaths.push(...(await walk(abs)))
  }

  const byHash = new Map<string, string[]>()
  for (const abs of allPaths) {
    const rel = path.relative(REPO, abs)
    const hash = await sha256(abs)
    const list = byHash.get(hash) ?? []
    list.push(rel)
    byHash.set(hash, list)
  }

  const pdfs: PdfEntry[] = []
  let withExtraction = 0

  for (const [hash, paths] of byHash) {
    const canonical = chooseCanonicalPath(paths)
    const name = path.basename(canonical)
    const routeMatches = paths.flatMap((p) => textract.byPath.get(normalizePath(p)) ?? [])
    const hashMatches = textract.byHashPrefix.get(hash.slice(0, 8).toLowerCase()) ?? []
    const extractionPool = routeMatches.length > 0 ? routeMatches : hashMatches

    let bestExtraction: ExtractionSource | null = null
    for (const e of extractionPool) {
      if (!bestExtraction || e.textChars > bestExtraction.textChars) {
        bestExtraction = e
      }
    }
    const extractedText = bestExtraction?.text ?? ''
    if (extractedText.length > 0) withExtraction += 1

    const pathTokens = normalizeAscii(canonical)
    const textTokens = normalizeAscii(extractedText)
    const tokens = `${pathTokens} ${textTokens}`.trim()

    const sourceFolders = [...new Set(paths.map((p) => p.split(path.sep)[1] ?? 'desconocido'))]
    const sourceFolder = canonical.split(path.sep)[1] ?? sourceFolders[0] ?? 'desconocido'

    const relFromSource = canonical.split(path.sep).slice(2)
    const groupParts = relFromSource.slice(0, Math.max(0, relFromSource.length - 1))
    const nivel = detectNivel(tokens)
    const modalidad = detectModalidad(tokens)
    const tipo = detectTipo(tokens)
    const periodo = detectPeriodo(pathTokens, textTokens)
    const detectedRol = detectRol(tokens, canonical)

    let grupo = titleCase(groupParts[0] ?? '')
    let subgrupo = titleCase(groupParts[1] ?? '')
    if (!groupParts[0]) {
      grupo = inferGrupo({ nivel, tipo, sourceFolder, tokens })
    }
    if (!groupParts[1]) {
      subgrupo = inferSubgrupo({ modalidad, tipo, sourceFolder, tokens })
    }
    subgrupo = normalizeSubgrupoLabel(subgrupo)
    const rol = inferRolFromTipo(tipo, detectedRol)

    const hierarchy = {
      sourceFolder,
      grupo,
      subgrupo,
      modalidad,
      nivel,
      tipo,
      periodo,
      rol,
    }

    const tags = uniqueTags([
      hierarchy.nivel,
      hierarchy.modalidad,
      hierarchy.tipo,
      hierarchy.periodo,
      hierarchy.rol,
      titleCase(sourceFolder),
      titleCase(grupo),
      titleCase(subgrupo),
    ])

    const semanticExcerpt = normalizeAscii(extractedText).slice(0, 3500)
    const searchText = [
      name,
      canonical,
      ...paths,
      hierarchy.grupo,
      hierarchy.subgrupo,
      hierarchy.modalidad,
      hierarchy.nivel,
      hierarchy.tipo,
      hierarchy.periodo,
      hierarchy.rol,
      tags.join(' | '),
      semanticExcerpt,
    ]
      .join(' | ')
      .toLowerCase()

    pdfs.push({
      pdfId: hash.slice(0, 12),
      sha256: hash,
      name,
      canonicalPath: canonical,
      allPaths: [...paths].sort((a, b) => a.localeCompare(b, 'es')),
      sourceFolders: sourceFolders.sort((a, b) => a.localeCompare(b, 'es')),
      hierarchy,
      tags,
      extraction: {
        status: extractedText.length > 0 ? 'ok' : 'missing',
        sourceCount: extractionPool.length,
        textChars: extractedText.length,
        sourceFiles: [...new Set(extractionPool.map((e) => e.sourceTxtPath))].sort((a, b) => a.localeCompare(b, 'es')),
      },
      searchText,
    })
  }

  pdfs.sort((a, b) => {
    const c1 = a.hierarchy.nivel.localeCompare(b.hierarchy.nivel, 'es')
    if (c1 !== 0) return c1
    const c2 = a.hierarchy.modalidad.localeCompare(b.hierarchy.modalidad, 'es')
    if (c2 !== 0) return c2
    const c3 = a.hierarchy.tipo.localeCompare(b.hierarchy.tipo, 'es')
    if (c3 !== 0) return c3
    return a.name.localeCompare(b.name, 'es')
  })

  const byHierarchy: Record<string, Record<string, Record<string, PdfEntry[]>>> = {}
  for (const p of pdfs) {
    const n = p.hierarchy.nivel
    const m = p.hierarchy.modalidad
    const t = p.hierarchy.tipo
    byHierarchy[n] ??= {}
    byHierarchy[n][m] ??= {}
    byHierarchy[n][m][t] ??= []
    byHierarchy[n][m][t].push(p)
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    root: 'doop',
    sourceFolders: folders,
    summary: {
      inputPdfCount: allPaths.length,
      uniquePdfCount: pdfs.length,
      duplicateCopies: allPaths.length - pdfs.length,
      withExtraction,
      missingExtraction: pdfs.length - withExtraction,
      textractCleanFiles: textract.txtCount,
    },
    byHierarchy,
    pdfs,
  }

  await mkdir(path.dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify(payload, null, 2), 'utf8')

  console.log(`Catalog generated: ${path.relative(REPO, OUT)}`)
  console.log(`Input PDFs: ${allPaths.length}`)
  console.log(`Unique PDFs: ${pdfs.length}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
