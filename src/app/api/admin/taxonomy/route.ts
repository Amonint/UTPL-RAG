import { sectionCodeSchema } from '@/lib/admin/validation'
import { assertAdminEnabled } from '@/lib/admin/route-guard'
import { fetchAdminTaxonomyTree } from '@/lib/db/admin/taxonomy-repository'

export async function GET(request: Request) {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    const { searchParams } = new URL(request.url)
    const sectionParam = searchParams.get('section')
    const sectionCode =
      sectionParam && sectionCodeSchema.safeParse(sectionParam).success
        ? sectionCodeSchema.parse(sectionParam)
        : undefined
    const tree = await fetchAdminTaxonomyTree(sectionCode)
    return Response.json({ tree })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load taxonomy'
    return Response.json({ error: message }, { status: 500 })
  }
}
