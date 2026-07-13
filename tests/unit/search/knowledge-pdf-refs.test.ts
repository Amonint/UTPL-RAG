import { describe, expect, it } from 'vitest'

import { parsePdfRefsFromJson } from '@/lib/db/knowledge-services'

describe('parsePdfRefsFromJson', () => {
  it('maps attachment json to PdfRef list', () => {
    const refs = parsePdfRefsFromJson([
      {
        label: 'Guía matrícula',
        url: 'https://example.com/guia.pdf',
        localPath: '/files/guia.pdf',
        sourcePath: '/files/guia.pdf',
      },
    ])

    expect(refs).toHaveLength(1)
    expect(refs[0]).toMatchObject({
      label: 'Guía matrícula',
      url: 'https://example.com/guia.pdf',
    })
  })

  it('returns empty array for invalid payload', () => {
    expect(parsePdfRefsFromJson(null)).toEqual([])
    expect(parsePdfRefsFromJson([{ label: 'sin url' }])).toEqual([])
  })
})
