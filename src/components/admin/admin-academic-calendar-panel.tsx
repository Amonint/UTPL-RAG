'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

import {
  AdminCalendarEventDialog,
  type CalendarEventDialogFilters,
} from '@/components/admin/admin-calendar-event-dialog'
import type { CalendarEventWithScope } from '@/lib/calendar/types'
import { colorForCategory } from '@/lib/calendar/event-categories'
import { isCalendarEventPendingReview } from '@/lib/calendar/event-scope-meta'
import { labelModality } from '@/lib/admin/ui-labels'
import { normalizeText } from '@/lib/search/normalize'
import { findPeriodPresetById, useAdminFilterCatalogs } from '@/hooks/use-admin-filter-catalogs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function formatDateShort(ymd: string) {
  return new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(ymd + 'T00:00:00'))
}

const selectClass = 'rounded-md border border-chalk bg-white px-3 py-2 text-sm text-obsidian'

export function AdminAcademicCalendarPanel({ fullPage = false }: { fullPage?: boolean }) {
  const { catalogs, periodPresets } = useAdminFilterCatalogs()
  const catalogsRef = useRef(catalogs)
  catalogsRef.current = catalogs

  const [domainCode, setDomainCode] = useState('')
  const [profileTypeCode, setProfileTypeCode] = useState('')
  const [studentTypeCode, setStudentTypeCode] = useState('')
  const [periodSelect, setPeriodSelect] = useState('')
  const [q, setQ] = useState('')

  const [events, setEvents] = useState<CalendarEventWithScope[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tablesReady, setTablesReady] = useState(true)

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [editingEvent, setEditingEvent] = useState<CalendarEventWithScope | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ includePast: '1' })
    if (domainCode) params.set('domainCode', domainCode)
    if (profileTypeCode) params.set('profileTypeCode', profileTypeCode)
    if (studentTypeCode) params.set('studentTypeCode', studentTypeCode)
    const periodPreset = findPeriodPresetById(periodSelect, catalogsRef.current.cyclePeriods)
    if (periodPreset) {
      params.set('periodLabel', periodPreset.label)
      params.set('periodValidFrom', periodPreset.validFrom)
      params.set('periodValidTo', periodPreset.validTo)
    }

    const res = await fetch(`/api/admin/calendar-events?${params}`)
    const body = await res.json()
    if (!res.ok) {
      setTablesReady(res.status !== 503)
      setError(body.error ?? 'No se pudo cargar el calendario')
      setEvents([])
      setTotal(0)
    } else {
      setTablesReady(true)
      const loaded: CalendarEventWithScope[] = body.events ?? []
      setEvents(loaded)
      setTotal(loaded.length)
    }
    setLoading(false)
  }, [domainCode, profileTypeCode, studentTypeCode, periodSelect])

  useEffect(() => {
    void load()
  }, [load])

  const dialogFilters: CalendarEventDialogFilters = useMemo(
    () => ({ domainCode, profileTypeCode, studentTypeCode, periodSelect }),
    [domainCode, profileTypeCode, studentTypeCode, periodSelect],
  )

  const studentModalities = catalogs.profileTypes.filter((p) => p.profileCode === 'student')

  const hasFilters =
    Boolean(q.trim()) ||
    Boolean(domainCode || profileTypeCode || studentTypeCode || periodSelect)

  const clearFilters = () => {
    setQ('')
    setDomainCode('')
    setProfileTypeCode('')
    setStudentTypeCode('')
    setPeriodSelect('')
  }

  const filtered = useMemo(() => {
    const base = !q.trim()
      ? events
      : events.filter(
          (e) =>
            normalizeText(e.title).includes(normalizeText(q.trim())) ||
            normalizeText(e.category).includes(normalizeText(q.trim())) ||
            normalizeText(e.modality).includes(normalizeText(q.trim())),
        )
    return [...base].sort((a, b) => {
      const aPending = isCalendarEventPendingReview(a.scope) ? 0 : 1
      const bPending = isCalendarEventPendingReview(b.scope) ? 0 : 1
      if (aPending !== bPending) return aPending - bPending
      return a.start.localeCompare(b.start)
    })
  }, [events, q])

  const pendingCount = useMemo(
    () => events.filter((e) => isCalendarEventPendingReview(e.scope)).length,
    [events],
  )

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openCreate = () => {
    setDialogMode('create')
    setEditingEvent(null)
    setDialogOpen(true)
  }

  const openEdit = (event: CalendarEventWithScope) => {
    setDialogMode('edit')
    setEditingEvent(event)
    setDialogOpen(true)
  }

  const handleDelete = async (event: CalendarEventWithScope) => {
    if (typeof event.id !== 'string') return
    const ok = window.confirm(`¿Deseas eliminar el evento «${event.title}»? Esta acción no se puede deshacer.`)
    if (!ok) return
    const res = await fetch(`/api/admin/calendar-events/${encodeURIComponent(event.id)}`, {
      method: 'DELETE',
    })
    const body = await res.json()
    if (!res.ok) {
      window.alert(body.error ?? 'No se pudo eliminar')
      return
    }
    await load()
  }

  const domainName = (code: string | undefined) =>
    catalogs.domains.find((d) => d.code === code)?.name ?? code ?? '—'
  const profileTypeName = (code: string | undefined) =>
    catalogs.profileTypes.find((p) => p.typeCode === code)?.name ?? code ?? '—'
  const studentTypeName = (code: string | undefined) =>
    catalogs.studentTypes.find((s) => s.code === code)?.name ?? code ?? '—'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-obsidian">Calendario académico</h2>
          <p className="text-sm text-gravel">
            Al crear un evento complete el tipo de evento y la audiencia (área, modalidad, tipo de
            estudiante y periodo) para que aparezca en el calendario del asesor.
          </p>
          {pendingCount > 0 ? (
            <p className="mt-1 text-sm text-amber-800">
              Hay {pendingCount} evento{pendingCount === 1 ? '' : 's'} pendiente
              {pendingCount === 1 ? '' : 's'} de revisión (cargados desde /cargar).
            </p>
          ) : null}
        </div>
        {tablesReady ? <Button onClick={openCreate}>Nuevo evento</Button> : null}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-chalk bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-gravel">Filtrar listado</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Buscar por nombre, categoría o modalidad…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="min-w-[200px] flex-1"
          />
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

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {!tablesReady ? (
        <p className="text-sm text-amber-800">
          Ejecute la migración SQL de calendario en Neon para habilitar la edición.
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-gravel">Cargando…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gravel">
          No hay eventos con estos filtros. Pruebe otra búsqueda o cree un evento nuevo.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-chalk bg-white">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-chalk bg-chalk/50 text-xs text-gravel">
              <tr>
                <th className="w-8 px-3 py-2" />
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Categoría</th>
                <th className="px-3 py-2">Modalidad</th>
                <th className="px-3 py-2">Inicio</th>
                <th className="px-3 py-2">Fin</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((event) => {
                const id = String(event.id)
                const isExpanded = expandedIds.has(id)
                const isDbEvent = typeof event.id === 'string'
                const catColor = colorForCategory(event.category)
                const scope = event.scope
                const hasScope =
                  scope &&
                  (scope.domainCode ||
                    scope.profileTypeCode ||
                    scope.studentTypeCode ||
                    scope.periodLabel)

                return (
                  <Fragment key={id}>
                    <tr
                      className="cursor-pointer border-b border-chalk align-top last:border-0 hover:bg-chalk/30"
                      onClick={() => toggleExpand(id)}
                    >
                      <td className="px-3 py-2 text-gravel">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </td>
                      <td className="max-w-[280px] px-3 py-2">
                        <div className="flex flex-col gap-1">
                          <p className="line-clamp-2 font-medium text-obsidian">{event.title}</p>
                          {isCalendarEventPendingReview(event.scope) ? (
                            <span className="inline-flex w-fit rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                              En revisión
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold"
                          style={{
                            background: `${catColor}14`,
                            color: catColor,
                            border: `1px solid ${catColor}33`,
                          }}
                        >
                          {event.category}
                        </span>
                      </td>
                      <td className="max-w-[200px] px-3 py-2 text-gravel">{event.modality}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-gravel">
                        {formatDateShort(event.start)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-gravel">
                        {formatDateShort(event.end)}
                      </td>
                      <td
                        className="px-3 py-2 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isDbEvent ? (
                          <div className="flex justify-end gap-3">
                            <button
                              type="button"
                              className="text-obsidian underline"
                              onClick={() => openEdit(event)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="text-red-600 underline"
                              onClick={() => void handleDelete(event)}
                            >
                              Eliminar
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr className="border-b border-chalk bg-chalk/20">
                        <td />
                        <td colSpan={6} className="px-3 pb-3 pt-2">
                          {hasScope ? (
                            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gravel">
                              {scope?.domainCode ? (
                                <span>
                                  <span className="font-medium text-obsidian">Área:</span>{' '}
                                  {domainName(scope.domainCode)}
                                </span>
                              ) : null}
                              {scope?.profileTypeCode ? (
                                <span>
                                  <span className="font-medium text-obsidian">Modalidad:</span>{' '}
                                  {profileTypeName(scope.profileTypeCode)}
                                </span>
                              ) : null}
                              {scope?.studentTypeCode ? (
                                <span>
                                  <span className="font-medium text-obsidian">
                                    Tipo de estudiante:
                                  </span>{' '}
                                  {studentTypeName(scope.studentTypeCode)}
                                </span>
                              ) : null}
                              {scope?.periodLabel ? (
                                <span>
                                  <span className="font-medium text-obsidian">Periodo:</span>{' '}
                                  {scope.periodLabel}
                                </span>
                              ) : null}
                              {scope?.periodValidFrom ? (
                                <span>
                                  <span className="font-medium text-obsidian">Vigencia:</span>{' '}
                                  {scope.periodValidFrom} → {scope.periodValidTo}
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <p className="text-xs italic text-gravel">
                              Sin alcance específico — aplica a todos los asesores.
                            </p>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <AdminCalendarEventDialog
        open={dialogOpen}
        mode={dialogMode}
        event={editingEvent}
        initialScope={editingEvent?.scope ?? null}
        filters={dialogFilters}
        domains={catalogs.domains}
        profileTypes={catalogs.profileTypes}
        studentTypes={catalogs.studentTypes}
        periodPresets={periodPresets}
        onClose={() => setDialogOpen(false)}
        onSaved={() => void load()}
      />
    </div>
  )
}
