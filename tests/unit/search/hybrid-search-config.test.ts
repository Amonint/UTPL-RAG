import { describe, expect, it } from 'vitest'

import { searchFtsWeight, searchSemanticWeight, vectorLiteral } from '@/lib/search/hybrid-search-config'

describe('hybrid-search-config', () => {
  it('serializes vectors for pg', () => {
    expect(vectorLiteral([0.1, 0.2, 0.3])).toBe('[0.10000000,0.20000000,0.30000000]')
  })

  it('combines weights to 1 by default', () => {
    expect(searchFtsWeight() + searchSemanticWeight()).toBeCloseTo(1)
  })
})
