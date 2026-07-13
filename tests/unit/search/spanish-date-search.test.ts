import { describe, expect, it } from 'vitest'

import { buildSpanishDateSearchText, buildSpanishDateSearchTokens } from '@/lib/search/spanish-date-search'
import { buildSpanishDateSearchTextSql } from '@/lib/search/spanish-date-search-sql'

describe('buildSpanishDateSearchTokens', () => {
  it('genera variantes naturales en español para una fecha ISO', () => {
    const tokens = buildSpanishDateSearchTokens('2026-06-15')

    expect(tokens).toContain('15')
    expect(tokens).toContain('15 junio')
    expect(tokens).toContain('15 de junio')
    expect(tokens).toContain('junio 15')
    expect(tokens).toContain('junio 2026')
    expect(tokens).toContain('15 junio 2026')
    expect(tokens).toContain('06-15')
    expect(tokens).toContain('2026-06-15')
  })

  it('incluye día con cero a la izquierda', () => {
    const tokens = buildSpanishDateSearchTokens('2026-06-07')
    expect(tokens).toContain('07')
    expect(tokens).toContain('07 junio')
    expect(tokens).toContain('7 junio')
  })
})

describe('buildSpanishDateSearchText', () => {
  it('une tokens de inicio y fin sin duplicar innecesariamente', () => {
    const text = buildSpanishDateSearchText('2026-06-14', '2026-06-14')
    expect(text).toContain('14 junio')
    expect(text).toContain('junio 2026')
  })
})

describe('buildSpanishDateSearchTextSql', () => {
  it('expone variantes en español para columnas de fecha', () => {
    const sql = buildSpanishDateSearchTextSql('ce.starts_on')
    expect(sql).toContain("'junio'")
    expect(sql).toContain("concat(")
    expect(sql).toContain(' de ')
  })
})
