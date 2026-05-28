import { loadKnowledgeTaxonomy, searchKnowledgeServices } from '@/lib/db/knowledge-services'
import { loadArtifacts } from '@/lib/data'
import { searchServices } from '@/lib/search/service-search'

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      query?: string
      limit?: unknown
      category?: string
      subcategory?: string
      element?: string
      uiSection?: 'services_incidents' | 'documentation'
      profileCode?: string
      profileTypeCode?: string
      taxonomyOnly?: boolean
      includeUnfiltered?: boolean
    }
    const query = body.query?.trim() ?? ''
    const category = body.category?.trim() || undefined
    const subcategory = body.subcategory?.trim() || undefined
    const element = body.element?.trim() || undefined
    const uiSection = body.uiSection
    const profileCode = body.profileCode?.trim() || undefined
    const profileTypeCode = body.profileTypeCode?.trim() || undefined
    const taxonomyOnly = body.taxonomyOnly === true

    const rawLimit = typeof body.limit === 'number' ? body.limit : Number(body.limit)
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 20, 1), 50)

    if (!process.env.DATABASE_URL?.trim()) {
      const { services } = await loadArtifacts()
      const fallbackResults = query ? searchServices({ query, services, limit }) : []
      return Response.json({ results: fallbackResults, taxonomy: [] })
    }

    const [results, taxonomy] = await Promise.all([
      searchKnowledgeServices({
        query,
        category,
        subcategory,
        element,
        uiSection,
        profileCode,
        profileTypeCode,
        limit,
        taxonomyOnly,
        includeUnfiltered: body.includeUnfiltered === true,
      }),
      loadKnowledgeTaxonomy(uiSection),
    ])
    return Response.json({ results, taxonomy })
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : 'Unexpected error'
    return Response.json({ message }, { status: 500 })
  }
}
