import fs from 'node:fs/promises'

import pdf from 'pdf-parse'

export async function extractPdfTextFromBuffer(buffer: Buffer): Promise<string> {
  const parsed = await pdf(buffer)
  return parsed.text ?? ''
}

export async function extractPdfPages(filePath: string) {
  const buffer = await fs.readFile(filePath)
  const text = await extractPdfTextFromBuffer(buffer)

  return [
    {
      pageNumber: 1,
      text,
    },
  ]
}
