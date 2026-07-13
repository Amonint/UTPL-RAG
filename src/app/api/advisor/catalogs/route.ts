import {
  fetchAdvisorSections,
  fetchCyclePeriods,
  fetchDomains,
  fetchProfileTypes,
  fetchStudentTypes,
} from '@/lib/db/admin/catalog-repository'
import { fetchDistinctCalendarEventTypes } from '@/lib/db/admin/calendar-events-repository'

export async function GET() {
  try {
    if (!process.env.DATABASE_URL?.trim()) {
      return Response.json({ error: 'DATABASE_URL is required' }, { status: 503 })
    }

    const [domains, profileTypes, studentTypes, cyclePeriods, sections, eventCategories] =
      await Promise.all([
        fetchDomains(),
        fetchProfileTypes(),
        fetchStudentTypes(),
        fetchCyclePeriods(true),
        fetchAdvisorSections(true),
        fetchDistinctCalendarEventTypes(),
      ])

    return Response.json({
      domains,
      profileTypes,
      studentTypes,
      cyclePeriods,
      sections,
      eventCategories,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudieron cargar los catálogos'
    return Response.json({ error: message }, { status: 500 })
  }
}
