import { loadKnowledgeTaxonomy, searchKnowledgeServices } from '@/lib/db/knowledge-services'
import { searchCalendarEventsForChat } from '@/lib/db/admin/calendar-events-repository'
import { loadArtifacts } from '@/lib/data'
import { searchServices } from '@/lib/search/service-search'
import type { SearchResult } from '@/lib/types'

function normalizeHybridScore(result: SearchResult): number {
  const raw = Number(result.score) || 0
  const payload = (result.jsonPayload ?? {}) as Record<string, unknown>
  const source = typeof payload.source === 'string' ? payload.source : ''
  const isCalendar = source === 'calendar_events' || payload.content_type === 'fechas'
  const dampened = isCalendar ? raw * 0.94 : raw
  return Math.max(0, Math.min(1.5, dampened))
}

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
      programLevelCode?: string
      studentLifecycleCode?: string
      crossSection?: boolean
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
    const programLevelCode = body.programLevelCode?.trim() || undefined
    const studentLifecycleCode = body.studentLifecycleCode?.trim() || undefined
    const crossSection = body.crossSection === true
    const taxonomyOnly = body.taxonomyOnly === true

    const rawLimit = typeof body.limit === 'number' ? body.limit : Number(body.limit)
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 20, 1), 50)

    if (!process.env.DATABASE_URL?.trim()) {
      const { services } = await loadArtifacts()
      const fallbackResults = query ? searchServices({ query, services, limit }) : []
      return Response.json({ results: fallbackResults, taxonomy: [] })
    }

    const searchInput = {
      query,
      category,
      subcategory,
      element,
      uiSection,
      profileCode,
      profileTypeCode,
      programLevelCode,
      studentLifecycleCode,
      crossSection: crossSection || Boolean(query.trim() && !category && !subcategory && !element),
      limit,
      taxonomyOnly,
      includeUnfiltered: body.includeUnfiltered === true,
    } as const

    const [knowledgeResults, taxonomy] = await Promise.all([
      searchKnowledgeServices(searchInput),
      loadKnowledgeTaxonomy(uiSection),
    ])

    let results: SearchResult[] = knowledgeResults
    const shouldIncludeCalendarEvents = Boolean(query) && searchInput.crossSection
    if (shouldIncludeCalendarEvents) {
      const calendarResults = await searchCalendarEventsForChat({ query, limit })
      const nonCalendarKnowledge = knowledgeResults.filter((row) => {
        const payload = (row.jsonPayload ?? {}) as Record<string, unknown>
        return payload.content_type !== 'calendar' && payload.content_type !== 'fechas'
      })
      results = [...nonCalendarKnowledge, ...calendarResults]
        .sort((a, b) => normalizeHybridScore(b) - normalizeHybridScore(a))
        .slice(0, limit)
        .map((item) => ({ ...item, score: normalizeHybridScore(item) }))
    }

    return Response.json({ results, taxonomy })
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : 'Unexpected error'
    return Response.json({ message }, { status: 500 })
  }
}
