import { describe, expect, it } from 'vitest'

import { normalizeNeonConnectionString } from '@/lib/db/postgres-internal'

describe('normalizeNeonConnectionString', () => {
  it('adds pooler and drops channel_binding for Neon hosts', () => {
    const input =
      'postgresql://u:p@ep-empty-queen-aq4t12ad.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
    const out = normalizeNeonConnectionString(input)
    expect(out).toContain('ep-empty-queen-aq4t12ad-pooler.c-8.us-east-1.aws.neon.tech')
    expect(out).toContain('sslmode=require')
    expect(out).not.toContain('channel_binding')
  })

  it('is idempotent when pooler is already present', () => {
    const input =
      'postgresql://u:p@ep-empty-queen-aq4t12ad-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require'
    expect(normalizeNeonConnectionString(input)).toContain(
      'ep-empty-queen-aq4t12ad-pooler.c-8.us-east-1.aws.neon.tech',
    )
    expect(normalizeNeonConnectionString(input).match(/-pooler/g)).toHaveLength(1)
  })
})
