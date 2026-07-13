import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from '@/app/api/admin/items/route'
import { dbQuery } from '@/lib/db/postgres'

const embedSearchText = vi.fn()

vi.mock('@/lib/search/embeddings/gemini-embeddings', () => ({
  embedSearchText: (...args: unknown[]) => embedSearchText(...args),
  isEmbeddingProviderConfigured: () => true,
}))

const originalAdmin = process.env.ADMIN_ENABLED
const originalDb = process.env.DATABASE_URL

describe('POST /api/admin/items', () => {
  beforeEach(() => {
    process.env.ADMIN_ENABLED = 'true'
    embedSearchText.mockRejectedValue(
      new Error('models/text-embedding-004 is not found for API version v1beta'),
    )
  })

  afterEach(() => {
    if (originalAdmin === undefined) delete process.env.ADMIN_ENABLED
    else process.env.ADMIN_ENABLED = originalAdmin
    if (originalDb === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = originalDb
  })

  it('creates item when embedding provider fails', async () => {
    if (!process.env.DATABASE_URL?.trim()) return

    const { rows } = await dbQuery<{ element_id: string; domain_id: string }>(`
      select ke.id::text as element_id, d.id::text as domain_id
      from kb_elements ke
      join kb_subcategories ks on ks.id = ke.kb_subcategory_id
      join kb_categories kc on kc.id = ks.kb_category_id
      join domains d on d.id = kc.domain_id
      where ke.is_active and ks.is_active and kc.is_active and d.is_active
      limit 1
    `)
    const row = rows[0]
    if (!row) return

    const token = `FIX_TEST_${Date.now()}`
    const response = await POST(
      new Request('http://localhost/api/admin/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kbElementId: row.element_id,
          domainId: row.domain_id,
          sectionCode: 'faq',
          contentType: 'faq',
          title: `Admin fix test ${token}`,
          questionText: `¿Pregunta ${token}?`,
          answerText: `Respuesta ${token} con suficiente texto.`,
          editorialStatus: 'published',
        }),
      }),
    )

    expect(response.status).toBe(201)
    const body = (await response.json()) as { id?: string }
    expect(body.id).toBeTruthy()

    if (body.id) {
      const { DELETE } = await import('@/app/api/admin/items/[id]/route')
      await DELETE(new Request('http://localhost'), { params: Promise.resolve({ id: body.id }) })
    }
  })
})
