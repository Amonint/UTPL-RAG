/**
 * Une todos los JSON crudos de Textract en data/derived/textract-raw/*.json
 * (excepto manifest.json) en un solo archivo:
 *   data/derived/EXTRACION UTPL VERSION 1.json
 *
 * Uso: npm run bundle:extraccion-utpl-v1
 * Tras: npm run extract:doop-textract   (todos los PDFs)
 */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const REPO_ROOT = process.cwd()
const RAW_DIR = path.join(REPO_ROOT, 'data', 'derived', 'textract-raw')
const OUT_FILE = path.join(REPO_ROOT, 'data', 'derived', 'EXTRACION UTPL VERSION 1.json')

type TextractRawFile = {
  version: number
  localPath?: string
  relativePath: string
  s3Bucket: string
  s3Key: string
  jobId: string
  sha256: string
  bytes: number
  featureTypes: string[]
  blocks: unknown[]
  documentMetadata?: { Pages?: number }
}

type BundleOut = {
  titulo: 'EXTRACION UTPL VERSION 1'
  formatoVersion: 1
  generadoEn: string
  fuente: 'amazon-textract'
  documentos: Omit<TextractRawFile, 'version'>[]
  resumen: {
    numDocumentos: number
    totalBloques: number
    totalBytesPdf: number
    archivosIncluidos: string[]
  }
}

async function main() {
  const names = (await readdir(RAW_DIR)).filter((f) => f.endsWith('.json') && f !== 'manifest.json')
  if (names.length === 0) {
    console.error(`No hay JSON en ${path.relative(REPO_ROOT, RAW_DIR)}. Ejecuta antes: npm run extract:doop-textract`)
    process.exit(1)
  }

  const documentos: BundleOut['documentos'] = []
  let totalBloques = 0
  let totalBytes = 0
  const archivosIncluidos: string[] = []

  for (const name of names.sort()) {
    const full = path.join(RAW_DIR, name)
    let raw: TextractRawFile
    try {
      raw = JSON.parse(await readFile(full, 'utf8')) as TextractRawFile
    } catch {
      console.warn(`Omitido (JSON inválido): ${name}`)
      continue
    }
    if (raw.version !== 1 || !Array.isArray(raw.blocks)) {
      console.warn(`Omitido (no es Textract raw v1): ${name}`)
      continue
    }
    const { version: _v, ...rest } = raw
    documentos.push(rest)
    totalBloques += raw.blocks.length
    totalBytes += raw.bytes ?? 0
    archivosIncluidos.push(name)
  }

  const bundle: BundleOut = {
    titulo: 'EXTRACION UTPL VERSION 1',
    formatoVersion: 1,
    generadoEn: new Date().toISOString(),
    fuente: 'amazon-textract',
    documentos,
    resumen: {
      numDocumentos: documentos.length,
      totalBloques: totalBloques,
      totalBytesPdf: totalBytes,
      archivosIncluidos,
    },
  }

  await writeFile(OUT_FILE, JSON.stringify(bundle), 'utf8')
  console.log(
    `Escrito ${path.relative(REPO_ROOT, OUT_FILE)} (${documentos.length} documentos, ${totalBloques} bloques)`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
