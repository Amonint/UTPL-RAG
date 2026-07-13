'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import { AdminAudienceChips } from '@/components/admin/admin-audience-chips'
import type { AdminItemAudienceRow } from '@/lib/db/admin/knowledge-item-repository'
import {
  advisorVisibilityBadgeClass,
  advisorVisibilityLabel,
  formatAdminDateTime,
  formatMenuPath,
  labelDomain,
  editorialStatusBadgeClass,
  labelEditorialStatus,
  labelModality,
  newItemButtonLabel,
} from '@/lib/admin/ui-labels'
import {
  findPeriodPresetById,
  labelSectionFromCatalog,
  resolveEditorialFilterOptions,
  resolveSectionOptions,
  useAdminFilterCatalogs,
} from '@/hooks/use-admin-filter-catalogs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ItemRow {
  id: string
  title: string | null
  editorialStatus: string
  sectionCode: string
  domainCode: string
  categoryName: string
  subcategoryName: string
  elementName: string
  questionPreview: string | null
  updatedAt: string
  isActive: boolean
  audiences: AdminItemAudienceRow[]
}

const selectClass =
  'rounded-md border border-chalk bg-white px-3 py-2 text-sm text-obsidian'

export function AdminItemsList() {
  const [items, setItems] = useState<ItemRow[]>([])
  const [total, setTotal] = useState(0)
  const { catalogs, periodPresets } = useAdminFilterCatalogs()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [sectionCode, setSectionCode] = useState('')
  const [domainCode, setDomainCode] = useState('')
  const [profileTypeCode, setProfileTypeCode] = useState('')
  const [studentTypeCode, setStudentTypeCode] = useState('')
  const [periodSelect, setPeriodSelect] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [missingEmbeddings, setMissingEmbeddings] = useState<number | null>(null)

  const studentModalities =
    catalogs.profileTypes.filter((p) => p.profileCode === 'student') ?? []
  const sectionOptions = resolveSectionOptions(catalogs.sections)
  const statusOptions = resolveEditorialFilterOptions(catalogs.editorialStatuses)
  const catalogsRef = useRef(catalogs)
  catalogsRef.current = catalogs

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (status) params.set('editorialStatus', status)
      if (sectionCode) params.set('sectionCode', sectionCode)
      if (domainCode) params.set('domainCode', domainCode)
      if (profileTypeCode) params.set('profileTypeCode', profileTypeCode)
      if (studentTypeCode) params.set('studentTypeCode', studentTypeCode)
      const periodPreset = findPeriodPresetById(periodSelect, catalogsRef.current.cyclePeriods)
      if (periodPreset) params.set('periodLabel', periodPreset.label)
      params.set('limit', '100')

      const res = await fetch(`/api/admin/items?${params}`)
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? 'No se pudo cargar la lista de entradas')
        return
      }
      setItems(body.items ?? [])
      setTotal(body.total ?? 0)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo cargar la lista de entradas')
    } finally {
      setLoading(false)
    }
  }, [q, status, sectionCode, domainCode, profileTypeCode, studentTypeCode, periodSelect])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/stats')
        const body = (await res.json()) as { stats?: { itemsMissingEmbeddings?: number } }
        if (res.ok) setMissingEmbeddings(body.stats?.itemsMissingEmbeddings ?? 0)
      } catch {
        setMissingEmbeddings(null)
      }
    })()
  }, [])

  const clearFilters = () => {
    setQ('')
    setStatus('')
    setSectionCode('')
    setDomainCode('')
    setProfileTypeCode('')
    setStudentTypeCode('')
    setPeriodSelect('')
  }

  const hasFilters =
    Boolean(q.trim()) ||
    Boolean(status || sectionCode || domainCode || profileTypeCode || studentTypeCode || periodSelect)

  const handleDelete = async (item: ItemRow) => {
    const name = item.questionPreview || item.title || 'Sin nombre'
    const typeLabel = item.sectionCode === 'faq' ? 'pregunta frecuente' : 'información'
    const ok = window.confirm(`¿Deseas eliminar la ${typeLabel} «${name}»? Esta acción no se puede deshacer.`)
    if (!ok) return
    try {
      const res = await fetch(`/api/admin/items/${encodeURIComponent(item.id)}`, { method: 'DELETE' })
      const body = await res.json()
      if (!res.ok) {
        window.alert(body.error ?? 'No se pudo eliminar la entrada')
        return
      }
      await load()
    } catch {
      window.alert('No se pudo eliminar la entrada')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-obsidian">Administrar información</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/items/import">Cargar desde documento</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/items/new?section=faq">Nueva pregunta frecuente</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/items/new?section=general_info">{newItemButtonLabel('general_info')}</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-chalk bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-gravel">Filtrar listado</p>
          <Link href="/administracion-de-filtros" className="text-xs font-medium text-obsidian underline">
            Administrar filtros
          </Link>
        </div>
        <p className="text-xs text-gravel">
          Use este botón para crear, editar o activar filtros en una página completa.
        </p>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Buscar por nombre, pregunta o respuesta…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="min-w-[200px] flex-1"
          />
          <select
            value={sectionCode}
            onChange={(e) => setSectionCode(e.target.value)}
            className={selectClass}
            aria-label="Pestaña del asesor"
          >
            <option value="">Todas las secciones</option>
            {sectionOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={domainCode}
            onChange={(e) => setDomainCode(e.target.value)}
            className={selectClass}
            aria-label="Área"
          >
            <option value="">Todas las áreas</option>
            {catalogs.domains.map((d) => (
              <option key={d.code} value={d.code}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            value={profileTypeCode}
            onChange={(e) => setProfileTypeCode(e.target.value)}
            className={selectClass}
            aria-label="Modalidad"
          >
            <option value="">Todas las modalidades</option>
            {studentModalities.map((m) => (
              <option key={m.typeCode} value={m.typeCode}>
                {labelModality(m.typeCode, m.name)}
              </option>
            ))}
          </select>
          <select
            value={studentTypeCode}
            onChange={(e) => setStudentTypeCode(e.target.value)}
            className={selectClass}
            aria-label="Tipo de estudiante"
          >
            <option value="">Todos los tipos de estudiante</option>
            {catalogs.studentTypes.map((st) => (
              <option key={st.code} value={st.code}>
                {st.name}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={selectClass}
            aria-label="Estado"
          >
            <option value="">Todos los estados</option>
            {statusOptions.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            value={periodSelect}
            onChange={(e) => setPeriodSelect(e.target.value)}
            className={selectClass}
            aria-label="Periodo académico"
          >
            <option value="">Todos los periodos</option>
            {periodPresets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" onClick={() => void load()}>
            Aplicar filtros
          </Button>
          {hasFilters ? (
            <Button type="button" variant="ghost" onClick={clearFilters}>
              Limpiar
            </Button>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-chalk bg-eggshell/40 p-3 text-xs text-gravel">
        <p className="font-medium text-obsidian">Leyenda rápida de estados</p>
        <p>
          <strong>Borrador</strong>: se está editando y no se muestra al asesor.{' '}
          <strong>En revisión</strong>: pendiente de validación. <strong>Publicado</strong>: ya está visible
          para el asesor.
        </p>
        {missingEmbeddings !== null && missingEmbeddings > 0 ? (
          <p className="mt-2 text-amber-900">
            {missingEmbeddings} entrada(s) publicada(s) sin embedding semántico. La búsqueda por texto sigue
            activa; ejecute <code className="text-xs">npm run db:backfill:search-embeddings</code> o active{' '}
            <code className="text-xs">SEARCH_REINDEX_ENABLED=true</code>.
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : loading ? (
        <p className="text-sm text-gravel">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gravel">
          No hay entradas con estos filtros. Pruebe otra búsqueda o cree una entrada nueva.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-chalk bg-white">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-chalk bg-chalk/50 text-xs text-gravel">
              <tr>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Sección</th>
                <th className="px-3 py-2">Menú del asesor</th>
                <th className="px-3 py-2">Aplica a</th>
                <th className="px-3 py-2">Visibilidad</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Área</th>
                <th className="px-3 py-2">Actualizado</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-chalk align-top last:border-0">
                  <td className="max-w-[220px] px-3 py-2">
                    <p className="line-clamp-2 font-medium text-obsidian">
                      {item.questionPreview || item.title || 'Sin nombre'}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-gravel">
                    {labelSectionFromCatalog(item.sectionCode, catalogs.sections)}
                  </td>
                  <td className="max-w-[200px] px-3 py-2 text-gravel">
                    {formatMenuPath({
                      category: item.categoryName,
                      subcategory: item.subcategoryName,
                      element: item.elementName,
                    })}
                  </td>
                  <td className="max-w-[180px] px-3 py-2">
                    <AdminAudienceChips audiences={item.audiences} />
                  </td>
                  <td className="px-3 py-2">
                    <span className={advisorVisibilityBadgeClass(item.editorialStatus, item.isActive)}>
                      {advisorVisibilityLabel(item.editorialStatus, item.isActive)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={editorialStatusBadgeClass(item.editorialStatus)}>
                      {labelEditorialStatus(item.editorialStatus)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gravel">{labelDomain(item.domainCode)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-gravel">
                    {formatAdminDateTime(item.updatedAt)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-3">
                      <Link href={`/admin/items/${item.id}`} className="text-obsidian underline">
                        Editar
                      </Link>
                      <button
                        type="button"
                        className="text-red-600 underline"
                        onClick={() => void handleDelete(item)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}
