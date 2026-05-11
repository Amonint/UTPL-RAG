import type { RetrievalChunk } from '@/lib/ingest/chunking'
import type { CanonicalServiceRecord, SearchResult } from '@/lib/types'

/** Metadatos del servicio en el hilo (ficha JSON y PDFs alineados con `CanonicalServiceRecord`). */
export type SelectedServiceMeta = Pick<
  CanonicalServiceRecord,
  'serviceId' | 'serviceName' | 'category' | 'studentTypes' | 'jsonPayload' | 'pdfRefs'
> & {
  hasPdfs?: boolean
  snippet?: string
}

export interface ChatTurn {
  id: string
  role: 'assistant' | 'user'
  content: string
  status?: 'loading' | 'done' | 'error'
  selectedService?: SelectedServiceMeta | null
  usedSources?: RetrievalChunk[]
  serviceCandidates?: Array<{
    serviceId: string
    serviceName: string
    score: number
  }>
  searchResults?: SearchResult[]
}

export interface RagResponsePayload {
  answer: string | null
  selectedService: ChatTurn['selectedService']
  usedSources: RetrievalChunk[]
  needsDisambiguation: boolean
  serviceCandidates: NonNullable<ChatTurn['serviceCandidates']>
}

export function createAssistantTurn(input: RagResponsePayload): ChatTurn {
  if (input.needsDisambiguation) {
    return {
      id: `assistant-${crypto.randomUUID()}`,
      role: 'assistant',
      status: 'done',
      content: 'Estos resultados se parecen a tu búsqueda. Elige uno para continuar.',
      serviceCandidates: input.serviceCandidates,
      usedSources: [],
      selectedService: null,
    }
  }

  return {
    id: `assistant-${crypto.randomUUID()}`,
    role: 'assistant',
    status: 'done',
    content: input.answer ?? 'No encontré una respuesta para esa consulta.',
    selectedService: input.selectedService,
    usedSources: input.usedSources,
    serviceCandidates: [],
  }
}

export function createErrorTurn(message: string): ChatTurn {
  return {
    id: `assistant-${crypto.randomUUID()}`,
    role: 'assistant',
    status: 'error',
    content: message,
    usedSources: [],
    serviceCandidates: [],
    selectedService: null,
  }
}

export function createSearchResultsTurn(results: SearchResult[]): ChatTurn {
  return {
    id: `assistant-${crypto.randomUUID()}`,
    role: 'assistant',
    status: 'done',
    content: 'Resultados de busqueda',
    searchResults: results,
    usedSources: [],
    serviceCandidates: [],
    selectedService: null,
  }
}
