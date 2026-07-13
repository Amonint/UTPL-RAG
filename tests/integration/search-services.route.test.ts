import { POST } from '@/app/api/search-services/route'
import { searchKnowledgeServices } from '@/lib/db/knowledge-services'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/knowledge-services', () => ({
  searchKnowledgeServices: vi.fn(async () => []),
  loadKnowledgeTaxonomy: vi.fn(async () => []),
}))

describe('POST /api/search-services', () => {
  it('uses Neon hybrid search backend', async () => {
    process.env.DATABASE_URL = 'postgres://test/test'
    const response = await POST(
      new Request('http://localhost/api/search-services', {
        method: 'POST',
        body: JSON.stringify({ query: 'matricula', limit: 5 }),
      }),
    )
    expect(response.status).toBe(200)
    expect(searchKnowledgeServices).toHaveBeenCalledTimes(1)
  })
})
