import { loadArtifacts } from '@/lib/data'
import { generateServiceAnswerWithGemini } from '@/lib/rag/gemini-service-qa'
import { buildNativePdfUsedSources } from '@/lib/rag/native-pdf-sources'
import type { RetrievalChunk } from '@/lib/ingest/chunking'
import { routeCandidates } from '@/lib/retrieval/candidate-router'
import type { CanonicalServiceRecord, PdfRef } from '@/lib/types'

function buildJsonSummary(service: CanonicalServiceRecord): string {
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

function resolveSelectedPdfRefs(
  service: CanonicalServiceRecord,
  selectedPdfIds: string[],
): PdfRef[] | null {
  const byPath = new Map(service.pdfRefs.map((r) => [r.sourcePath, r]))
  const out: PdfRef[] = []
  const seenUrl = new Set<string>()
  for (const id of selectedPdfIds) {
    const ref = byPath.get(id)
    if (!ref) return null
    if (seenUrl.has(ref.url)) continue
    seenUrl.add(ref.url)
    out.push(ref)
  }
  return out
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      question?: string
      selectedServiceId?: string
      selectedPdfIds?: string[]
      /** @deprecated Ignorado; la selección va en selectedPdfIds. */
      allowPdf?: boolean
      /** @deprecated Ignorado. */
      selectedFacetIds?: string[]
    }
    const question = body.question?.trim()
    const selectedPdfIds = Array.isArray(body.selectedPdfIds)
      ? body.selectedPdfIds.filter((value): value is string => typeof value === 'string')
      : []

    if (!question) {
      return Response.json({ message: 'Missing question' }, { status: 400 })
    }

    const { services } = await loadArtifacts()
    const selectedServiceId = body.selectedServiceId
    const explicitService = selectedServiceId
      ? services.find((item) => item.serviceId === selectedServiceId) ?? null
      : null

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

    const pdfCount = selectedService.pdfRefs?.length ?? 0
    if (pdfCount === 0) {
      return Response.json(
        {
          message:
            'Este trámite no tiene PDFs en el catálogo; no se puede consultar con documentos asistidos.',
        },
        { status: 422 },
      )
    }

    if (selectedPdfIds.length === 0) {
      return Response.json(
        { message: 'Indica al menos un PDF (selectedPdfIds) para este trámite.' },
        { status: 422 },
      )
    }

    const selectedRefs = resolveSelectedPdfRefs(selectedService, selectedPdfIds)
    if (selectedRefs === null) {
      return Response.json(
        { message: 'Algún identificador de PDF no corresponde a este servicio.' },
        { status: 400 },
      )
    }

    const jsonChunk: RetrievalChunk = {
      chunkId: `${resolvedServiceId}::json`,
      serviceId: resolvedServiceId,
      sourceKind: 'json',
      text: buildJsonSummary(selectedService),
      metadata: { kind: 'service-json' },
    }

    let answer: string

    try {
      answer = await generateServiceAnswerWithGemini({
        question,
        service: selectedService,
        pdfRefs: selectedRefs,
      })
    } catch (reason) {
      console.error('Gemini service QA failed', reason)
      const msg = reason instanceof Error ? reason.message : 'Error al generar la respuesta.'
      return Response.json({ message: msg }, { status: 502 })
    }

    const usedSources = buildNativePdfUsedSources(resolvedServiceId, [jsonChunk], selectedRefs)

    return Response.json({
      answer,
      serviceCandidates,
      selectedService,
      citations: [],
      usedSources,
      needsDisambiguation,
    })
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : 'Unexpected error'
    return new Response(message, { status: 500 })
  }
}
