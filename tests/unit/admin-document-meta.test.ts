import { describe, expect, it } from 'vitest'

import { decodeDocumentMeta, encodeDocumentMeta } from '@/lib/admin/document-meta'

describe('admin document meta', () => {
  it('codifica y decodifica el periodo académico', () => {
    const encoded = encodeDocumentMeta({ periodLabel: 'Abril – Agosto 2026' })
    expect(encoded).toMatch(/^admin_doc_meta:v1:/)
    expect(decodeDocumentMeta(encoded).periodLabel).toBe('Abril – Agosto 2026')
  })

  it('devuelve vacío si no hay metadatos', () => {
    expect(decodeDocumentMeta(null)).toEqual({})
    expect(decodeDocumentMeta('otro-valor')).toEqual({})
  })
})
