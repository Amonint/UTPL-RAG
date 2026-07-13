import { assertAdminEnabled } from '@/lib/admin/route-guard'
import {
  fetchAdvisorSections,
  fetchCyclePeriods,
  fetchDomains,
  fetchEditorialStatuses,
  fetchProfileTypes,
  fetchProgramLevels,
  fetchStudentTypes,
} from '@/lib/db/admin/catalog-repository'

export async function GET() {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    const [domains, profileTypes, programLevels, studentTypes, cyclePeriods] = await Promise.all([
      fetchDomains(),
      fetchProfileTypes(),
      fetchProgramLevels(),
      fetchStudentTypes(),
      fetchCyclePeriods(true),
    ])
    let sections: Awaited<ReturnType<typeof fetchAdvisorSections>> = []
    let editorialStatuses: Awaited<ReturnType<typeof fetchEditorialStatuses>> = []
    try {
      ;[sections, editorialStatuses] = await Promise.all([
        fetchAdvisorSections(true),
        fetchEditorialStatuses(true, true),
      ])
    } catch {
      // Tablas de catálogo opcionales hasta aplicar scripts/migrations/2026-06-02-admin-filter-catalogs.sql
    }
    return Response.json({
      domains,
      profileTypes,
      programLevels,
      studentTypes,
      sections,
      editorialStatuses,
      cyclePeriods,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load catalogs'
    return Response.json({ error: message }, { status: 500 })
  }
}
