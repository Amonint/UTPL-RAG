import { loadArtifacts } from '@/lib/data/load-artifacts'
import { generateGroundedAnswer } from '@/lib/rag/generate-answer'
import { verifyAnswerSupport } from '@/lib/rag/verify-answer'
import { routeCandidates } from '@/lib/retrieval/candidate-router'
import { rankEvidenceForService } from '@/lib/retrieval/evidence-retriever'
import type { CanonicalServiceRecord } from '@/lib/types'

function buildJsonOnlyAnswer(service: CanonicalServiceRecord) {
  const payload = service.jsonPayload as Record<string, unknown>
  const sections = [
    `Servicio: ${service.serviceName}`,
    payload.descripcion ? `Descripcion: ${String(payload.descripcion)}` : null,
    payload.requisitos ? `Requisitos: ${JSON.stringify(payload.requisitos)}` : null,
    payload.costo ? `Costo: ${String(payload.costo)}` : null,
    payload.tiempo_respuesta ? `Tiempo de respuesta: ${String(payload.tiempo_respuesta)}` : null,
    payload.nota ? `Nota: ${String(payload.nota)}` : null,
  ].filter(Boolean)

  return sections.join('\n')
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      question?: string
      selectedServiceId?: string
      allowPdf?: boolean
    }
    const question = body.question?.trim()

    if (!question) {
      return Response.json({ message: 'Missing question' }, { status: 400 })
    }

    const { services, chunks } = await loadArtifacts()
    const selectedServiceId = body.selectedServiceId
    const explicitService = selectedServiceId
      ? services.find((item) => item.serviceId === selectedServiceId) ?? null
      : null
    const allowPdf = body.allowPdf ?? false

    if (selectedServiceId && !explicitService) {
      return Response.json({ message: 'Selected service not found' }, { status: 404 })
    }

    let resolvedServiceId = selectedServiceId
    let serviceCandidates: Array<{ serviceId: string; serviceName: string; score: number }> = []
    let needsDisambiguation = false

    if (!resolvedServiceId) {
      const routing = routeCandidates({ query: question, services })
      serviceCandidates = routing.candidates
      needsDisambiguation = routing.needsDisambiguation || routing.candidates.length === 0

      if (needsDisambiguation) {
        return Response.json({
          answer: null,
          serviceCandidates,
          selectedService: null,
          citations: [],
          usedSources: [],
          needsDisambiguation: true,
        })
      }

      resolvedServiceId = routing.candidates[0]!.serviceId
    }

    const selectedService = services.find((item) => item.serviceId === resolvedServiceId) ?? null

    if (!selectedService) {
      return Response.json({ message: 'Selected service not found' }, { status: 404 })
    }

    const evidence = rankEvidenceForService({
      query: question,
      serviceId: resolvedServiceId,
      chunks,
      allowPdf,
    })

    const verification = verifyAnswerSupport({
      answer: '',
      selectedServiceId: resolvedServiceId,
      evidence,
    })

    if (!verification.ok) {
      return Response.json({ message: verification.reason }, { status: 422 })
    }

    const answer = allowPdf
      ? await generateGroundedAnswer(question, evidence)
      : buildJsonOnlyAnswer(selectedService)

    return Response.json({
      answer,
      serviceCandidates,
      selectedService,
      citations: evidence.map((item) => item.chunkId),
      usedSources: evidence,
      needsDisambiguation,
    })
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : 'Unexpected error'
    return new Response(message, { status: 500 })
  }
}
