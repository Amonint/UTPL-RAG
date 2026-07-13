import { getKnowledgeServiceById } from '@/lib/db/knowledge-services'
import { loadArtifacts } from '@/lib/data'
import { sanitizePublicAnswerText } from '@/lib/kb/sanitize-public-answer'

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      serviceId?: string
      question?: string
    }
    const selectedItemId = body.serviceId?.trim()
    if (!selectedItemId) {
      return Response.json({ message: 'Missing selected item id' }, { status: 400 })
    }

    if (!process.env.DATABASE_URL?.trim()) {
      const { services } = await loadArtifacts()
      const svc = services.find((item) => item.serviceId === selectedItemId)
      if (!svc) {
        return Response.json({ message: 'Knowledge item not found' }, { status: 404 })
      }
      const p = svc.jsonPayload
      const fallback =
        (typeof p.descripcion === 'string' && p.descripcion.trim()) ||
        (typeof p.nota === 'string' && p.nota.trim()) ||
        'No hay una respuesta canónica publicada para este servicio todavía.'
      return Response.json({
        answer: fallback,
        selectedService: null,
        usedSources: [],
        needsDisambiguation: false,
        serviceCandidates: [],
      })
    }

    const service = await getKnowledgeServiceById(selectedItemId)
    if (!service) {
      return Response.json({ message: 'Knowledge item not found' }, { status: 404 })
    }

    const answer =
      sanitizePublicAnswerText(service.answer_text ?? '') ||
      sanitizePublicAnswerText(service.question_text ?? '') ||
      'No hay una respuesta canónica publicada para este servicio todavía.'

    return Response.json({
      answer,
      selectedService: null,
      usedSources: [],
      needsDisambiguation: false,
      serviceCandidates: [],
    })
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : 'Unexpected error'
    return Response.json({ message }, { status: 500 })
  }
}
