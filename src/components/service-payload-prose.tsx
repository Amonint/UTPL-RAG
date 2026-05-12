import type { ReactNode } from 'react'
import { FileText } from 'lucide-react'

const OMIT_KEYS = new Set(['nombre', 'descripcion'])

/** URLs que ya se muestran en la prosa (para no duplicar `pdfRefs`). Recorrido puro, mismo criterio que enlaces renderizados. */
export function collectPayloadLinkUrls(payload: Record<string, unknown>): Set<string> {
  const out = new Set<string>()
  function walk(value: unknown) {
    if (value === null || value === undefined) return
    if (Array.isArray(value)) {
      for (const x of value) walk(x)
      return
    }
    if (typeof value !== 'object') return
    const o = value as Record<string, unknown>
    const pdf = o.pdf
    if (typeof pdf === 'string' && pdf.trim()) out.add(pdf.trim())
    const url = o.url
    if (typeof url === 'string' && url.trim().startsWith('http')) out.add(url.trim())
    for (const v of Object.values(o)) walk(v)
  }
  walk(payload)
  return out
}

const JSON_FIELD_LABELS: Record<string, string> = {
  descripcion: 'Descripción',
  nota: 'Nota',
  requisitos: 'Requisitos',
  costo: 'Costo',
  tiempo_respuesta: 'Tiempo de respuesta',
  modalidad_nivel: 'Modalidad / nivel',
  titulo: 'Título',
  nombre: 'Nombre',
  importante: 'Importante',
  enlace: 'Enlace',
  url: 'URL',
  periodos: 'Periodos',
  modalidades: 'Modalidades',
  solicitud: 'Solicitud',
  manual: 'Manuales / enlaces',
  pestaña: 'Pestaña',
  requisitos_pestanas: 'Requisitos por modalidad',
}

export function humanizePayloadKey(key: string): string {
  if (JSON_FIELD_LABELS[key]) return JSON_FIELD_LABELS[key]
  const spaced = key.replace(/_/g, ' ')
  return spaced.replace(/(^|\s)(\S)/g, (_, sep: string, ch: string) => sep + ch.toUpperCase())
}

function tabLabelFromRecord(tab: Record<string, unknown>, index: number): string {
  const raw = tab.pestaña ?? tab['pestañA'] ?? tab.pestana
  if (typeof raw === 'string' && raw.trim()) return raw.trim()
  return `Pestaña ${index + 1}`
}

function LinkWithFileIcon({ href, children }: { href: string; children: ReactNode }) {
  const u = href.trim()
  if (!u) return null
  return (
    <a
      href={u}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 font-medium text-primary underline underline-offset-2 hover:text-primary/90"
    >
      <FileText className="size-4 shrink-0 opacity-80" aria-hidden />
      {children}
    </a>
  )
}

function renderRequisitosListItem(item: unknown): ReactNode {
  if (item === null || item === undefined) return null
  if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
    return <span className="whitespace-pre-wrap break-words">{String(item)}</span>
  }
  if (typeof item !== 'object') return null
  const o = item as Record<string, unknown>
  const texto = typeof o.texto === 'string' ? o.texto.trim() : ''
  const pdf = typeof o.pdf === 'string' ? o.pdf.trim() : ''
  if (texto && pdf) {
    return (
      <LinkWithFileIcon href={pdf}>
        {texto}
      </LinkWithFileIcon>
    )
  }
  if (texto) return <span className="whitespace-pre-wrap break-words">{texto}</span>
  return null
}

function renderRequisitosListaEntry(entry: Record<string, unknown>, key: number): ReactNode {
  const titulo = typeof entry.titulo === 'string' ? entry.titulo.trim() : ''
  const items = entry.items
  if (titulo && Array.isArray(items)) {
    return (
      <div key={key} className="grid gap-1.5">
        <p className="m-0 font-normal">{titulo}</p>
        <ul className="m-0 list-disc space-y-1 pl-5">
          {items.map((it, j) => {
            const inner = renderRequisitosListItem(it)
            return inner ? <li key={j}>{inner}</li> : null
          })}
        </ul>
      </div>
    )
  }
  const texto = typeof entry.texto === 'string' ? entry.texto.trim() : ''
  const pdf = typeof entry.pdf === 'string' ? entry.pdf.trim() : ''
  if (texto && pdf) {
    return (
      <p key={key} className="m-0">
        <LinkWithFileIcon href={pdf}>
          {texto}
        </LinkWithFileIcon>
      </p>
    )
  }
  if (texto) {
    return (
      <p key={key} className="m-0 whitespace-pre-wrap">
        {texto}
      </p>
    )
  }
  return null
}

function renderRequisitosContenido(contenido: unknown): ReactNode {
  if (!Array.isArray(contenido)) return null
  return (
    <div className="grid gap-3">
      {contenido.map((block, i) => {
        if (block === null || block === undefined) return null
        if (typeof block !== 'object') return null
        const b = block as Record<string, unknown>
        if (Array.isArray(b.lista)) {
          return (
            <div key={i} className="grid gap-3">
              {b.lista.map((entry, j) =>
                entry && typeof entry === 'object'
                  ? renderRequisitosListaEntry(entry as Record<string, unknown>, j)
                  : null,
              )}
            </div>
          )
        }
        if (typeof b.texto === 'string' && b.texto.trim()) {
          return (
            <p key={i} className="m-0 whitespace-pre-wrap">
              {b.texto.trim()}
            </p>
          )
        }
        return null
      })}
    </div>
  )
}

function renderRequisitosPestanas(value: unknown): ReactNode {
  if (!Array.isArray(value) || value.length === 0) return null
  return (
    <div className="grid gap-4">
      {value.map((tab, i) => {
        if (tab === null || tab === undefined || typeof tab !== 'object') return null
        const t = tab as Record<string, unknown>
        const label = tabLabelFromRecord(t, i)
        return (
          <div key={`${label}-${i}`} className="grid gap-2">
            <p className="m-0 font-normal">{label}</p>
            {renderRequisitosContenido(t.contenido)}
          </div>
        )
      })}
    </div>
  )
}

function renderPeriodos(value: unknown): ReactNode {
  if (!Array.isArray(value) || value.length === 0) return null
  return (
    <div className="grid gap-4">
      {value.map((p, i) => {
        if (p === null || p === undefined || typeof p !== 'object') return null
        const periodo = p as Record<string, unknown>
        const nombre = typeof periodo.nombre === 'string' ? periodo.nombre.trim() : ''
        const modalidades = periodo.modalidades
        return (
          <div key={i} className="grid gap-2">
            {nombre ? <p className="m-0 font-normal">{nombre}</p> : null}
            {Array.isArray(modalidades) && modalidades.length > 0 ? (
              <ul className="m-0 list-disc space-y-2 pl-5">
                {modalidades.map((m, j) => {
                  if (m === null || m === undefined || typeof m !== 'object') return null
                  const mod = m as Record<string, unknown>
                  const entries = Object.entries(mod).filter(
                    ([k, v]) => !k.startsWith('_') && v !== null && v !== undefined && v !== '',
                  )
                  return (
                    <li key={j} className="m-0">
                      <div className="grid gap-1">
                        {entries.map(([k, v]) => (
                          <p key={k} className="m-0 whitespace-pre-wrap">
                            <span className="font-medium">{humanizePayloadKey(k)}:</span>{' '}
                            {typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
                              ? String(v)
                              : null}
                          </p>
                        ))}
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function renderManual(value: unknown): ReactNode {
  if (!Array.isArray(value) || value.length === 0) return null
  return (
    <ul className="m-0 list-disc space-y-2 pl-5">
      {value.map((row, i) => {
        if (row === null || row === undefined || typeof row !== 'object') return null
        const o = row as Record<string, unknown>
        const texto = typeof o.texto === 'string' ? o.texto.trim() : ''
        const url = typeof o.url === 'string' ? o.url.trim() : ''
        if (url && texto) {
          return (
            <li key={i}>
              <LinkWithFileIcon href={url}>
                {texto}
              </LinkWithFileIcon>
            </li>
          )
        }
        if (url) {
          return (
            <li key={i}>
              <LinkWithFileIcon href={url}>
                {url}
              </LinkWithFileIcon>
            </li>
          )
        }
        if (texto) {
          return (
            <li key={i} className="whitespace-pre-wrap">
              {texto}
            </li>
          )
        }
        return null
      })}
    </ul>
  )
}

function renderObjectLines(obj: Record<string, unknown>, depth: number): ReactNode {
  if (depth > 5) return <span className="text-cinder">…</span>
  const entries = Object.entries(obj).filter(
    ([k, v]) => !k.startsWith('_') && v !== null && v !== undefined && v !== '',
  )
  if (entries.length === 0) return null
  return (
    <div className="grid gap-1 border-l border-chalk pl-3">
      {entries.map(([k, v]) => (
        <div key={k} className="grid gap-0.5">
          <span className="text-[15px] font-medium text-gravel">{humanizePayloadKey(k)}</span>
          <div className="text-[15px] leading-7">{renderValueInline(v, depth + 1)}</div>
        </div>
      ))}
    </div>
  )
}

function renderValueInline(value: unknown, depth: number): ReactNode {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return <span className="whitespace-pre-wrap break-words">{String(value)}</span>
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return null
    if (value.every((x) => typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean')) {
      return (
        <ul className="m-0 list-disc space-y-1 pl-5">
          {value.map((x, i) => (
            <li key={i}>{String(x)}</li>
          ))}
        </ul>
      )
    }
    return (
      <ul className="m-0 list-disc space-y-1 pl-5">
        {value.map((x, i) => (
          <li key={i}>{renderValueInline(x, depth + 1)}</li>
        ))}
      </ul>
    )
  }
  if (typeof value === 'object') {
    return renderObjectLines(value as Record<string, unknown>, depth)
  }
  return null
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string' && value.trim() === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  return false
}

function renderFieldBody(fieldKey: string, value: unknown): ReactNode {
  if (fieldKey === 'requisitos_pestanas') {
    return renderRequisitosPestanas(value)
  }
  if (fieldKey === 'periodos') {
    return renderPeriodos(value)
  }
  if (fieldKey === 'manual') {
    return renderManual(value)
  }
  if (fieldKey === 'requisitos' && Array.isArray(value) && value.every((x) => typeof x === 'string')) {
    return (
      <ul className="m-0 list-disc space-y-1 pl-5">
        {(value as string[]).map((line, i) => (
          <li key={i} className="whitespace-pre-wrap">
            {line}
          </li>
        ))}
      </ul>
    )
  }
  if (fieldKey === 'importante' && Array.isArray(value) && value.every((x) => typeof x === 'string')) {
    return (
      <ul className="m-0 list-disc space-y-1 pl-5">
        {(value as string[]).map((line, i) => (
          <li key={i} className="whitespace-pre-wrap">
            {line}
          </li>
        ))}
      </ul>
    )
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return <span className="whitespace-pre-wrap break-words">{String(value)}</span>
  }
  if (Array.isArray(value)) {
    return renderValueInline(value, 0)
  }
  if (typeof value === 'object' && value !== null) {
    return renderObjectLines(value as Record<string, unknown>, 0)
  }
  return null
}

export interface ServicePayloadProseProps {
  payload: Record<string, unknown>
}

export function ServicePayloadProse({ payload }: ServicePayloadProseProps) {
  const keys = Object.keys(payload).filter((k) => !k.startsWith('_') && !OMIT_KEYS.has(k))

  const sections: ReactNode[] = []
  for (const key of keys) {
    const value = payload[key]
    if (isEmptyValue(value)) continue
    const body = renderFieldBody(key, value)
    if (body === null) continue
    sections.push(
      <section key={key} className="grid gap-2">
        <p className="m-0 text-[15px] leading-7">
          <strong>{humanizePayloadKey(key)}</strong>
        </p>
        <div className="text-[15px] leading-7">{body}</div>
      </section>,
    )
  }

  if (sections.length === 0) return null
  return <div className="grid gap-4">{sections}</div>
}
