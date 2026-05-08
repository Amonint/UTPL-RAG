import { describe, expect, it } from 'vitest'

import { createAssistantTurn } from '@/lib/chat/create-assistant-turn'

describe('createAssistantTurn', () => {
  it('builds an ambiguity message when the backend returns multiple candidates', () => {
    const turn = createAssistantTurn({
      answer: null,
      needsDisambiguation: true,
      selectedService: null,
      usedSources: [],
      serviceCandidates: [
        { serviceId: 'a', serviceName: 'Solicitar retiro voluntario', score: 0.92 },
        { serviceId: 'b', serviceName: 'Solicitar retiro por caso fortuito o fuerza mayor', score: 0.87 },
      ],
    })

    expect(turn.role).toBe('assistant')
    expect(turn.content).toContain('Estos resultados se parecen a tu búsqueda')
    expect(turn.serviceCandidates).toHaveLength(2)
  })
})
