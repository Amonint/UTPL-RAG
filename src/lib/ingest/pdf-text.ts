import fs from 'node:fs/promises'

import pdf from 'pdf-parse'

export async function extractPdfPages(filePath: string) {
  const buffer = await fs.readFile(filePath)
  const parsed = await pdf(buffer)

  return [
    {
      pageNumber: 1,
      text: parsed.text,
    },
  ]
}
