import { defaultContentTypeForSection, type SectionCode } from '@/lib/admin/ui-labels'
import { advisorCreateItemSchema } from '@/lib/admin/validation'
import {
  assertSubcategoryInDomain,
  resolveOrCreateGeneralElement,
} from '@/lib/advisor/resolve-general-element'
import { createKnowledgeItem } from '@/lib/db/admin/knowledge-item-repository'
import { withDbTransaction } from '@/lib/db/transaction'

export async function POST(request: Request) {
  try {
    if (!process.env.DATABASE_URL?.trim()) {
      return Response.json({ error: 'DATABASE_URL is required' }, { status: 503 })
    }

    const body = advisorCreateItemSchema.parse(await request.json())
    const sectionCode = body.sectionCode as SectionCode
    const questionText = body.questionText?.trim() ?? ''
    const title =
      sectionCode === 'faq' ? (body.title?.trim() || questionText) : (body.title?.trim() ?? '')

    const knowledgeItemId = await withDbTransaction(async (client) => {
      await assertSubcategoryInDomain(client, body.subcategoryId, body.domainId)
      const kbElementId = await resolveOrCreateGeneralElement(client, body.subcategoryId)

      return createKnowledgeItem(client, {
        kbElementId,
        domainId: body.domainId,
        sectionCode,
        contentType: defaultContentTypeForSection(sectionCode),
        title,
        questionText,
        answerText: body.answerText.trim(),
        referenceUrl: body.referenceUrl,
        editorialStatus: 'review',
        searchForms: [],
        phrases: [],
        synonyms: [],
      })
    })

    return Response.json(
      {
        success: true,
        knowledgeItemId,
        message: 'Contenido enviado a revisión',
      },
      { status: 201 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al guardar el contenido'
    const status = message.includes('unique') ? 409 : 400
    return Response.json({ error: message }, { status })
  }
}
