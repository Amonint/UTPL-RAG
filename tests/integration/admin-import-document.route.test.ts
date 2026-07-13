import { afterEach, describe, expect, it, vi } from 'vitest'

const {
  mockAssertAdminEnabled,
  mockFetchAdminTaxonomyTree,
  mockFetchProfileTypes,
  mockFetchStudentTypes,
  mockFetchCyclePeriods,
  mockFetchEditorialStatuses,
  mockClassifyDocumentWithGemini,
  mockExtractPdfTextFromBuffer,
  mockWithDbTransaction,
  mockCreateKnowledgeItem,
} = vi.hoisted(() => ({
  mockAssertAdminEnabled: vi.fn(),
  mockFetchAdminTaxonomyTree: vi.fn(),
  mockFetchProfileTypes: vi.fn(),
  mockFetchStudentTypes: vi.fn(),
  mockFetchCyclePeriods: vi.fn(),
  mockFetchEditorialStatuses: vi.fn(),
  mockClassifyDocumentWithGemini: vi.fn(),
  mockExtractPdfTextFromBuffer: vi.fn(),
  mockWithDbTransaction: vi.fn(),
  mockCreateKnowledgeItem: vi.fn(),
}))

vi.mock('@/lib/admin/route-guard', () => ({
  assertAdminEnabled: mockAssertAdminEnabled,
}))

vi.mock('@/lib/db/admin/taxonomy-repository', () => ({
  fetchAdminTaxonomyTree: mockFetchAdminTaxonomyTree,
}))

vi.mock('@/lib/db/admin/catalog-repository', () => ({
  fetchProfileTypes: mockFetchProfileTypes,
  fetchStudentTypes: mockFetchStudentTypes,
  fetchCyclePeriods: mockFetchCyclePeriods,
  fetchEditorialStatuses: mockFetchEditorialStatuses,
}))

vi.mock('@/lib/admin/document-import/gemini-import-service', () => ({
  classifyDocumentWithGemini: mockClassifyDocumentWithGemini,
}))

vi.mock('@/lib/ingest/pdf-text', () => ({
  extractPdfTextFromBuffer: mockExtractPdfTextFromBuffer,
}))

vi.mock('@/lib/db/admin/knowledge-item-repository', () => ({
  createKnowledgeItem: mockCreateKnowledgeItem,
}))

vi.mock('@/lib/db/transaction', () => ({
  withDbTransaction: mockWithDbTransaction,
}))

import { POST } from '@/app/api/admin/items/import-document/route'

describe('POST /api/admin/items/import-document', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('crea entradas en review y devuelve resumen', async () => {
    mockAssertAdminEnabled.mockReturnValueOnce(null)
    mockFetchAdminTaxonomyTree.mockResolvedValueOnce([
      {
        id: '00000000-0000-4000-8000-000000000011',
        code: 'academic',
        name: 'Académico',
        categories: [
          {
            id: '00000000-0000-4000-8000-000000000012',
            slug: 'matriculas',
            name: 'Matrículas',
            subcategories: [
              {
                id: '00000000-0000-4000-8000-000000000013',
                slug: 'general',
                name: 'General',
                elements: [
                  {
                    id: '00000000-0000-4000-8000-000000000014',
                    slug: 'proceso',
                    name: 'Proceso',
                  },
                ],
              },
            ],
          },
        ],
      },
    ])
    mockFetchProfileTypes.mockResolvedValueOnce([
      { id: 'pt-1', profileCode: 'student', typeCode: 'en_linea', name: 'En línea' },
    ])
    mockFetchStudentTypes.mockResolvedValueOnce([{ id: 'st-1', code: 'NUEVO', name: 'Nuevo' }])
    mockFetchCyclePeriods.mockResolvedValueOnce([
      { id: 'cp-1', code: 'ABR_AGO_2026', name: 'Abril-Agosto 2026' },
    ])
    mockFetchEditorialStatuses.mockResolvedValueOnce([{ code: 'review', name: 'En revisión' }])
    mockExtractPdfTextFromBuffer.mockResolvedValueOnce('contenido')
    mockClassifyDocumentWithGemini.mockResolvedValueOnce({
      blocks: [
        {
          sectionCode: 'faq',
          taxonomy: {
            domainCode: 'academic',
            categorySlug: 'matriculas',
            subcategorySlug: 'general',
            elementSlug: 'proceso',
          },
          audience: { profileTypeCode: 'en_linea', studentTypeCode: 'NUEVO' },
          title: 'Matrícula',
          questionText: '¿Cómo me matriculo?',
          answerText: 'Respuesta',
        },
      ],
    })
    mockWithDbTransaction.mockImplementation(async (fn: (client: unknown) => Promise<void>) => fn({}))
    mockCreateKnowledgeItem.mockResolvedValueOnce('item-1')

    const formData = new FormData()
    formData.set('file', new File([Buffer.from('pdf')], 'test.pdf', { type: 'application/pdf' }))
    const request = new Request('http://localhost/api/admin/items/import-document', {
      method: 'POST',
      body: formData,
    })

    const res = await POST(request)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.createdCount).toBe(1)
    expect(body.skippedCount).toBe(0)
    expect(body.warnings).toHaveLength(0)
    expect(mockCreateKnowledgeItem).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        editorialStatus: 'review',
        sectionCode: 'faq',
      }),
    )
  })

  it('rechaza archivos no PDF', async () => {
    mockAssertAdminEnabled.mockReturnValueOnce(null)
    mockFetchEditorialStatuses.mockResolvedValueOnce([{ code: 'review', name: 'En revisión' }])
    const formData = new FormData()
    formData.set('file', new File([Buffer.from('x')], 'test.txt', { type: 'text/plain' }))
    const request = new Request('http://localhost/api/admin/items/import-document', {
      method: 'POST',
      body: formData,
    })

    const res = await POST(request)
    expect(res.status).toBe(400)
  })
})
