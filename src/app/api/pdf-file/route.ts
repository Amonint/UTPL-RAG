import fs from 'node:fs/promises'
import path from 'node:path'

/** Raíces permitidas para PDFs indexados (catálogo y enlaces firmes). */
const PDF_DOC_ROOTS = [
  path.join(/* turbopackIgnore: true */ process.cwd(), 'doop'),
  path.join(/* turbopackIgnore: true */ process.cwd(), 'Abril:agosto-2026'),
]

function safeResolveCatalogPdfPath(relativePath: string): string | null {
  if (!relativePath) return null
  if (relativePath.includes('..')) return null
  const abs = path.join(/* turbopackIgnore: true */ process.cwd(), relativePath)
  const normalized = path.normalize(abs)
  for (const root of PDF_DOC_ROOTS) {
    if (normalized === root || normalized.startsWith(root + path.sep)) {
      return normalized
    }
  }
  return null
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const rel = url.searchParams.get('path')?.trim() ?? ''

    if (!rel) {
      return Response.json({ message: 'Missing query param: path' }, { status: 400 })
    }

    const abs = safeResolveCatalogPdfPath(rel)
    if (!abs) {
      return Response.json({ message: 'Invalid PDF path' }, { status: 400 })
    }

    const content = await fs.readFile(abs)
    const name = path.basename(abs)
    const asciiFallback = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, '_')
    const utf8Name = encodeURIComponent(name)

    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${asciiFallback}"; filename*=UTF-8''${utf8Name}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : 'Unexpected error'
    return Response.json({ message }, { status: 500 })
  }
}
