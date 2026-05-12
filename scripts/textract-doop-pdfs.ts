/**
 * Fase 1: PDFs en doop/ → S3 → Amazon Textract (StartDocumentAnalysis async).
 * Guarda bloques crudos y metadatos en data/derived/textract-raw/.
 *
 * Uso:
 *   npm run extract:doop-textract -- [--doop=./doop] [--limit=N] [--glob=subcadena] [--force] [--dry-run]
 *
 * Requiere: AWS_REGION, AWS credenciales, UTPL_TEXTRACT_S3_BUCKET
 */

import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import {
  GetDocumentAnalysisCommand,
  type Block,
  StartDocumentAnalysisCommand,
  TextractClient,
} from '@aws-sdk/client-textract'

const REPO_ROOT = process.cwd()
const DEFAULT_DOOP = path.join(REPO_ROOT, 'doop')
const OUT_DIR = path.join(REPO_ROOT, 'data', 'derived', 'textract-raw')
const S3_PREFIX = 'utpl-calendar-textract/incoming'
const MANIFEST = 'manifest.json'

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

type TextractRawFile = {
  version: 1
  localPath: string
  relativePath: string
  s3Bucket: string
  s3Key: string
  jobId: string
  sha256: string
  bytes: number
  featureTypes: string[]
  blocks: Block[]
  documentMetadata?: { Pages?: number }
}

function parseArgs(argv: string[]) {
  let doop = DEFAULT_DOOP
  let limit: number | undefined
  let glob: string | undefined
  let force = false
  let dryRun = false
  for (const a of argv) {
    if (a === '--force') force = true
    else if (a === '--dry-run') dryRun = true
    else if (a.startsWith('--doop=')) doop = path.resolve(REPO_ROOT, a.slice('--doop='.length))
    else if (a.startsWith('--limit=')) limit = Math.max(0, parseInt(a.slice('--limit='.length), 10) || 0)
    else if (a.startsWith('--glob=')) glob = a.slice('--glob='.length)
    else if (a === '--help' || a === '-h') {
      console.log(`textract-doop-pdfs

Opciones:
  --doop=RUTA     Carpeta con PDFs (defecto: ./doop)
  --limit=N       Procesar como máximo N archivos (0 = todos)
  --glob=S        Solo rutas que contengan la subcadena S (sin regex)
  --force         Reprocesar aunque exista JSON con el mismo sha256
  --dry-run       Listar PDFs que se procesarían (sin AWS)
  --help          Esta ayuda

Variables de entorno:
  UTPL_TEXTRACT_S3_BUCKET   Bucket S3 (obligatorio salvo --dry-run)
  AWS_REGION                ej. us-east-1
  AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY o perfil IAM por defecto`)
      process.exit(0)
    }
  }
  return { doop, limit, glob, force, dryRun }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function collectPdfs(dir: string, base = dir): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const out: string[] = []
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...(await collectPdfs(full, base)))
    else if (e.isFile() && /\.pdf$/i.test(e.name)) out.push(full)
  }
  return out.sort()
}

async function sha256File(filePath: string): Promise<string> {
  const buf = await readFile(filePath)
  return createHash('sha256').update(buf).digest('hex')
}

function outJsonName(relativePath: string, sha: string): string {
  const short = sha.slice(0, 8)
  const base = relativePath
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9-_.]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120)
  return `${short}_${base}.json`
}

function s3KeyFor(sha: string, basename: string): string {
  const safe = basename.replace(/[^\w.\-()+ ]/g, '_').slice(0, 180)
  return `${S3_PREFIX}/${sha.slice(0, 16)}-${safe}`
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

async function waitJobSucceeded(client: TextractClient, jobId: string): Promise<void> {
  for (let i = 0; i < 360; i++) {
    const r = await client.send(new GetDocumentAnalysisCommand({ JobId: jobId }))
    const st = r.JobStatus
    if (st === 'SUCCEEDED') return
    if (st === 'FAILED') throw new Error(r.StatusMessage ?? 'Textract JobStatus FAILED')
    await sleep(4000)
  }
  throw new Error('Timeout esperando Textract (JobId ' + jobId + ')')
}

async function fetchAllBlocks(client: TextractClient, jobId: string): Promise<{ blocks: Block[]; pages?: number }> {
  const blocks: Block[] = []
  let nextToken: string | undefined
  let pages: number | undefined
  do {
    const r = await client.send(
      new GetDocumentAnalysisCommand({ JobId: jobId, NextToken: nextToken }),
    )
    if (r.Blocks?.length) blocks.push(...r.Blocks)
    if (r.DocumentMetadata?.Pages != null) pages = r.DocumentMetadata.Pages
    nextToken = r.NextToken
  } while (nextToken)
  return { blocks, pages }
}

async function readManifest(): Promise<ManifestEntry[]> {
  const p = path.join(OUT_DIR, MANIFEST)
  if (!(await pathExists(p))) return []
  try {
    const raw = await readFile(p, 'utf8')
    const j = JSON.parse(raw) as { entries?: ManifestEntry[] }
    return Array.isArray(j.entries) ? j.entries : []
  } catch {
    return []
  }
}

async function writeManifest(entries: ManifestEntry[]) {
  await writeFile(
    path.join(OUT_DIR, MANIFEST),
    JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), entries }, null, 2),
    'utf8',
  )
}

async function existingOutputValid(outPath: string, expectedSha: string): Promise<boolean> {
  if (!(await pathExists(outPath))) return false
  try {
    const raw = JSON.parse(await readFile(outPath, 'utf8')) as TextractRawFile
    return raw.version === 1 && raw.sha256 === expectedSha && Array.isArray(raw.blocks)
  } catch {
    return false
  }
}

async function main() {
  const { doop, limit, glob, force, dryRun } = parseArgs(process.argv.slice(2))

  if (!(await pathExists(doop))) {
    console.error(`No existe la carpeta doop: ${doop}`)
    process.exit(1)
  }

  await mkdir(OUT_DIR, { recursive: true })

  let pdfs = await collectPdfs(doop)
  if (glob) pdfs = pdfs.filter((p) => p.includes(glob))
  if (limit !== undefined && limit > 0) pdfs = pdfs.slice(0, limit)

  console.log(`PDFs encontrados: ${pdfs.length}${glob ? ` (filtro --glob="${glob}")` : ''}`)

  if (dryRun) {
    for (const p of pdfs) console.log('  ', path.relative(REPO_ROOT, p))
    process.exit(0)
  }

  const bucket = process.env.UTPL_TEXTRACT_S3_BUCKET?.trim()
  if (!bucket) {
    console.error('Falta UTPL_TEXTRACT_S3_BUCKET en el entorno.')
    process.exit(1)
  }

  const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1'
  const s3 = new S3Client({ region })
  const textract = new TextractClient({ region })

  const featureTypes = ['TABLES', 'LAYOUT'] as const

  let manifest = await readManifest()
  const byRel = new Map(manifest.map((e) => [e.relativePath, e]))

  let processed = 0
  let skipped = 0

  for (const abs of pdfs) {
    const relativePath = path.relative(REPO_ROOT, abs).split(path.sep).join('/')
    const sha = await sha256File(abs)
    const outName = outJsonName(relativePath, sha)
    const outPath = path.join(OUT_DIR, outName)

    if (!force && (await existingOutputValid(outPath, sha))) {
      console.log(`Omitido (ya existe): ${relativePath}`)
      skipped += 1
      continue
    }

    const buf = await readFile(abs)
    const bytes = buf.length
    const key = s3KeyFor(sha, path.basename(abs))

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buf,
        ContentType: 'application/pdf',
      }),
    )

    const start = await textract.send(
      new StartDocumentAnalysisCommand({
        DocumentLocation: { S3Object: { Bucket: bucket, Name: key } },
        FeatureTypes: [...featureTypes],
      }),
    )
    const jobId = start.JobId
    if (!jobId) throw new Error('StartDocumentAnalysis sin JobId')

    await waitJobSucceeded(textract, jobId)
    const { blocks, pages } = await fetchAllBlocks(textract, jobId)

    const payload: TextractRawFile = {
      version: 1,
      localPath: abs,
      relativePath,
      s3Bucket: bucket,
      s3Key: key,
      jobId,
      sha256: sha,
      bytes,
      featureTypes: [...featureTypes],
      blocks,
      documentMetadata: pages != null ? { Pages: pages } : undefined,
    }

    await writeFile(outPath, JSON.stringify(payload), 'utf8')

    const entry: ManifestEntry = {
      localPath: abs,
      relativePath,
      outJson: outName,
      s3Bucket: bucket,
      s3Key: key,
      jobId,
      sha256: sha,
      bytes,
      finishedAt: new Date().toISOString(),
      blockCount: blocks.length,
    }
    byRel.set(relativePath, entry)
    manifest = [...byRel.values()].sort((a, b) => a.relativePath.localeCompare(b.relativePath))
    await writeManifest(manifest)

    console.log(`OK ${relativePath} → ${outName} (${blocks.length} blocks)`)
    processed += 1
  }

  console.log(`Listo. Procesados: ${processed}, omitidos: ${skipped}`)
}

function printTextractSubscriptionHelp() {
  console.error(`
SubscriptionRequiredException — Amazon Textract no está activado para esta cuenta (o falta completar la suscripción de servicios).

Qué hacer (según documentación oficial AWS):
  1) Consola AWS → servicio "Amazon Textract" (misma región que usas, ej. us-east-1) y completa activación / "Get started" si aparece.
  2) Inicia sesión como usuario raíz de la cuenta y actualiza la suscripción de servicios (incluye servicios añadidos después de crear la cuenta):
     https://portal.aws.amazon.com/billing/signup?type=resubscribe
  3) Billing: método de pago válido y cuenta sin restricciones.

Artículo AWS: https://repost.aws/knowledge-center/error-access-service
`)
}

main().catch((e: unknown) => {
  const name =
    e && typeof e === 'object' && 'name' in e ? String((e as { name?: string }).name) : ''
  const typ =
    e && typeof e === 'object' && '__type' in e ? String((e as { __type?: string }).__type) : ''
  if (name.includes('SubscriptionRequired') || typ.includes('SubscriptionRequired')) {
    printTextractSubscriptionHelp()
  }
  console.error(e)
  process.exit(1)
})
