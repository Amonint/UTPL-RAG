import fs from 'node:fs/promises'
import path from 'node:path'

import type { RetrievalChunk } from '@/lib/ingest/chunking'
import { normalizeText } from '@/lib/search/normalize'
import type { CanonicalServiceRecord, PdfRef, StudentType } from '@/lib/types'

const DEFAULT_JSON = 'servicios_utpl_jerarquico.json'

function slugify(raw: string): string {
  const s = normalizeText(raw).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return s.length > 0 ? s : 'item'
}

function resolveJsonPath(): string {
  const fromEnv = process.env.SERVICIOS_UTPL_JSON_PATH?.trim()
  if (fromEnv) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.join(process.cwd(), fromEnv)
  }
  return path.join(process.cwd(), DEFAULT_JSON)
}

function asStudentType(raw: string): StudentType {
  const u = raw.toUpperCase()
  if (u === 'ALUMNI' || u === 'CONTINUO' || u === 'NUEVO' || u === 'POSTULANTE' || u === 'SIN_TIPO_EN_API') {
    return u as StudentType
  }
  return 'SIN_TIPO_EN_API'
}

function isPdfUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const t = value.trim().toLowerCase()
  return t.startsWith('http') && (t.endsWith('.pdf') || t.includes('.pdf'))
}

function collectPdfRefs(service: Record<string, unknown>, serviceId: string): PdfRef[] {
  const out: PdfRef[] = []
  let extra = 0

  function push(label: string, url: string, sourcePath: string) {
    let filename = `doc-${extra}.pdf`
    try {
      filename = path.basename(new URL(url).pathname) || filename
    } catch {
      /* ignore invalid URL for basename */
    }
    extra += 1
    out.push({
      label: label.trim() || 'Documento PDF',
      url,
      localPath: path.join('data', 'pdfs', `${serviceId.replace(/[^a-z0-9-_]+/gi, '_')}-${extra}-${filename}`),
      sourcePath,
    })
  }

  const manual = service.manual
  if (Array.isArray(manual)) {
    manual.forEach((entry, i) => {
      if (!entry || typeof entry !== 'object') return
      const row = entry as Record<string, unknown>
      const url = row.url ?? row.pdf
      if (typeof url === 'string' && isPdfUrl(url)) {
        const label = typeof row.texto === 'string' ? row.texto : 'Manual'
        push(label, url, `manual.${i}`)
      }
    })
  }

  function walk(node: unknown, prefix: string) {
    if (!node) return
    if (typeof node === 'string') {
      if (isPdfUrl(node)) {
        push('PDF', node, `${prefix}.url`)
      }
      return
    }
    if (Array.isArray(node)) {
      node.forEach((child, i) => walk(child, `${prefix}.${i}`))
      return
    }
    if (typeof node === 'object') {
      const o = node as Record<string, unknown>
      const pdfField = o.pdf
      if (typeof pdfField === 'string' && isPdfUrl(pdfField)) {
        const label = typeof o.texto === 'string' ? o.texto : 'PDF'
        push(label, pdfField, `${prefix}.pdf`)
      }
      for (const [k, v] of Object.entries(o)) {
        if (k === 'pdf' && typeof v === 'string') continue
        walk(v, `${prefix}.${k}`)
      }
    }
  }

  walk(service.requisitos_pestanas, 'requisitos_pestanas')

  const seen = new Set<string>()
  return out.filter((r) => {
    if (seen.has(r.url)) return false
    seen.add(r.url)
    return true
  })
}

function serviceToSearchText(serviceId: string, serviceName: string, category: string, payload: Record<string, unknown>) {
  const bits: string[] = [
    `serviceId: ${serviceId}`,
    `Servicio: ${serviceName}`,
    `Categoria: ${category}`,
  ]
  for (const key of ['descripcion', 'modalidad_nivel', 'nota', 'tiempo_respuesta', 'costo'] as const) {
    const v = payload[key]
    if (typeof v === 'string' && v.trim()) bits.push(`${key}: ${v.trim()}`)
  }
  const req = payload.requisitos
  if (Array.isArray(req)) {
    bits.push(req.map((x) => String(x)).join(' '))
  }
  return bits.join('\n')
}

interface JerarquiaRoot {
  tipos_de_estudiante?: Array<{
    tipo?: string
    categorias?: Array<{
      nombre?: string
      servicios?: unknown[]
    }>
  }>
}

export interface LoadedArtifacts {
  services: CanonicalServiceRecord[]
  chunks: RetrievalChunk[]
}

let cache: LoadedArtifacts | null = null

export async function loadArtifacts(): Promise<LoadedArtifacts> {
  if (cache && process.env.SERVICIOS_UTPL_NO_CACHE !== '1') {
    return cache
  }

  const jsonPath = resolveJsonPath()
  const raw = await fs.readFile(jsonPath, 'utf8')
  const root = JSON.parse(raw) as JerarquiaRoot

  const byId = new Map<
    string,
    {
      serviceId: string
      serviceName: string
      category: string
      studentTypes: Set<StudentType>
      jsonPayload: Record<string, unknown>
      pdfRefs: PdfRef[]
    }
  >()

  for (const tipoBlock of root.tipos_de_estudiante ?? []) {
    const tipo = asStudentType(String(tipoBlock.tipo ?? 'SIN_TIPO_EN_API'))
    for (const cat of tipoBlock.categorias ?? []) {
      const category = String(cat.nombre ?? 'SIN_CATEGORIA').trim() || 'SIN_CATEGORIA'
      const catSlug = slugify(category)
      for (const rawSvc of cat.servicios ?? []) {
        if (!rawSvc || typeof rawSvc !== 'object' || Array.isArray(rawSvc)) continue
        const svc = rawSvc as Record<string, unknown>
        const nombre = String(svc.nombre ?? 'Sin nombre').trim() || 'Sin nombre'
        const serviceId = `${catSlug}__${slugify(nombre)}`

        const pdfRefs = collectPdfRefs(svc, serviceId)
        const prev = byId.get(serviceId)
        if (!prev) {
          byId.set(serviceId, {
            serviceId,
            serviceName: nombre,
            category,
            studentTypes: new Set([tipo]),
            jsonPayload: svc,
            pdfRefs,
          })
        } else {
          prev.studentTypes.add(tipo)
          if (pdfRefs.length > prev.pdfRefs.length) {
            prev.pdfRefs = pdfRefs
            prev.jsonPayload = svc
          }
        }
      }
    }
  }

  const services: CanonicalServiceRecord[] = Array.from(byId.values()).map((row) => ({
    serviceId: row.serviceId,
    serviceName: row.serviceName,
    category: row.category,
    studentTypes: Array.from(row.studentTypes),
    jsonPayload: row.jsonPayload,
    pdfRefs: row.pdfRefs,
  }))

  const chunks: RetrievalChunk[] = []
  for (const s of services) {
    const jsonText = serviceToSearchText(s.serviceId, s.serviceName, s.category, s.jsonPayload)
    chunks.push({
      chunkId: `${s.serviceId}::json`,
      serviceId: s.serviceId,
      sourceKind: 'json',
      text: jsonText,
      metadata: { kind: 'service-json' },
    })
    s.pdfRefs.forEach((ref, index) => {
      chunks.push({
        chunkId: `${s.serviceId}::pdf::${index}`,
        serviceId: s.serviceId,
        sourceKind: 'pdf',
        text: `${ref.label}\n${ref.url}`,
        metadata: { sourcePath: ref.sourcePath },
      })
    })
  }

  const out: LoadedArtifacts = { services, chunks }
  cache = out
  return out
}

export function clearArtifactsCache() {
  cache = null
}
