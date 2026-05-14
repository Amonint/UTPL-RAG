/**
 * Agrupa PDFs por contenido comparable, sin depender solo del SHA-256 del archivo ni de IDs
 * inestables de Textract:
 *
 * 1) (Opcional) Textract: sha256(JSON.stringify(blocks)) tras eliminar recursivamente la clave `Id`.
 * 2) Texto incrustado: pdf-parse + texto normalizado (NFKC, espacios).
 * 3) Fallback: hash de bytes (PDF escaneado sin Textract ni texto suficiente).
 *
 * Uso:
 *   npx tsx scripts/pdf-content-dedupe.ts --root=doop
 *   npx tsx scripts/pdf-content-dedupe.ts --root=doop --textract-manifest=data/derived/textract-raw/manifest.json
 *   npx tsx scripts/pdf-content-dedupe.ts --root=doop/OneDrive_1_12-5-2026 --root=doop/OneDrive_2_12-5-2026 --out=data/derived/pdf-content-dedupe.json
 *
 * Salida: JSON + CSV. Columna isRepresentativeInGroup=1 marca un PDF canónico por grupo de contenido.
 */

import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import pdf from 'pdf-parse'

const REPO_ROOT = process.cwd()

type ContentGroupKind =
  | 'textract_blocks_no_ids'
  | 'text_fingerprint'
  | 'low_text_fallback_bytes'

type Row = {
  relativePath: string
  absolutePath: string
  bytes: number
  bytesSha256: string
  numPages: number
  rawTextChars: number
  normalizedTextChars: number
  textNormSha256: string | null
  textractOutJson: string | null
  textractBlocksNormSha256: string | null
  textractReadError: string | null
  /** Clave usada para agrupar “mismo contenido lógico”. */
  contentGroupKey: string
  contentGroupKind: ContentGroupKind
  parseError: string | null
}

type ContentGroup = {
  contentGroupKey: string
  contentGroupKind: ContentGroupKind
  representativeRelativePath: string
  memberCount: number
  memberRelativePaths: string[]
  duplicatePaths: boolean
  /** true si los bytes SHA difieren dentro del grupo */
  distinctByteHashesInGroup: boolean
}

type ManifestEntry = {
  relativePath: string
  outJson: string
  sha256: string
}

type ManifestFile = {
  version: number
  entries: ManifestEntry[]
}

function sha256Hex(buf: Buffer | string): string {
  const h = createHash('sha256')
  if (typeof buf === 'string') h.update(buf, 'utf8')
  else h.update(buf)
  return h.digest('hex')
}

/** Elimina claves `Id` (inestables entre jobs Textract) para comparar contenido. */
function stripTextractIdsDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripTextractIdsDeep)
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(o)) {
      if (k === 'Id') continue
      out[k] = stripTextractIdsDeep(v)
    }
    return out
  }
  return value
}

function textractBlocksNormFingerprint(blocks: unknown[] | undefined): string {
  const arr = blocks ?? []
  const payload = JSON.stringify(stripTextractIdsDeep(arr))
  return createHash('sha256').update(payload, 'utf8').digest('hex')
}

function normalizePdfText(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function collectPdfFiles(roots: string[]): Promise<string[]> {
  const absRoots = roots.map((r) => path.resolve(REPO_ROOT, r))
  const files: string[] = []

  async function walk(dir: string) {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name)
      if (ent.isDirectory()) await walk(full)
      else if (ent.isFile() && ent.name.toLowerCase().endsWith('.pdf')) files.push(full)
    }
  }

  for (const r of absRoots) await walk(r)
  return [...new Set(files)].sort((a, b) => a.localeCompare(b))
}

function parseArgs(argv: string[]) {
  const roots: string[] = []
  let outPath = path.join(REPO_ROOT, 'data', 'derived', 'pdf-content-dedupe.json')
  let minChars = 80
  let textractManifestPath: string | null = null
  for (const a of argv) {
    if (a.startsWith('--root=')) roots.push(a.slice('--root='.length))
    else if (a.startsWith('--out=')) outPath = path.resolve(REPO_ROOT, a.slice('--out='.length))
    else if (a.startsWith('--min-chars=')) minChars = Math.max(0, parseInt(a.slice('--min-chars='.length), 10) || 0)
    else if (a.startsWith('--textract-manifest='))
      textractManifestPath = path.resolve(REPO_ROOT, a.slice('--textract-manifest='.length))
    else if (a === '--help' || a === '-h') {
      console.log(`pdf-content-dedupe — agrupa PDFs por contenido (Textract sin Id, texto pdf-parse, o bytes)

Opciones:
  --root=RUTA                  Directorio a recorrer (relativo al cwd); repetible
  --textract-manifest=RUTA.json  Manifest de data/derived/textract-raw (prioriza huella de blocks sin Id)
  --out=RUTA.json              Informe JSON (el CSV usa la misma base)
  --min-chars=N                Mínimo de caracteres de texto normalizado para huella pdf-parse (defecto: 80)
`)
      process.exit(0)
    }
  }
  if (roots.length === 0) roots.push('doop')
  return { roots, outPath, minChars, textractManifestPath }
}

function assignContentGroupKey(
  r: Pick<Row, 'bytesSha256' | 'normalizedTextChars' | 'textNormSha256' | 'textractBlocksNormSha256'>,
  minChars: number,
): { contentGroupKey: string; contentGroupKind: ContentGroupKind } {
  if (r.textractBlocksNormSha256) {
    return {
      contentGroupKey: `textract_norm:${r.textractBlocksNormSha256}`,
      contentGroupKind: 'textract_blocks_no_ids',
    }
  }
  const normLen = r.normalizedTextChars
  const th = r.textNormSha256
  if (normLen >= minChars && th) {
    return { contentGroupKey: `text:${th}`, contentGroupKind: 'text_fingerprint' }
  }
  return { contentGroupKey: `bytes:${r.bytesSha256}`, contentGroupKind: 'low_text_fallback_bytes' }
}

function buildGroups(rows: Row[]): ContentGroup[] {
  const byKey = new Map<string, Row[]>()
  for (const r of rows) {
    const list = byKey.get(r.contentGroupKey)
    if (list) list.push(r)
    else byKey.set(r.contentGroupKey, [r])
  }

  const groups: ContentGroup[] = []
  for (const [contentGroupKey, members] of byKey) {
    const sorted = [...members].sort((a, b) => a.relativePath.localeCompare(b.relativePath))
    const byteSet = new Set(sorted.map((m) => m.bytesSha256))
    groups.push({
      contentGroupKey,
      contentGroupKind: sorted[0]!.contentGroupKind,
      representativeRelativePath: sorted[0]!.relativePath,
      memberCount: sorted.length,
      memberRelativePaths: sorted.map((m) => m.relativePath),
      duplicatePaths: sorted.length > 1,
      distinctByteHashesInGroup: byteSet.size > 1,
    })
  }
  groups.sort((a, b) => b.memberCount - a.memberCount || a.contentGroupKey.localeCompare(b.contentGroupKey))
  return groups
}

async function loadManifestByRelativePath(manifestPath: string): Promise<Map<string, { outJson: string; sha256: string }>> {
  const raw = JSON.parse(await readFile(manifestPath, 'utf8')) as ManifestFile
  const m = new Map<string, { outJson: string; sha256: string }>()
  if (!Array.isArray(raw.entries)) return m
  for (const e of raw.entries) {
    if (e.relativePath && e.outJson) m.set(e.relativePath, { outJson: e.outJson, sha256: e.sha256 })
  }
  return m
}

async function attachTextract(rows: Row[], manifestPath: string) {
  const manifestDir = path.dirname(manifestPath)
  const byRel = await loadManifestByRelativePath(manifestPath)
  for (const r of rows) {
    r.textractOutJson = null
    r.textractBlocksNormSha256 = null
    r.textractReadError = null
    if (!r.bytesSha256) continue
    const ent = byRel.get(r.relativePath)
    if (!ent) continue
    r.textractOutJson = ent.outJson
    const jsonPath = path.join(manifestDir, ent.outJson)
    try {
      const body = await readFile(jsonPath, 'utf8')
      const doc = JSON.parse(body) as { blocks?: unknown[] }
      const blocks = Array.isArray(doc.blocks) ? (doc.blocks as unknown[]) : []
      r.textractBlocksNormSha256 = textractBlocksNormFingerprint(blocks)
    } catch (err) {
      r.textractReadError = err instanceof Error ? err.message : String(err)
    }
  }
}

async function main() {
  const { roots, outPath, minChars, textractManifestPath } = parseArgs(process.argv.slice(2))
  const pdfPaths = await collectPdfFiles(roots)

  const rows: Row[] = []
  for (const abs of pdfPaths) {
    const relativePath = path.relative(REPO_ROOT, abs)
    const baseRow = {
      relativePath,
      absolutePath: abs,
      textractOutJson: null as string | null,
      textractBlocksNormSha256: null as string | null,
      textractReadError: null as string | null,
    }
    let buf: Buffer
    try {
      buf = await readFile(abs)
    } catch (err) {
      rows.push({
        ...baseRow,
        bytes: 0,
        bytesSha256: '',
        numPages: 0,
        rawTextChars: 0,
        normalizedTextChars: 0,
        textNormSha256: null,
        contentGroupKey: `unread:${relativePath}`,
        contentGroupKind: 'low_text_fallback_bytes',
        parseError: err instanceof Error ? err.message : String(err),
      })
      continue
    }

    const bytesSha256 = sha256Hex(buf)
    let parsed: { text: string; numpages: number }
    let parseError: string | null = null
    try {
      parsed = await pdf(buf)
    } catch (err) {
      parseError = err instanceof Error ? err.message : String(err)
      rows.push({
        ...baseRow,
        bytes: buf.length,
        bytesSha256,
        numPages: 0,
        rawTextChars: 0,
        normalizedTextChars: 0,
        textNormSha256: null,
        contentGroupKey: `parse_error:${bytesSha256}`,
        contentGroupKind: 'low_text_fallback_bytes',
        parseError,
      })
      continue
    }

    const norm = normalizePdfText(parsed.text ?? '')
    const rawTextChars = (parsed.text ?? '').length
    const normalizedTextChars = norm.length
    const textNormSha256 = norm.length > 0 ? sha256Hex(norm) : null

    const pre: Pick<Row, 'bytesSha256' | 'normalizedTextChars' | 'textNormSha256' | 'textractBlocksNormSha256'> = {
      bytesSha256,
      normalizedTextChars,
      textNormSha256,
      textractBlocksNormSha256: null,
    }
    const { contentGroupKey, contentGroupKind } = assignContentGroupKey(pre, minChars)

    rows.push({
      ...baseRow,
      bytes: buf.length,
      bytesSha256,
      numPages: parsed.numpages ?? 0,
      rawTextChars,
      normalizedTextChars,
      textNormSha256,
      textractOutJson: null,
      textractBlocksNormSha256: null,
      textractReadError: null,
      contentGroupKey,
      contentGroupKind,
      parseError: null,
    })
  }

  if (textractManifestPath) {
    await attachTextract(rows, textractManifestPath)
    for (const r of rows) {
      if (!r.bytesSha256) continue
      const { contentGroupKey, contentGroupKind } = assignContentGroupKey(r, minChars)
      r.contentGroupKey = contentGroupKey
      r.contentGroupKind = contentGroupKind
    }
  }

  const groups = buildGroups(rows)

  const dupTextract = groups.filter((g) => g.duplicatePaths && g.contentGroupKind === 'textract_blocks_no_ids')
  const dupText = groups.filter((g) => g.duplicatePaths && g.contentGroupKind === 'text_fingerprint')
  const sameTextractDiffBytes = dupTextract.filter((g) => g.distinctByteHashesInGroup)
  const sameTextDiffBytes = dupText.filter((g) => g.distinctByteHashesInGroup)

  const basenameMap = new Map<string, Row[]>()
  for (const r of rows) {
    const b = path.basename(r.relativePath)
    const arr = basenameMap.get(b)
    if (arr) arr.push(r)
    else basenameMap.set(b, [r])
  }
  const basenameSameNameDifferentContent: Array<{
    basename: string
    distinctContentGroupKeys: string[]
    pathsByKey: Record<string, string[]>
  }> = []
  for (const [basename, list] of basenameMap) {
    if (list.length < 2) continue
    const keys = new Set(list.map((r) => r.contentGroupKey))
    if (keys.size > 1) {
      const pathsByKey: Record<string, string[]> = {}
      for (const r of list) {
        if (!pathsByKey[r.contentGroupKey]) pathsByKey[r.contentGroupKey] = []
        pathsByKey[r.contentGroupKey]!.push(r.relativePath)
      }
      basenameSameNameDifferentContent.push({
        basename,
        distinctContentGroupKeys: [...keys].sort(),
        pathsByKey,
      })
    }
  }
  basenameSameNameDifferentContent.sort((a, b) => a.basename.localeCompare(b.basename))

  const pathsInDupTextract = new Set<string>()
  for (const g of dupTextract) for (const p of g.memberRelativePaths) pathsInDupTextract.add(p)
  const pathsInDupText = new Set<string>()
  for (const g of dupText) for (const p of g.memberRelativePaths) pathsInDupText.add(p)

  /** Un representante por grupo (CSV isRepresentativeInGroup=1): conjunto mínimo que cubre todo el contenido distinto. */
  const uniqueRepresentatives = groups.map((g) => g.representativeRelativePath)

  const report = {
    version: 1 as const,
    generatedAt: new Date().toISOString(),
    options: {
      roots,
      minCharsForTextFingerprint: minChars,
      textractManifest: textractManifestPath ? path.relative(REPO_ROOT, textractManifestPath) : null,
    },
    summary: {
      pdfFilesScanned: rows.length,
      uniqueContentGroups: groups.length,
      uniqueRepresentativePdfCount: uniqueRepresentatives.length,
      textractManifestRowsMatched: textractManifestPath
        ? rows.filter((r) => r.textractOutJson !== null || r.textractReadError !== null).length
        : null,
      textractFingerprintAttached: rows.filter((r) => r.textractBlocksNormSha256 !== null).length,
      textractJsonReadErrors: rows.filter((r) => r.textractReadError).length,
      groupsByTextractNormFingerprint: groups.filter((g) => g.contentGroupKind === 'textract_blocks_no_ids').length,
      groupsByPdfTextFingerprint: groups.filter((g) => g.contentGroupKind === 'text_fingerprint').length,
      groupsByBytesOnly: groups.filter((g) => g.contentGroupKind === 'low_text_fallback_bytes').length,
      duplicatePathGroupsByTextract: dupTextract.length,
      duplicatePathGroupsByPdfText: dupText.length,
      sameTextractNormDistinctBinaryPdf: sameTextractDiffBytes.length,
      samePdfTextDistinctBinaryPdf: sameTextDiffBytes.length,
      pathsInSomeTextractDuplicateGroup: pathsInDupTextract.size,
      pathsInSomePdfTextDuplicateGroup: pathsInDupText.size,
      lowTextFallbackRowCount: rows.filter((r) => r.contentGroupKind === 'low_text_fallback_bytes').length,
      parseOrReadErrors: rows.filter((r) => r.parseError).length,
      sameBasenameDifferentContentCases: basenameSameNameDifferentContent.length,
    },
    interpretation:
      'Prioridad de agrupación: (1) textract_norm: huella de blocks Textract sin claves Id; (2) text: texto incrustado normalizado (pdf-parse); (3) bytes: sin Textract en manifest o sin JSON, y texto incrustado insuficiente — se usa SHA-256 del archivo para no fusionar PDFs escaneados distintos. ' +
      'uniqueRepresentativePdfCount cuenta un PDF por grupo de contenido (ver uniqueRepresentatives).',
    uniqueRepresentatives,
    rows,
    groups,
    duplicateByTextractNormFingerprint: dupTextract,
    duplicateByPdfTextFingerprint: dupText,
    sameTextractNormDistinctBinaryPdf: sameTextractDiffBytes,
    samePdfTextDistinctBinaryPdf: sameTextDiffBytes,
    basenameSameNameDifferentContent: basenameSameNameDifferentContent,
  }

  await mkdir(path.dirname(outPath), { recursive: true })
  await writeFile(outPath, JSON.stringify(report, null, 2), 'utf8')

  const csvPath = outPath.replace(/\.json$/i, '') + '.csv'
  const csvEscape = (s: string) => `"${s.replace(/"/g, '""')}"`
  const header = [
    'contentGroupKind',
    'contentGroupKey',
    'isRepresentativeInGroup',
    'relativePath',
    'bytes',
    'bytesSha256',
    'textractBlocksNormSha256',
    'textractOutJson',
    'textNormSha256',
    'numPages',
    'normalizedTextChars',
    'parseError',
    'textractReadError',
  ].join(',')
  const repByKey = new Map<string, string>()
  for (const g of groups) repByKey.set(g.contentGroupKey, g.representativeRelativePath)

  const csvLines = [header]
  for (const r of [...rows].sort((a, b) => a.contentGroupKey.localeCompare(b.contentGroupKey) || a.relativePath.localeCompare(b.relativePath))) {
    const isRep = repByKey.get(r.contentGroupKey) === r.relativePath
    csvLines.push(
      [
        r.contentGroupKind,
        csvEscape(r.contentGroupKey),
        isRep ? '1' : '0',
        csvEscape(r.relativePath),
        String(r.bytes),
        r.bytesSha256,
        r.textractBlocksNormSha256 ?? '',
        r.textractOutJson ? csvEscape(r.textractOutJson) : '',
        r.textNormSha256 ?? '',
        String(r.numPages),
        String(r.normalizedTextChars),
        r.parseError ? csvEscape(r.parseError) : '',
        r.textractReadError ? csvEscape(r.textractReadError) : '',
      ].join(','),
    )
  }
  await writeFile(csvPath, csvLines.join('\n'), 'utf8')

  console.log(JSON.stringify(report.summary, null, 2))
  console.log(`\nJSON: ${path.relative(REPO_ROOT, outPath)}`)
  console.log(`CSV:  ${path.relative(REPO_ROOT, csvPath)}`)
  if (report.summary.sameBasenameDifferentContentCases > 0) {
    console.log(
      `\nAviso: ${report.summary.sameBasenameDifferentContentCases} nombre(s) de archivo repetido(s) con contenido distinto (ver basenameSameNameDifferentContent en el JSON).`,
    )
  }
  if (report.summary.sameTextractNormDistinctBinaryPdf > 0) {
    console.log(
      `Misma información Textract (sin Id) pero PDF binario distinto: ${report.summary.sameTextractNormDistinctBinaryPdf} grupo(s).`,
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
