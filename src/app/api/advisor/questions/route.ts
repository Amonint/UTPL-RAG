import { z } from 'zod'

import { createKnowledgeItem } from '@/lib/db/admin/knowledge-item-repository'
import { withDbTransaction } from '@/lib/db/transaction'

const publishQuestionSchema = z.object({
  domainId: z.string().uuid(),
  elementId: z.string().uuid(),
  title: z.string().trim().min(10, 'Mínimo 10 caracteres').max(1000),
  questionBody: z.string().trim().min(20, 'Mínimo 20 caracteres'),
  answer: z.string().trim().min(20, 'Mínimo 20 caracteres'),
})

export async function POST(request: Request) {
  try {
    const body = publishQuestionSchema.parse(await request.json())

    const knowledgeItemId = await withDbTransaction((client) =>
      createKnowledgeItem(client, {
        kbElementId: body.elementId,
        domainId: body.domainId,
        sectionCode: 'faq',
        contentType: 'faq',
        title: body.title,
        questionText: body.questionBody,
        answerText: body.answer,
        editorialStatus: 'review',
        searchForms: [],
        phrases: [],
        synonyms: [],
      }),
    )

    return Response.json(
      {
        success: true,
        knowledgeItemId,
        message: 'Pregunta publicada exitosamente',
      },
      { status: 201 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al publicar pregunta'
    const status = message.includes('unique') ? 409 : 400
    return Response.json({ error: message }, { status })
  }
}
