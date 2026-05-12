import type { CanonicalServiceRecord } from '@/lib/types'
import { searchServices } from '@/lib/search/service-search'

export function routeCandidates(input: { query: string; services: CanonicalServiceRecord[] }) {
  const hits = searchServices({ query: input.query, services: input.services, limit: 6 })
  if (hits.length === 0) {
    return { candidates: [] as Array<{ serviceId: string; serviceName: string; score: number }>, needsDisambiguation: true }
  }

  const [first, second] = hits
  const scoreGap = second ? first.score - second.score : 1
  const ambiguous = Boolean(second) && scoreGap < 0.06 && first.score < 0.995

  if (ambiguous) {
    return {
      candidates: hits.slice(0, 4).map((h) => ({
        serviceId: h.serviceId,
        serviceName: h.serviceName,
        score: h.score,
      })),
      needsDisambiguation: true,
    }
  }

  return {
    candidates: [
      {
        serviceId: first.serviceId,
        serviceName: first.serviceName,
        score: first.score,
      },
    ],
    needsDisambiguation: false,
  }
}
