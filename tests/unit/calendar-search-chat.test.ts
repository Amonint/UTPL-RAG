import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbQueryMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db/postgres', () => ({
  dbQuery: dbQueryMock,
}))

import { searchCalendarEventsForChat } from '@/lib/db/admin/calendar-events-repository'

describe('searchCalendarEventsForChat', () => {
  beforeEach(() => {
    dbQueryMock.mockReset()
    delete process.env.SEARCH_CALENDAR_VECTOR_ENABLED
  })

  it('normaliza mayúsculas y tildes cuando unaccent está disponible', async () => {
    dbQueryMock
      .mockResolvedValueOnce({ rows: [{ ready: true }] }) // calendarEventsTableReady
      .mockResolvedValueOnce({ rows: [{ ready: true }] }) // isUnaccentReady
      .mockResolvedValueOnce({ rows: [{ ready: true }] }) // isPgTrgmReady
      .mockResolvedValueOnce({ rows: [{ ready: false }] }) // embedding column ready
      .mockResolvedValueOnce({ rows: [] }) // final search query

    await searchCalendarEventsForChat({ query: 'MATRÍCULA 2026', limit: 10 })

    const lastCall = dbQueryMock.mock.calls.at(-1)
    expect(lastCall).toBeTruthy()

    const [sql, values] = lastCall as [string, unknown[]]
    expect(sql).toContain('lower(unaccent')
    expect(values[0]).toBe('%matricula 2026%')
    expect(values[1]).toBe('matricula 2026')
  })

  it('indexa fechas en español natural para consultas como "15 junio"', async () => {
    dbQueryMock
      .mockResolvedValueOnce({ rows: [{ ready: true }] })
      .mockResolvedValueOnce({ rows: [{ ready: true }] })
      .mockResolvedValueOnce({ rows: [{ ready: true }] })
      .mockResolvedValueOnce({ rows: [{ ready: false }] })
      .mockResolvedValueOnce({ rows: [] })

    await searchCalendarEventsForChat({ query: '15 junio', limit: 5 })

    const [sql] = dbQueryMock.mock.calls.at(-1) as [string, unknown[]]
    expect(sql).toContain('starts_on_spanish')
    expect(sql).toContain("'junio'")
    expect(sql).toContain(' de ')
  })
})

