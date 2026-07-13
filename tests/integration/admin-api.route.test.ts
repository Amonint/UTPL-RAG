import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { GET as getStats } from '@/app/api/admin/stats/route'

const originalAdmin = process.env.ADMIN_ENABLED
const originalDb = process.env.DATABASE_URL

describe('GET /api/admin/stats', () => {
  beforeEach(() => {
    process.env.ADMIN_ENABLED = 'false'
  })

  afterEach(() => {
    if (originalAdmin === undefined) delete process.env.ADMIN_ENABLED
    else process.env.ADMIN_ENABLED = originalAdmin
    if (originalDb === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = originalDb
  })

  it('returns 404 when admin is disabled', async () => {
    const res = await getStats()
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/disabled/i)
  })

  it('returns stats when admin enabled and db configured', async () => {
    if (!process.env.DATABASE_URL?.trim()) {
      return
    }
    process.env.ADMIN_ENABLED = 'true'
    const res = await getStats()
    if (res.status === 503) return
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.stats).toEqual(
      expect.objectContaining({
        items: expect.any(Number),
        categories: expect.any(Number),
        itemsMissingEmbeddings: expect.any(Number),
      }),
    )
  })
})
