/**
 * Inventario de extracciones Textract: duplicados por PDF (manifest.sha256) y
 * valores únicos por CONTENIDO Textract (huella SHA-256 del array `blocks` en cada JSON crudo).
 *
 * Uso:
 *   npx tsx scripts/list-doop-duplicate-pdfs-from-textract.ts [--audit-json] [--skip-textract-read] [--out=RUTA.json]
 *
 * --audit-json          Verifica cabecera JSON vs manifest.
 * --skip-textract-read  No lee JSONs: omite huella de blocks y conteos únicos Textract.
 * --out=                Ruta del informe JSON
 */

import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const REPO_ROOT = process.cwd()
const DEFAULT_MANIFEST = path.join(REPO_ROOT, 'data', 'derived', 'textract-raw', 'manifest.json')
const DEFAULT_OUT = path.join(REPO_ROOT, 'data', 'derived', 'doop-pdf-duplicates-from-textract.json')

type ManifestEntry = {
  localPath: string
  relativePath: string
  outJson: string
  s3Bucket: string
  s3Key: string
  jobId: string
  sha256: string
  bytes: number
  finishedAt: string
  blockCount: number
}

type ManifestFile = {
  version: number
  updatedAt: string
  entries: ManifestEntry[]
}

type DuplicateGroup = {
  sha256: string
  bytes: number
  count: number
  entries: Array<{
    relativePath: string
    outJson: string
    blockCount: number
    finishedAt: string
  }>
}

type BasenameGroup = {
  basename: string
  count: number
  relativePaths: string[]
}

type AuditIssue =
  | {
      kind: 'manifest_entry_missing_json'
      outJson: string
      relativePath: string
    }
  | {
      kind: 'json_header_sha256_mismatch'
      outJson: string
      manifestSha256: string
      jsonSha256: string
    }
  | {
      kind: 'json_header_relativePath_mismatch'
      outJson: string
      manifestPath: string
      jsonPath: string
    }
  | {
      kind: 'json_blockCount_mismatch'
      outJson: string
      manifestBlockCount: number
      jsonBlocksLength: number
    }
  | {
      kind: 'json_invalid'
      outJson: string
      message: string
    }
  | {
      kind: 'orphan_json_file'
      filename: string
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

/** Huella del contenido Textract: mismo array blocks => misma información extraída. */
function textractBlocksFingerprint(blocks: unknown[] | undefined, stripIds: boolean): string {
  const arr = blocks ?? []
  const payload = JSON.stringify(stripIds ? stripTextractIdsDeep(arr) : arr)
  return createHash('sha256').update(payload, 'utf8').digest('hex')
}

function parseArgs(argv: string[]) {
  let auditJson = false
  let skipTextractRead = false
  let outPath = DEFAULT_OUT
  let manifestPath = DEFAULT_MANIFEST
  for (const a of argv) {
    if (a === '--audit-json') auditJson = true
    else if (a === '--skip-textract-read') skipTextractRead = true
    else if (a.startsWith('--out=')) outPath = path.resolve(REPO_ROOT, a.slice('--out='.length))
    else if (a.startsWith('--manifest=')) manifestPath = path.resolve(REPO_ROOT, a.slice('--manifest='.length))
    else if (a === '--help' || a === '-h') {
      console.log(`list-doop-duplicate-pdfs-from-textract

Criterios:
  - PDF duplicado (referencia manifest): mismo manifest.sha256 entre entradas.
  - Información Textract: se resume con sha256(JSON.stringify(blocks)) por JSON crudo.
    Si dos extracciones comparten huella, Textract no aporta información distinta entre sí.

Opciones:
  --audit-json           Comprueba cada JSON crudo vs manifest (cabecera + blocks.length)
  --skip-textract-read   No lee los JSON crudos (sin huella blocks ni conteos únicos Textract)
  --out=RUTA             Salida JSON
  --manifest=RUTA        Manifest (defecto: data/derived/textract-raw/manifest.json)`)
      process.exit(0)
    }
  }
  return { auditJson, skipTextractRead, outPath, manifestPath }
}

function basenameFromRelative(p: string): string {
  return path.basename(p)
}

function groupBySha256(entries: ManifestEntry[]): Map<string, ManifestEntry[]> {
  const m = new Map<string, ManifestEntry[]>()
  for (const e of entries) {
    const list = m.get(e.sha256)
    if (list) list.push(e)
    else m.set(e.sha256, [e])
  }
  return m
}

function groupByBasename(entries: ManifestEntry[]): BasenameGroup[] {
  const m = new Map<string, string[]>()
  for (const e of entries) {
    const b = basenameFromRelative(e.relativePath)
    const arr = m.get(b)
    if (arr) arr.push(e.relativePath)
    else m.set(b, [e.relativePath])
  }
  return [...m.entries()]
    .filter(([, paths]) => paths.length > 1)
    .map(([basename, relativePaths]) => ({
      basename,
      count: relativePaths.length,
      relativePaths: [...relativePaths].sort(),
    }))
    .sort((a, b) => b.count - a.count || a.basename.localeCompare(b.basename))
}

type TextractContentReport =
  | {
      source: 'sha256_utf8_of_json_stringify_blocks_array'
      /** Huella del JSON tal cual (incluye `Id` de Textract; casi siempre única por job). */
      uniqueRawBlockFingerprints: number
      redundantRawFingerprints: number
      /** Huella tras quitar `Id` en todo el árbol de blocks (mejor proxy de “misma información”). */
      uniqueNormalizedBlockFingerprints: number
      redundantNormalizedSameBlockContent: number
      textractRawDir: string
      jsonsReadOk: number
      jsonsMissingOrInvalid: number
      samePdfSha256DifferentNormalizedFingerprints: Array<{
        manifestPdfSha256: string
        distinctNormalizedFingerprints: string[]
        outJsonPerFingerprint: Record<string, string[]>
      }>
      sameNormalizedFingerprintDifferentPdfSha256: Array<{
        normalizedFingerprint: string
        manifestPdfSha256Values: string[]
        outJsons: string[]
      }>
      interpretation: string
    }
  | { skipped: true; reason: string }

function hasTextractBlocksAnalysis(r: TextractContentReport): r is Exclude<TextractContentReport, { skipped: true }> {
  return !('skipped' in r && r.skipped)
}

async function main() {
  const { auditJson, skipTextractRead, outPath, manifestPath } = parseArgs(process.argv.slice(2))
  const textractRawDir = path.dirname(manifestPath)

  const raw = JSON.parse(await readFile(manifestPath, 'utf8')) as ManifestFile
  if (raw.version !== 1 || !Array.isArray(raw.entries)) {
    console.error('Manifest inválido: se esperaba version 1 y entries[].')
    process.exit(1)
  }

  const entries = raw.entries
  const byHash = groupBySha256(entries)
  const duplicateGroups: DuplicateGroup[] = []
  let filesInDuplicateGroups = 0
  for (const [sha256, list] of byHash) {
    if (list.length < 2) continue
    filesInDuplicateGroups += list.length
    const first = list[0]
    duplicateGroups.push({
      sha256,
      bytes: first.bytes,
      count: list.length,
      entries: list.map((e) => ({
        relativePath: e.relativePath,
        outJson: e.outJson,
        blockCount: e.blockCount,
        finishedAt: e.finishedAt,
      })),
    })
  }
  duplicateGroups.sort((a, b) => b.count - a.count || a.sha256.localeCompare(b.sha256))

  const uniqueHashes = byHash.size
  const dupGroupCount = duplicateGroups.length
  const redundantPdfCount = filesInDuplicateGroups - dupGroupCount

  const basenameDuplicates = groupByBasename(entries)

  const fingerprintRawByOutJson = new Map<string, string>()
  const fingerprintNormByOutJson = new Map<string, string>()
  const auditIssues: AuditIssue[] = []
  let textractContent: TextractContentReport

  if (skipTextractRead) {
    textractContent = { skipped: true, reason: '--skip-textract-read' }
  } else {
    const referenced = new Set(entries.map((e) => e.outJson))
    let dirFiles: string[] = []
    try {
      dirFiles = (await readdir(textractRawDir)).filter((f) => f.endsWith('.json') && f !== 'manifest.json')
    } catch {
      dirFiles = []
    }

    let jsonsReadOk = 0
    let jsonsMissingOrInvalid = 0

    for (const e of entries) {
      const jsonPath = path.join(textractRawDir, e.outJson)
      let body: string
      try {
        body = await readFile(jsonPath, 'utf8')
      } catch {
        jsonsMissingOrInvalid++
        auditIssues.push({ kind: 'manifest_entry_missing_json', outJson: e.outJson, relativePath: e.relativePath })
        continue
      }
      let doc: Record<string, unknown>
      try {
        doc = JSON.parse(body) as Record<string, unknown>
      } catch (err) {
        jsonsMissingOrInvalid++
        auditIssues.push({
          kind: 'json_invalid',
          outJson: e.outJson,
          message: err instanceof Error ? err.message : String(err),
        })
        continue
      }

      if (auditJson) {
        if (doc.version !== 1) {
          auditIssues.push({
            kind: 'json_invalid',
            outJson: e.outJson,
            message: `expected version 1, got ${String(doc.version)}`,
          })
        }
        const jSha = typeof doc.sha256 === 'string' ? doc.sha256 : ''
        if (jSha !== e.sha256) {
          auditIssues.push({
            kind: 'json_header_sha256_mismatch',
            outJson: e.outJson,
            manifestSha256: e.sha256,
            jsonSha256: jSha,
          })
        }
        const jRel = typeof doc.relativePath === 'string' ? doc.relativePath : ''
        if (jRel !== e.relativePath) {
          auditIssues.push({
            kind: 'json_header_relativePath_mismatch',
            outJson: e.outJson,
            manifestPath: e.relativePath,
            jsonPath: jRel,
          })
        }
        const blocks = doc.blocks
        const blen = Array.isArray(blocks) ? blocks.length : -1
        if (blen >= 0 && blen !== e.blockCount) {
          auditIssues.push({
            kind: 'json_blockCount_mismatch',
            outJson: e.outJson,
            manifestBlockCount: e.blockCount,
            jsonBlocksLength: blen,
          })
        }
      }

      const blocks = doc.blocks
      const blockArr = Array.isArray(blocks) ? (blocks as unknown[]) : []
      const fpRaw = textractBlocksFingerprint(blockArr, false)
      const fpNorm = textractBlocksFingerprint(blockArr, true)
      fingerprintRawByOutJson.set(e.outJson, fpRaw)
      fingerprintNormByOutJson.set(e.outJson, fpNorm)
      jsonsReadOk++
    }

    if (auditJson) {
      for (const f of dirFiles) {
        if (!referenced.has(f)) auditIssues.push({ kind: 'orphan_json_file', filename: f })
      }
    }

    const rawCounts = new Map<string, number>()
    for (const fp of fingerprintRawByOutJson.values()) rawCounts.set(fp, (rawCounts.get(fp) ?? 0) + 1)
    const uniqueRawBlockFingerprints = rawCounts.size

    const normCounts = new Map<string, number>()
    for (const fp of fingerprintNormByOutJson.values()) normCounts.set(fp, (normCounts.get(fp) ?? 0) + 1)
    const uniqueNormalizedBlockFingerprints = normCounts.size

    const samePdfSha256DifferentNormalizedFingerprints: Array<{
      manifestPdfSha256: string
      distinctNormalizedFingerprints: string[]
      outJsonPerFingerprint: Record<string, string[]>
    }> = []
    for (const [pdfSha, list] of byHash) {
      const fpSet = new Set<string>()
      const perFp = new Map<string, string[]>()
      for (const ent of list) {
        const f = fingerprintNormByOutJson.get(ent.outJson)
        if (!f) continue
        fpSet.add(f)
        const arr = perFp.get(f)
        if (arr) arr.push(ent.outJson)
        else perFp.set(f, [ent.outJson])
      }
      if (fpSet.size > 1) {
        const outJsonPerFingerprint: Record<string, string[]> = {}
        for (const [k, v] of perFp) outJsonPerFingerprint[k] = v
        samePdfSha256DifferentNormalizedFingerprints.push({
          manifestPdfSha256: pdfSha,
          distinctNormalizedFingerprints: [...fpSet],
          outJsonPerFingerprint,
        })
      }
    }

    const fpToPdfShas = new Map<string, Set<string>>()
    const fpToOut = new Map<string, string[]>()
    for (const e of entries) {
      const fp = fingerprintNormByOutJson.get(e.outJson)
      if (!fp) continue
      if (!fpToPdfShas.has(fp)) fpToPdfShas.set(fp, new Set())
      fpToPdfShas.get(fp)!.add(e.sha256)
      const o = fpToOut.get(fp)
      if (o) o.push(e.outJson)
      else fpToOut.set(fp, [e.outJson])
    }
    const sameNormalizedFingerprintDifferentPdfSha256: Array<{
      normalizedFingerprint: string
      manifestPdfSha256Values: string[]
      outJsons: string[]
    }> = []
    for (const [fp, shaSet] of fpToPdfShas) {
      if (shaSet.size > 1) {
        sameNormalizedFingerprintDifferentPdfSha256.push({
          normalizedFingerprint: fp,
          manifestPdfSha256Values: [...shaSet].sort(),
          outJsons: fpToOut.get(fp) ?? [],
        })
      }
    }

    textractContent = {
      source: 'sha256_utf8_of_json_stringify_blocks_array',
      uniqueRawBlockFingerprints,
      redundantRawFingerprints: jsonsReadOk - uniqueRawBlockFingerprints,
      uniqueNormalizedBlockFingerprints,
      redundantNormalizedSameBlockContent: jsonsReadOk - uniqueNormalizedBlockFingerprints,
      textractRawDir: path.relative(REPO_ROOT, textractRawDir),
      jsonsReadOk,
      jsonsMissingOrInvalid,
      samePdfSha256DifferentNormalizedFingerprints,
      sameNormalizedFingerprintDifferentPdfSha256,
      interpretation:
        'uniqueRawBlockFingerprints cuenta blocks con Id de Textract (casi siempre 150 únicos). ' +
        'uniqueNormalizedBlockFingerprints quita claves Id antes del hash: indica cuántas extracciones aportan contenido distinto a nivel de blocks comparables.',
    }
  }

  const summary = {
    pdfBytesCriterion: 'duplicate_manifest_entries_share_same_sha256',
    manifestPath: path.relative(REPO_ROOT, manifestPath),
    manifestUpdatedAt: raw.updatedAt,
    totalManifestEntries: entries.length,
    uniquePdfSha256Count: uniqueHashes,
    duplicatePdfSha256Groups: dupGroupCount,
    manifestEntriesInDuplicatePdfGroups: filesInDuplicateGroups,
    redundantPdfCopiesIfKeepOnePerPdfHash: redundantPdfCount,
    ...(hasTextractBlocksAnalysis(textractContent)
      ? {
          uniqueTextractContentValues: textractContent.uniqueTextractBlockFingerprints,
          textractExtractionsRedundantSameBlocks: textractContent.redundantTextractRunsSameBlockContent,
        }
      : {}),
  }

  const report = {
    version: 1 as const,
    generatedAt: new Date().toISOString(),
    summary,
    textractContent,
    duplicateGroups,
    optionalBasenameDuplicates: basenameDuplicates,
    ...(auditJson || (!skipTextractRead && auditIssues.length > 0)
      ? {
          auditJson: {
            ran: auditJson,
            issueCount: auditIssues.length,
            issues: auditIssues,
          },
        }
      : {}),
  }

  await mkdir(path.dirname(outPath), { recursive: true })
  await writeFile(outPath, JSON.stringify(report, null, 2), 'utf8')

  const csvPath = outPath.replace(/\.json$/i, '') + '.csv'
  const dupHashes = new Set(duplicateGroups.map((g) => g.sha256))
  const countBySha = new Map(duplicateGroups.map((g) => [g.sha256, g.count]))
  const csvEscape = (s: string) => `"${s.replace(/"/g, '""')}"`
  const csvLines = ['sha256,bytes,paths_in_same_hash_group,relativePath,outJson,blockCount']
  for (const e of entries) {
    if (!dupHashes.has(e.sha256)) continue
    const grp = countBySha.get(e.sha256) ?? 1
    csvLines.push(
      [
        e.sha256,
        String(e.bytes),
        String(grp),
        csvEscape(e.relativePath),
        csvEscape(e.outJson),
        String(e.blockCount),
      ].join(','),
    )
  }
  await writeFile(csvPath, csvLines.join('\n'), 'utf8')

  console.log(JSON.stringify(summary, null, 2))
  if (hasTextractBlocksAnalysis(textractContent)) {
    const tc = textractContent
    const samePdfDiff = tc.samePdfSha256DifferentTextractFingerprints.length
    const sameFpDiffPdf = tc.sameTextractFingerprintDifferentPdfSha256.length
    console.log(
      `\nTextract (solo contenido de blocks): ${tc.uniqueTextractBlockFingerprints} valores únicos de ${tc.jsonsReadOk} JSON leídos; ` +
        `${tc.redundantTextractRunsSameBlockContent} extracciones repiten el mismo blocks que otra.`,
    )
    if (tc.jsonsMissingOrInvalid > 0) {
      console.log(`Aviso: ${tc.jsonsMissingOrInvalid} manifest entries sin JSON válido (no entran en la huella).`)
    }
    console.log(
      `¿Mismo PDF (bytes) pero información Textract distinta? Grupos anómalos: ${samePdfDiff}` +
        (samePdfDiff > 0 ? ' (ver textractContent.samePdfSha256DifferentTextractFingerprints en el JSON)' : ' → no.'),
    )
    console.log(
      `¿Mismo blocks pero distinto PDF en manifest? Casos: ${sameFpDiffPdf}` +
        (sameFpDiffPdf > 0 ? ' (ver sameTextractFingerprintDifferentPdfSha256)' : ' → no.'),
    )
  }

  console.log(`\nInforme escrito: ${path.relative(REPO_ROOT, outPath)}`)
  console.log(`CSV duplicados: ${path.relative(REPO_ROOT, csvPath)}`)
  if (auditJson) {
    const n = auditIssues.length
    console.log(`Auditoría JSON (cabecera vs manifest): ${n} incidencia(s)`)
    if (n > 0) process.exitCode = 1
  } else if (hasTextractBlocksAnalysis(textractContent)) {
    const tc = textractContent
    if (tc.samePdfSha256DifferentTextractFingerprints.length > 0) process.exitCode = 1
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
