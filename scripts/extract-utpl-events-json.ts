/**
 * Extrae eventos del TXT limpio de Textract y separa por nivel de precision.
 *
 * Uso:
 *   npm run extract:utpl-events-json
 *   npm run extract:utpl-events-json -- --input=... --out-dir=... --year=2026
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { parseTextractCleanText } from './lib/textract-clean-document-parser'
import { extractEventsByConfidence } from './lib/utpl-events-by-confidence'

const REPO = process.cwd()
const DEFAULT_INPUT = path.join(REPO, 'data', 'derived', 'textract-clean', 'all_textract_clean.txt')
const DEFAULT_OUT_DIR = path.join(REPO, 'data', 'derived')

function parseArgs(argv: string[]) {
  let input = DEFAULT_INPUT
  let outDir = DEFAULT_OUT_DIR
  let year = 2026

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      console.log(`extract-utpl-events-json

Opciones:
  --input=RUTA       TXT fuente (defecto: data/derived/textract-clean/all_textract_clean.txt)
  --out-dir=RUTA     Carpeta de salida (defecto: data/derived)
  --year=YYYY        Año objetivo para clasificar fechas (defecto: 2026)
`)
      process.exit(0)
    }
    if (arg.startsWith('--input=')) input = path.resolve(REPO, arg.slice('--input='.length))
    else if (arg.startsWith('--out-dir=')) outDir = path.resolve(REPO, arg.slice('--out-dir='.length))
    else if (arg.startsWith('--year=')) {
      const v = parseInt(arg.slice('--year='.length), 10)
      if (!Number.isNaN(v)) year = v
    }
  }

  return { input, outDir, year }
}

async function main() {
  const { input, outDir, year } = parseArgs(process.argv.slice(2))

  const body = await readFile(input, 'utf8')
  const docs = parseTextractCleanText(body)
  const out = extractEventsByConfidence(docs, {
    targetYear: year,
    sourceLabel: path.relative(REPO, input),
  })

  await mkdir(outDir, { recursive: true })

  const highPath = path.join(outDir, `utpl-events-${year}-high-confidence.json`)
  const medPath = path.join(outDir, `utpl-events-${year}-medium-review.json`)
  const lowPath = path.join(outDir, `utpl-events-${year}-low-review.json`)
  const reportPath = path.join(outDir, `utpl-events-${year}-confidence-report.json`)

  await writeFile(highPath, JSON.stringify(out.alta_precision, null, 2), 'utf8')
  await writeFile(medPath, JSON.stringify(out.media_precision, null, 2), 'utf8')
  await writeFile(lowPath, JSON.stringify(out.baja_precision_revision, null, 2), 'utf8')
  await writeFile(reportPath, JSON.stringify(out, null, 2), 'utf8')

  console.log(`Documentos parseados: ${out.summary.documents}`)
  console.log(`Alta precision: ${out.summary.high} -> ${path.relative(REPO, highPath)}`)
  console.log(`Media precision: ${out.summary.medium} -> ${path.relative(REPO, medPath)}`)
  console.log(`Baja precision: ${out.summary.low} -> ${path.relative(REPO, lowPath)}`)
  console.log(`Reporte: ${path.relative(REPO, reportPath)}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
