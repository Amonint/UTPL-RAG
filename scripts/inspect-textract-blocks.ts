/**
 * Estadísticas y muestras de JSON crudo Textract (data/derived/textract-raw/*.json).
 *
 * Uso:
 *   npm run inspect:textract-blocks -- [--limit-files=N] [--sample-per-type=3] [--file=subcadena]
 */

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import type { Block } from '@aws-sdk/client-textract'

const REPO_ROOT = process.cwd()
const RAW_DIR = path.join(REPO_ROOT, 'data', 'derived', 'textract-raw')

type RawFile = {
  version: number
  relativePath?: string
  blocks?: Block[]
}

function parseArgs(argv: string[]) {
  let limitFiles: number | undefined
  let samplePerType = 3
  let fileSubstr: string | undefined
  for (const a of argv) {
    if (a === '--help' || a === '-h') {
      console.log(`inspect-textract-blocks

Opciones:
  --limit-files=N       Máximo de archivos JSON a analizar
  --sample-per-type=N   Bloques de ejemplo por BlockType por archivo (defecto 3)
  --file=S              Solo archivos cuyo nombre contenga S
`)
      process.exit(0)
    } else if (a.startsWith('--limit-files='))
      limitFiles = Math.max(1, parseInt(a.slice('--limit-files='.length), 10) || 1)
    else if (a.startsWith('--sample-per-type='))
      samplePerType = Math.max(0, parseInt(a.slice('--sample-per-type='.length), 10) || 0)
    else if (a.startsWith('--file=')) fileSubstr = a.slice('--file='.length)
  }
  return { limitFiles, samplePerType, fileSubstr }
}

function summarizeBlock(b: Block): Record<string, unknown> {
  const geo = b.Geometry?.BoundingBox
  return {
    Id: b.Id,
    BlockType: b.BlockType,
    Page: b.Page,
    Text: b.Text?.slice(0, 120) ?? undefined,
    RowIndex: b.RowIndex,
    ColumnIndex: b.ColumnIndex,
    EntityTypes: b.EntityTypes,
    Top: geo?.Top,
    Left: geo?.Left,
    ChildCount: b.Relationships?.find((r) => r.Type === 'CHILD')?.Ids?.length ?? 0,
  }
}

function samplesForFile(blocks: Block[], perType: number): Map<string, Block[]> {
  const m = new Map<string, Block[]>()
  if (perType <= 0) return m
  for (const b of blocks) {
    const t = b.BlockType ?? 'UNKNOWN'
    const arr = m.get(t) ?? []
    if (arr.length < perType) {
      arr.push(b)
      m.set(t, arr)
    }
  }
  return m
}

async function main() {
  const { limitFiles, samplePerType, fileSubstr } = parseArgs(process.argv.slice(2))

  let files: string[]
  try {
    files = (await readdir(RAW_DIR)).filter((f) => f.endsWith('.json') && f !== 'manifest.json')
  } catch {
    console.error(`No existe o no se puede leer: ${RAW_DIR}`)
    process.exit(1)
  }

  if (fileSubstr) files = files.filter((f) => f.includes(fileSubstr))
  files.sort()
  if (limitFiles !== undefined) files = files.slice(0, limitFiles)

  if (files.length === 0) {
    console.error('No hay archivos JSON que coincidan.')
    process.exit(1)
  }

  const globalCounts = new Map<string, number>()

  for (const jf of files) {
    const full = path.join(RAW_DIR, jf)
    let raw: RawFile
    try {
      raw = JSON.parse(await readFile(full, 'utf8')) as RawFile
    } catch {
      console.warn(`Omitido (JSON inválido): ${jf}`)
      continue
    }
    if (raw.version !== 1 || !Array.isArray(raw.blocks)) {
      console.warn(`Omitido (no es raw v1 o sin blocks): ${jf}`)
      continue
    }

    console.log('\n===', jf, '===')
    if (raw.relativePath) console.log('relativePath:', raw.relativePath)
    console.log('blockCount:', raw.blocks.length)

    const perFile = new Map<string, number>()
    for (const b of raw.blocks) {
      const t = b.BlockType ?? 'UNKNOWN'
      perFile.set(t, (perFile.get(t) ?? 0) + 1)
      globalCounts.set(t, (globalCounts.get(t) ?? 0) + 1)
    }

    const sortedTypes = [...perFile.entries()].sort((a, b) => b[1] - a[1])
    console.log('BlockType counts:', Object.fromEntries(sortedTypes))

    const byType = samplesForFile(raw.blocks, samplePerType)
    if (samplePerType > 0 && byType.size > 0) {
      console.log('Muestras por tipo:')
      for (const [t, arr] of [...byType.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        for (const b of arr) {
          console.log(`  [${t}]`, JSON.stringify(summarizeBlock(b)))
        }
      }
    }
  }

  console.log('\n=== Resumen global (todos los archivos procesados) ===')
  console.log(
    Object.fromEntries([...globalCounts.entries()].sort((a, b) => b[1] - a[1])),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
