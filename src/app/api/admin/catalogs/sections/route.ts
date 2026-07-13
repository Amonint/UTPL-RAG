import { createAdvisorSectionSchema, patchAdvisorSectionSchema } from '@/lib/admin/validation'
import { assertAdminEnabled } from '@/lib/admin/route-guard'
import {
  countKnowledgeItemsBySection,
  createAdvisorSection,
  fetchSectionsForAdmin,
  patchAdvisorSection,
} from '@/lib/db/admin/catalog-repository'
import { withDbTransaction } from '@/lib/db/transaction'

export async function GET() {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    const sections = await fetchSectionsForAdmin()
    return Response.json({ sections })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudieron cargar las secciones'
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    const body = createAdvisorSectionSchema.parse(await request.json())
    const code = await withDbTransaction((client) => createAdvisorSection(client, body))
    return Response.json({ code }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo crear la sección'
    const status = message.includes('unique') || message.includes('duplicate') ? 409 : 400
    return Response.json({ error: message }, { status })
  }
}

export async function PATCH(request: Request) {
  const blocked = assertAdminEnabled()
  if (blocked) return blocked

  try {
    const body = patchAdvisorSectionSchema.parse(await request.json())
    const { code, isActive, ...patch } = body
    if (isActive === false) {
      const usage = await countKnowledgeItemsBySection(code)
      if (usage > 0) {
        return Response.json(
          {
            error: `Esta sección tiene ${usage} entrada(s). Desactívela solo si ya no aplica.`,
            usageCount: usage,
          },
          { status: 409 },
        )
      }
    }
    await withDbTransaction((client) => patchAdvisorSection(client, code, { ...patch, isActive }))
    return Response.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo actualizar la sección'
    return Response.json({ error: message }, { status: 400 })
  }
}
