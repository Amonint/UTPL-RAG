import { describe, expect, it } from 'vitest'

import {
  buildKnowledgeSearchDocumentText,
  parseJsonArrayStrings,
} from '@/lib/search/knowledge-search-document'
import {
  SEARCH_EMBEDDING_DIMENSIONS,
  searchFtsWeight,
  searchSemanticWeight,
} from '@/lib/search/hybrid-search-config'

describe('buildKnowledgeSearchDocumentText', () => {
  it('composes unified lowercase search document from item and taxonomy fields', () => {
    const text = buildKnowledgeSearchDocumentText({
      title: 'Certificados de Quintil',
      questionText: '¿Cómo solicito el certificado?',
      answerText: 'Ingresa al portal de servicios y paga la tasa.',
      synonyms: ['certificado quintil', 'quintil de bachillerato'],
      phrases: ['certificados de quintil'],
      searchForms: ['pedir quintil'],
      elementName: 'Certificados',
      subcategoryName: 'Documentos académicos',
      categoryName: 'Trámites y servicios',
    })

    expect(text).toContain('certificados de quintil')
    expect(text).toContain('certificado quintil')
    expect(text).toContain('trámites y servicios')
    expect(text).toContain('pedir quintil')
  })

  it('includes synonyms and phrases from json arrays', () => {
    const text = buildKnowledgeSearchDocumentText({
      title: 'Error en matricula',
      questionText: 'No puedo pagar la matricula',
      answerText: 'Revisa deuda y vuelve a intentar',
      synonyms: parseJsonArrayStrings('["matricula en linea"]'),
      phrases: parseJsonArrayStrings('["pago matricula"]'),
      elementName: 'Retiro voluntario',
      subcategoryName: 'Matricula',
      categoryName: 'Tramites y servicios',
    })

    expect(text).toContain('matricula en linea')
    expect(text).toContain('pago matricula')
    expect(text).toContain('retiro voluntario')
  })
})

describe('hybrid search weights', () => {
  it('keeps fts + semantic weights bounded', () => {
    expect(SEARCH_EMBEDDING_DIMENSIONS).toBe(768)
    expect(searchFtsWeight() + searchSemanticWeight()).toBeCloseTo(1, 5)
  })
})
