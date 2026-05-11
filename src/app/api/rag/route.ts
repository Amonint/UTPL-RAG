import { loadArtifacts } from '@/lib/data/load-artifacts'
import {
  generateGroundedAnswer,
  generateGroundedAnswerWithNativePdfs,
} from '@/lib/rag/generate-answer'
import { filterPdfRefsWithLocalFiles, buildNativePdfUsedSources } from '@/lib/rag/native-pdf-sources'
import { derivePdfFacetsFromPayload, filterPdfRefsByFacetIds } from '@/lib/rag/pdf-facets'
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
      selectedFacetIds?: string[]
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
    const selectedFacetIds = Array.isArray(body.selectedFacetIds)
      ? body.selectedFacetIds.filter((value): value is string => typeof value === 'string')
      : []

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

    const jsonEvidence = rankEvidenceForService({
      query: question,
      serviceId: resolvedServiceId,
      chunks,
      allowPdf: false,
    })

    const verification = verifyAnswerSupport({
      answer: '',
      selectedServiceId: resolvedServiceId,
      evidence: jsonEvidence,
    })

    if (!verification.ok) {
      return Response.json({ message: verification.reason }, { status: 422 })
    }

    const jsonChunk = jsonEvidence[0]

    if (!jsonChunk) {
      return Response.json({ message: 'missing same-service evidence' }, { status: 422 })
    }

    const localPdfRefs = filterPdfRefsWithLocalFiles(selectedService.pdfRefs ?? [])
    const pdfFacets = derivePdfFacetsFromPayload(selectedService.jsonPayload, localPdfRefs)
    const hasFacetOptions = pdfFacets.length > 0

    if (allowPdf && hasFacetOptions && selectedFacetIds.length === 0) {
      return Response.json(
        {
          message:
            'Selecciona modalidad/carrera antes de consultar para limitar los PDFs del servicio.',
          requiresFacetSelection: true,
          availableFacets: pdfFacets.map((item) => ({
            facetId: item.facetId,
            pestana: item.pestana,
            titulo: item.titulo,
            itemTexto: item.itemTexto,
            pdfCount: item.pdfCount,
          })),
        },
        { status: 422 },
      )
    }

    const filteredPdfRefs =
      allowPdf && hasFacetOptions
        ? filterPdfRefsByFacetIds(localPdfRefs, selectedFacetIds, pdfFacets)
        : localPdfRefs

    let answer: string
    let usedSources: typeof jsonEvidence
    let warning: string | null = null

    if (allowPdf && filteredPdfRefs.length > 0) {
      try {
        answer = await generateGroundedAnswerWithNativePdfs({
          question,
          jsonChunk,
          pdfRefs: filteredPdfRefs,
        })
        usedSources = buildNativePdfUsedSources(resolvedServiceId, jsonEvidence, filteredPdfRefs)
      } catch (reason) {
        console.error('RAG native PDF generation failed, returning JSON fallback', reason)
        answer = buildJsonOnlyAnswer(selectedService)
        usedSources = jsonEvidence
        warning =
          'No se pudo usar PDFs para responder en este momento. Se devolvio informacion base del servicio.'
      }
    } else if (allowPdf) {
      try {
        const fallbackEvidence = rankEvidenceForService({
          query: question,
          serviceId: resolvedServiceId,
          chunks,
          allowPdf: true,
        })
        answer = await generateGroundedAnswer(question, fallbackEvidence)
        usedSources = fallbackEvidence
      } catch (reason) {
        console.error('RAG text generation failed, returning JSON fallback', reason)
        answer = buildJsonOnlyAnswer(selectedService)
        usedSources = jsonEvidence
        warning =
          'No se pudo generar respuesta con IA en este momento. Se devolvio informacion base del servicio.'
      }
    } else {
      answer = buildJsonOnlyAnswer(selectedService)
      usedSources = jsonEvidence
    }

    return Response.json({
      answer,
      serviceCandidates,
      selectedService,
      citations: [],
      usedSources,
      needsDisambiguation,
      warning,
    })
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : 'Unexpected error'
    return new Response(message, { status: 500 })
  }
}
