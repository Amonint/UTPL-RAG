import { loadPdfCatalog } from '@/lib/pdf-catalog'
import { searchPdfCatalog } from '@/lib/search/pdf-catalog-search'

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      query?: string
      limit?: unknown
    }

    const query = body.query?.trim() ?? ''
    const rawLimit = typeof body.limit === 'number' ? body.limit : Number(body.limit)
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 12, 1), 50)

    if (!query) return Response.json({ results: [] }, { status: 200 })

    const catalog = await loadPdfCatalog()
    const results = searchPdfCatalog({ query, entries: catalog.pdfs, limit })
    return Response.json({ results, summary: catalog.summary, generatedAt: catalog.generatedAt }, { status: 200 })
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : 'Unexpected error'
    return Response.json({ message }, { status: 500 })
  }
}
