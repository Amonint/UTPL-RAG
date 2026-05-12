import type { CanonicalServiceRecord } from '@/lib/types'

import { normalizeText } from '@/lib/search/normalize'

/** Raíces de payload consideradas “estructura / modalidad” (L2). */
const L2_TOP = new Set([
  'modalidad_nivel',
  'modalidades',
  'periodos',
  'solicitud',
  'titulo',
])

/** Raíces de texto principal (L3). */
const L3_TOP = new Set(['descripcion', 'nota', 'requisitos'])

export type ServiceSearchIndexRow = {
  service: CanonicalServiceRecord
  serviceNameNorm: string
  categoryNorm: string
  l1: string
  l2: string
  l3: string
  l4: string
}

function pathToLayer(path: string[]): 2 | 3 | 4 {
  if (path.length === 0) return 4
  const top = path[0]
  if (top === 'requisitos_pestanas') {
    const last = path[path.length - 1]?.toLowerCase() ?? ''
    if (last === 'pestaña' || last === 'pestana') return 2
    return 4
  }
  if (L3_TOP.has(top)) return 3
  if (L2_TOP.has(top)) return 2
  return 4
}

function pushPart(parts: { l2: string[]; l3: string[]; l4: string[] }, layer: 2 | 3 | 4, raw: string) {
  const t = String(raw).trim()
  if (t.length < 2) return
  if (layer === 2) parts.l2.push(t)
  else if (layer === 3) parts.l3.push(t)
  else parts.l4.push(t)
}

function collectFromValue(value: unknown, path: string[], parts: { l2: string[]; l3: string[]; l4: string[] }) {
  if (value === null || value === undefined) return
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    pushPart(parts, pathToLayer(path), String(value))
    return
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) collectFromValue(value[i], [...path, String(i)], parts)
    return
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      collectFromValue(v, [...path, k], parts)
    }
  }
}

export function buildServiceSearchIndexRow(service: CanonicalServiceRecord): ServiceSearchIndexRow {
  const payload = service.jsonPayload ?? {}
  const parts = { l2: [] as string[], l3: [] as string[], l4: [] as string[] }
  collectFromValue(payload, [], parts)

  const st = service.studentTypes?.length ? service.studentTypes.join(' ') : ''
  const nombrePayload = typeof payload.nombre === 'string' ? payload.nombre : ''
  const l1Raw = [service.serviceName, service.category, st, nombrePayload].filter(Boolean).join(' ')

  const pdfLabels = (service.pdfRefs ?? []).map((r) => r.label?.trim()).filter(Boolean) as string[]

  return {
    service,
    serviceNameNorm: normalizeText(service.serviceName),
    categoryNorm: normalizeText(service.category),
    l1: normalizeText(l1Raw),
    l2: normalizeText(parts.l2.join(' ')),
    l3: normalizeText(parts.l3.join(' ')),
    l4: normalizeText([parts.l4.join(' '), ...pdfLabels].join(' ')),
  }
}
