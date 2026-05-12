import { describe, expect, it } from 'vitest'

import { searchServices } from '@/lib/search/service-search'
import type { CanonicalServiceRecord } from '@/lib/types'

const baseServices: CanonicalServiceRecord[] = [
  {
    serviceId: 'a',
    serviceName: 'Solicitar edición de matrícula',
    category: 'SERVICIOS',
    studentTypes: ['CONTINUO'],
    jsonPayload: { descripcion: '...' },
    pdfRefs: [],
  },
  {
    serviceId: 'b',
    serviceName: 'Retiro voluntario',
    category: 'SERVICIOS',
    studentTypes: ['CONTINUO'],
    jsonPayload: { nota: '...' },
    pdfRefs: [{ label: 'Formato', url: 'x.pdf', localPath: 'x.pdf', sourcePath: '0' }],
  },
]

describe('searchServices', () => {
  it('is accent-insensitive', () => {
    const res = searchServices({ query: 'matricula', services: baseServices, limit: 10 })
    expect(res[0]?.serviceId).toBe('a')
  })

  it('includes hasPdfs flag', () => {
    const res = searchServices({ query: 'retiro', services: baseServices, limit: 10 })
    expect(res[0]?.hasPdfs).toBe(true)
  })

  it('falls back to fuse for typos (accent-insensitive)', () => {
    const res = searchServices({ query: 'matricla', services: baseServices, limit: 10 })
    expect(res[0]?.serviceId).toBe('a')
    expect(res[0]?.score).toBeLessThanOrEqual(1)
    expect(res[0]?.score).toBeGreaterThan(0)
  })

  it('finds matches inside requisitos (deep JSON text)', () => {
    const services: CanonicalServiceRecord[] = [
      {
        serviceId: 'c',
        serviceName: 'Trámite administrativo X',
        category: 'OTROS',
        studentTypes: [],
        jsonPayload: {
          requisitos: ['Carta de solicitud', 'Copia de cédula del titular y representante'],
        },
        pdfRefs: [],
      },
    ]
    const res = searchServices({ query: 'cedula', services, limit: 5 })
    expect(res.some((r) => r.serviceId === 'c')).toBe(true)
    expect(res[0]?.matchHints?.length).toBeGreaterThan(0)
  })

  it('ranks name match above description-only match for the same token', () => {
    const services: CanonicalServiceRecord[] = [
      {
        serviceId: 'nameHit',
        serviceName: 'Certificado de estudios en el exterior',
        category: 'CERT',
        studentTypes: [],
        jsonPayload: { descripcion: 'Trámite general' },
        pdfRefs: [],
      },
      {
        serviceId: 'descOnly',
        serviceName: 'Homologación de documentos',
        category: 'ACAD',
        studentTypes: [],
        jsonPayload: {
          descripcion:
            'Dirigido a quienes requieren certificado de calificaciones y certificado de programa.',
        },
        pdfRefs: [],
      },
    ]
    const res = searchServices({ query: 'certificado', services, limit: 5 })
    expect(res[0]?.serviceId).toBe('nameHit')
  })
})
