import { assertAdminEnabled } from '@/lib/admin/route-guard'
import { fetchAdminDbStats, fetchItemCountsByDomain } from '@/lib/db/admin/stats-repository'

export async function GET() {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    const [stats, byDomain] = await Promise.all([fetchAdminDbStats(), fetchItemCountsByDomain()])
    return Response.json({ stats, byDomain })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load stats'
    return Response.json({ error: message }, { status: 500 })
  }
}
