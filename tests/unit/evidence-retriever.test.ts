import { describe, expect, it } from 'vitest'

import { rankEvidenceForService } from '@/lib/retrieval/evidence-retriever'

describe('rankEvidenceForService', () => {
  it('returns JSON plus only PDF chunks from the same service', () => {
    const result = rankEvidenceForService({
      query: 'retiro voluntario',
      serviceId: 'servicios-matricula__solicitar-retiro-voluntario',
      allowPdf: true,
      chunks: [
        {
          chunkId: 'a',
          serviceId: 'servicios-matricula__solicitar-retiro-voluntario',
          sourceKind: 'json',
          text: 'retiro voluntario',
          metadata: {},
        },
        {
          chunkId: 'b',
          serviceId: 'servicios-matricula__solicitar-retiro-voluntario',
          sourceKind: 'pdf',
          text: 'formato retiro voluntario',
          metadata: {},
        },
        {
          chunkId: 'c',
          serviceId: 'servicios-matricula__solicitar-matricula-especial',
          sourceKind: 'pdf',
          text: 'matricula especial',
          metadata: {},
        },
      ],
    })

    expect(result.map((item) => item.chunkId)).toEqual(['a', 'b'])
  })

  it('returns only JSON chunks when allowPdf is false', () => {
    const result = rankEvidenceForService({
      query: 'retiro voluntario',
      serviceId: 'servicios-matricula__solicitar-retiro-voluntario',
      allowPdf: false,
      chunks: [
        {
          chunkId: 'a',
          serviceId: 'servicios-matricula__solicitar-retiro-voluntario',
          sourceKind: 'json',
          text: 'retiro voluntario',
          metadata: {},
        },
        {
          chunkId: 'b',
          serviceId: 'servicios-matricula__solicitar-retiro-voluntario',
          sourceKind: 'pdf',
          text: 'formato retiro voluntario',
          metadata: {},
        },
      ],
    })

    expect(result.map((item) => item.chunkId)).toEqual(['a'])
  })
})
