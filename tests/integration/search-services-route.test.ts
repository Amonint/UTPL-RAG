import { beforeEach, describe, expect, it, vi } from 'vitest'

const searchKnowledgeServicesMock = vi.hoisted(() => vi.fn())
const loadKnowledgeTaxonomyMock = vi.hoisted(() => vi.fn())
const searchCalendarEventsForChatMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db/knowledge-services', () => ({
  searchKnowledgeServices: searchKnowledgeServicesMock,
  loadKnowledgeTaxonomy: loadKnowledgeTaxonomyMock,
}))

vi.mock('@/lib/db/admin/calendar-events-repository', () => ({
  searchCalendarEventsForChat: searchCalendarEventsForChatMock,
}))

import { POST } from '@/app/api/search-services/route'

describe('POST /api/search-services', () => {
  beforeEach(() => {
    searchKnowledgeServicesMock.mockReset()
    loadKnowledgeTaxonomyMock.mockReset()
    searchCalendarEventsForChatMock.mockReset()
    process.env.DATABASE_URL = 'postgres://local-test'
  })

  it('mezcla conocimiento y fechas sin duplicar calendario de knowledge', async () => {
    searchKnowledgeServicesMock.mockResolvedValue([
      {
        serviceId: 'faq-1',
        serviceName: 'FAQ Matrícula',
        category: 'Matrícula',
        score: 0.88,
        hasPdfs: false,
        snippet: 'FAQ',
        studentTypes: [],
        pdfRefs: [],
        jsonPayload: { source: 'neon_hybrid', content_type: 'faq' },
      },
      {
        serviceId: 'knowledge-calendar-1',
        serviceName: 'Calendario antiguo',
        category: 'Calendario',
        score: 1.2,
        hasPdfs: false,
        snippet: 'Calendario desde knowledge',
        studentTypes: [],
        pdfRefs: [],
        jsonPayload: { source: 'neon_hybrid', content_type: 'calendar' },
      },
    ])
    loadKnowledgeTaxonomyMock.mockResolvedValue([])
    searchCalendarEventsForChatMock.mockResolvedValue([
      {
        serviceId: 'calendar-event-1',
        serviceName: 'Inicio matrículas',
        category: 'Calendario',
        score: 1.1,
        hasPdfs: false,
        snippet: 'Evento',
        studentTypes: [],
        pdfRefs: [],
        jsonPayload: { source: 'calendar_events', content_type: 'fechas' },
      },
    ])

    const request = new Request('http://localhost/api/search-services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'matricula',
        crossSection: true,
        limit: 20,
      }),
    })

    const response = await POST(request)
    const body = (await response.json()) as { results: Array<{ serviceId: string }> }

    expect(response.status).toBe(200)
    expect(body.results.map((item) => item.serviceId)).toEqual(['calendar-event-1', 'faq-1'])
  })

  it('incluye calendario en chat aunque crossSection no venga explícito', async () => {
    searchKnowledgeServicesMock.mockResolvedValue([
      {
        serviceId: 'faq-2',
        serviceName: 'Información matrícula',
        category: 'Matrícula',
        score: 0.7,
        hasPdfs: false,
        snippet: 'FAQ',
        studentTypes: [],
        pdfRefs: [],
        jsonPayload: { source: 'neon_hybrid', content_type: 'faq' },
      },
      {
        serviceId: 'knowledge-calendar-2',
        serviceName: 'Calendario desde knowledge',
        category: 'Calendario',
        score: 1.3,
        hasPdfs: false,
        snippet: 'No debe quedar en resultados chat cross',
        studentTypes: [],
        pdfRefs: [],
        jsonPayload: { source: 'neon_hybrid', content_type: 'fechas' },
      },
    ])
    loadKnowledgeTaxonomyMock.mockResolvedValue([])
    searchCalendarEventsForChatMock.mockResolvedValue([
      {
        serviceId: 'calendar-event-2',
        serviceName: 'Inicio de clases',
        category: 'Calendario',
        score: 0.95,
        hasPdfs: false,
        snippet: 'Evento calendario real',
        studentTypes: [],
        pdfRefs: [],
        jsonPayload: { source: 'calendar_events', content_type: 'fechas', event_id: '2' },
      },
    ])

    const request = new Request('http://localhost/api/search-services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'inicio clases',
        limit: 20,
      }),
    })

    const response = await POST(request)
    const body = (await response.json()) as { results: Array<{ serviceId: string }> }

    expect(response.status).toBe(200)
    expect(searchCalendarEventsForChatMock).toHaveBeenCalledTimes(1)
    expect(body.results.map((item) => item.serviceId)).toContain('calendar-event-2')
    expect(body.results.map((item) => item.serviceId)).not.toContain('knowledge-calendar-2')
  })
})

