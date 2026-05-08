import type { RetrievalChunk } from '@/lib/ingest/chunking'

export interface ChatTurn {
  id: string
  role: 'assistant' | 'user'
  content: string
  status?: 'loading' | 'done' | 'error'
  selectedService?: {
    serviceId: string
    serviceName: string
    category: string
    studentTypes: string[]
  } | null
  usedSources?: RetrievalChunk[]
  serviceCandidates?: Array<{
    serviceId: string
    serviceName: string
    score: number
  }>
  searchResults?: Array<{
    serviceId: string
    serviceName: string
    category: string
    score: number
    hasPdfs: boolean
    snippet?: string
  }>
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

export function createSearchResultsTurn(
  results: NonNullable<ChatTurn['searchResults']>,
): ChatTurn {
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
