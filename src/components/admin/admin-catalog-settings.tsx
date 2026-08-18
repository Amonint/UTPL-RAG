'use client'

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type CatalogTab =
  | 'sections'
  | 'domains'
  | 'modalities'
  | 'studentTypes'
  | 'editorialStatuses'
  | 'cyclePeriods'

const TABS: Array<{ id: CatalogTab; title: string; hint: string }> = [
  {
    id: 'sections',
    title: 'Secciones',
    hint: 'Pestañas del asesor: Preguntas frecuentes, Información, etc.',
  },
  {
    id: 'domains',
    title: 'Áreas',
    hint: 'Agrupación temática del menú (Servicios, Académico…).',
  },
  {
    id: 'modalities',
    title: 'Modalidades',
    hint: 'Presencial, en línea, distancia…',
  },
  {
    id: 'studentTypes',
    title: 'Tipos de estudiante',
    hint: 'Nuevo, continuo, posgrado…',
  },
  {
    id: 'editorialStatuses',
    title: 'Estados',
    hint: 'Borrador, revisión, publicado…',
  },
  {
    id: 'cyclePeriods',
    title: 'Periodos',
    hint: 'Ciclos académicos para filtrar y vigencia de contenido.',
  },
]

type SimpleRow = {
  id: string
  name: string
  isActive: boolean
  subtitle?: string
  locked?: boolean
}

type EditorialRow = SimpleRow & {
  showInFilter: boolean
  showInForm: boolean
}

type PeriodRow = SimpleRow & {
  startsOn: string | null
  endsOn: string | null
}

const ENDPOINTS: Record<CatalogTab, string> = {
  sections: '/api/admin/catalogs/sections',
  domains: '/api/admin/catalogs/domains',
  modalities: '/api/admin/catalogs/profile-types',
  studentTypes: '/api/admin/catalogs/student-types',
  editorialStatuses: '/api/admin/catalogs/editorial-statuses',
  cyclePeriods: '/api/admin/catalogs/cycle-periods',
}

/** Sustantivo singular para botones y diálogos de creación. */
const CREATE_NOUN: Record<CatalogTab, string> = {
  sections: 'sección',
  domains: 'área',
  modalities: 'modalidad',
  studentTypes: 'tipo de estudiante',
  editorialStatuses: 'estado',
  cyclePeriods: 'periodo',
}

const selectClass = 'rounded-md border border-chalk bg-white px-3 py-2 text-sm text-obsidian'

function formatDateShort(ymd: string) {
  return new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(ymd + 'T00:00:00'))
}

type CatalogTableColumns = {
  showDates: boolean
  showFilterColumn: boolean
}

function columnsForTab(tab: CatalogTab): CatalogTableColumns {
  return {
    showDates: tab === 'cyclePeriods',
    showFilterColumn: tab === 'editorialStatuses',
  }
}

export function AdminCatalogSettings() {
  const [tab, setTab] = useState<CatalogTab>('sections')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [migrationHint, setMigrationHint] = useState(false)

  const [sections, setSections] = useState<SimpleRow[]>([])
  const [domains, setDomains] = useState<SimpleRow[]>([])
  const [modalities, setModalities] = useState<SimpleRow[]>([])
  const [studentTypes, setStudentTypes] = useState<SimpleRow[]>([])
  const [editorialStatuses, setEditorialStatuses] = useState<EditorialRow[]>([])
  const [cyclePeriods, setCyclePeriods] = useState<PeriodRow[]>([])

  const [newName, setNewName] = useState('')
  const [newHint, setNewHint] = useState('')
  const [newStartsOn, setNewStartsOn] = useState('')
  const [newEndsOn, setNewEndsOn] = useState('')
  const [newIsVisible, setNewIsVisible] = useState(true)
  const [newShowInFilter, setNewShowInFilter] = useState(true)
  const [listQuery, setListQuery] = useState('')
  const [listStatus, setListStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const newNameInputRef = useRef<HTMLInputElement | null>(null)

  const notify = (text: string, isError = false) => {
    if (isError) {
      setError(text)
      setMessage(null)
    } else {
      setMessage(text)
      setError(null)
    }
  }

  const loadTab = useCallback(async (target: CatalogTab) => {
    const res = await fetch(ENDPOINTS[target])
    const body = await res.json()
    if (!res.ok) {
      if (
        typeof body.error === 'string' &&
        (body.error.includes('advisor_section_catalog') ||
          body.error.includes('editorial_status_catalog') ||
          body.error.includes('does not exist'))
      ) {
        setMigrationHint(true)
      }
      throw new Error(body.error ?? 'No se pudieron cargar los datos. Intente de nuevo.')
    }
    setMigrationHint(false)

    if (target === 'sections') {
      setSections(
        (body.sections ?? []).map(
          (s: { code: string; name: string; isActive: boolean; isSystem?: boolean }) => ({
            id: s.code,
            name: s.name,
            isActive: s.isActive,
            locked: s.isSystem,
          }),
        ),
      )
    }
    if (target === 'domains') {
      setDomains(
        (body.domains ?? []).map((d: { id: string; name: string; isActive: boolean }) => ({
          id: d.id,
          name: d.name,
          isActive: d.isActive,
        })),
      )
    }
    if (target === 'modalities') {
      setModalities(
        (body.profileTypes ?? []).map((m: { id: string; name: string; isActive: boolean }) => ({
          id: m.id,
          name: m.name,
          isActive: m.isActive,
        })),
      )
    }
    if (target === 'studentTypes') {
      setStudentTypes(
        (body.studentTypes ?? []).map((st: { id: string; name: string; isActive: boolean }) => ({
          id: st.id,
          name: st.name,
          isActive: st.isActive,
        })),
      )
    }
    if (target === 'editorialStatuses') {
      setEditorialStatuses(
        (body.editorialStatuses ?? []).map(
          (s: {
            code: string
            name: string
            isActive: boolean
            showInFilter: boolean
            showInForm: boolean
            isSystem?: boolean
          }) => ({
            id: s.code,
            name: s.name,
            isActive: s.isActive,
            showInFilter: s.showInFilter,
            showInForm: s.showInForm,
            locked: s.isSystem,
          }),
        ),
      )
    }
    if (target === 'cyclePeriods') {
      setCyclePeriods(
        (body.cyclePeriods ?? []).map(
          (p: {
            id: string
            name: string
            isActive: boolean
            startsOn: string | null
            endsOn: string | null
          }) => ({
            id: p.id,
            name: p.name,
            isActive: p.isActive,
            startsOn: p.startsOn,
            endsOn: p.endsOn,
            subtitle: [p.startsOn, p.endsOn].filter(Boolean).join(' → ') || undefined,
          }),
        ),
      )
    }
  }, [])

  const loadAll = useCallback(async () => {
    try {
      await Promise.all(TABS.map((t) => loadTab(t.id)))
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Error', true)
    }
  }, [loadTab])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const resetCreateForm = useCallback(() => {
    setNewName('')
    setNewHint('')
    setNewStartsOn('')
    setNewEndsOn('')
    setNewIsVisible(true)
    setNewShowInFilter(true)
  }, [])

  useEffect(() => {
    resetCreateForm()
    setListQuery('')
    setListStatus('all')
    setCreateOpen(false)
    setExpandedIds(new Set())
  }, [tab, resetCreateForm])

  useEffect(() => {
    if (!createOpen) return
    const id = window.setTimeout(() => newNameInputRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [createOpen])

  const postJson = async (url: string, body: Record<string, unknown>) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Error')
    return data
  }

  const patchJson = async (url: string, body: Record<string, unknown>) => {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Error')
    return data
  }

  const activeMeta = TABS.find((t) => t.id === tab)!
  const tableColumns = columnsForTab(tab)

  const rows: SimpleRow[] | EditorialRow[] | PeriodRow[] =
    tab === 'sections'
      ? sections
      : tab === 'domains'
        ? domains
        : tab === 'modalities'
          ? modalities
          : tab === 'studentTypes'
            ? studentTypes
            : tab === 'editorialStatuses'
              ? editorialStatuses
              : cyclePeriods
  const normalizedQuery = listQuery.trim().toLowerCase()
  const filteredRows = rows.filter((row) => {
    const matchesQuery =
      normalizedQuery.length === 0 ||
      row.name.toLowerCase().includes(normalizedQuery) ||
      row.id.toLowerCase().includes(normalizedQuery)
    const matchesStatus =
      listStatus === 'all' ||
      (listStatus === 'active' && row.isActive) ||
      (listStatus === 'inactive' && !row.isActive)
    return matchesQuery && matchesStatus
  })
  const hasListFilters = normalizedQuery.length > 0 || listStatus !== 'all'

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCreate = async () => {
    try {
      const url = ENDPOINTS[tab]
      if (tab === 'sections') {
        await postJson(url, {
          name: newName,
          hint: newHint || undefined,
          isActive: newIsVisible,
        })
      } else if (tab === 'editorialStatuses') {
        await postJson(url, {
          name: newName,
          showInFilter: newShowInFilter,
          isActive: newIsVisible,
        })
      } else if (tab === 'cyclePeriods') {
        await postJson(url, {
          name: newName,
          startsOn: newStartsOn || null,
          endsOn: newEndsOn || null,
          isActive: newIsVisible,
        })
      } else {
        await postJson(url, { name: newName, isActive: newIsVisible })
      }
      notify('Registro creado.')
      resetCreateForm()
      setCreateOpen(false)
      await loadTab(tab)
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Error', true)
    }
  }

  const colspan =
    1 + 1 + (tableColumns.showDates ? 2 : 0) + (tableColumns.showFilterColumn ? 1 : 0) + 1 + 1

  return (
    <div className="space-y-6">
      {migrationHint ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Algunos catálogos aún no están disponibles. Pida al equipo técnico completar su activación.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-obsidian">{activeMeta.title}</h3>
          <p className="mt-1 text-sm text-gravel">{activeMeta.hint}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setCreateOpen(true)}>
            Agregar {CREATE_NOUN[tab]}
          </Button>
          <Button type="button" variant="ghost" onClick={() => void loadTab(tab)}>
            Actualizar
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-chalk pb-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'px-3 py-2 text-sm font-medium transition-colors',
              tab === t.id
                ? 'border-b-2 border-obsidian text-obsidian'
                : 'text-gravel hover:text-obsidian',
            )}
          >
            {t.title}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-chalk bg-white p-3">
        <p className="text-xs font-medium text-gravel">Filtrar listado</p>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Buscar por nombre o código…"
            value={listQuery}
            onChange={(e) => setListQuery(e.target.value)}
            className="min-w-[200px] flex-1"
          />
          <select
            value={listStatus}
            onChange={(e) => setListStatus(e.target.value as 'all' | 'active' | 'inactive')}
            className={selectClass}
            aria-label="Estado del registro"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Solo activos</option>
            <option value="inactive">Solo inactivos</option>
          </select>
          {hasListFilters ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setListQuery('')
                setListStatus('all')
              }}
            >
              Limpiar
            </Button>
          ) : null}
        </div>
      </div>

      {message ? (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</p>
      ) : null}
      {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) resetCreateForm()
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-obsidian">
              Crear {CREATE_NOUN[tab]}
            </DialogTitle>
            <DialogDescription className="text-gravel">
              Complete los datos para agregar un nuevo registro.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              void handleCreate()
            }}
          >
            <div className="space-y-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-obsidian">Nombre visible</label>
                <Input
                  placeholder="Ej: Primer semestre"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  ref={newNameInputRef}
                  required
                />
              </div>

              {tab === 'sections' ? (
                <div>
                  <label className="mb-2 block text-sm font-medium text-obsidian">
                    Descripción (opcional)
                  </label>
                  <Input
                    placeholder="Descripción breve"
                    value={newHint}
                    onChange={(e) => setNewHint(e.target.value)}
                  />
                </div>
              ) : null}

              {tab === 'cyclePeriods' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-obsidian">Inicio</label>
                    <Input
                      type="date"
                      value={newStartsOn}
                      onChange={(e) => setNewStartsOn(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-obsidian">Fin</label>
                    <Input
                      type="date"
                      value={newEndsOn}
                      onChange={(e) => setNewEndsOn(e.target.value)}
                    />
                  </div>
                </div>
              ) : null}

              {tab === 'editorialStatuses' ? (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-obsidian">Estado</label>
                    <select
                      value={newIsVisible ? 'active' : 'inactive'}
                      onChange={(e) => setNewIsVisible(e.target.value === 'active')}
                      className="h-10 w-full rounded-md border border-chalk bg-white px-3 text-sm text-obsidian"
                      aria-label="Estado del registro"
                    >
                      <option value="active">Activo</option>
                      <option value="inactive">Inactivo</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-obsidian">Estado en filtros</label>
                    <select
                      value={newShowInFilter ? 'active' : 'inactive'}
                      onChange={(e) => setNewShowInFilter(e.target.value === 'active')}
                      className="h-10 w-full rounded-md border border-chalk bg-white px-3 text-sm text-obsidian"
                      aria-label="Estado en filtros"
                    >
                      <option value="active">Filtro activo (se usa en la búsqueda)</option>
                      <option value="inactive">Filtro inactivo (no aparece para seleccionar)</option>
                    </select>
                  </div>
                </>
              ) : (
                <div>
                  <label className="mb-2 block text-sm font-medium text-obsidian">Estado</label>
                  <select
                    value={newIsVisible ? 'visible' : 'hidden'}
                    onChange={(e) => setNewIsVisible(e.target.value === 'visible')}
                    className="h-10 w-full rounded-md border border-chalk bg-white px-3 text-sm text-obsidian"
                    aria-label="Estado de visibilidad"
                  >
                    <option value="visible">Visible</option>
                    <option value="hidden">No visible</option>
                  </select>
                  <p className="mt-1 text-xs text-gravel">
                    Los registros no visibles quedan inactivos y no se usan en el asesor.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetCreateForm()
                  setCreateOpen(false)
                }}
              >
                Cancelar
              </Button>
              <Button type="submit">Crear {CREATE_NOUN[tab]}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {rows.length === 0 ? (
        <p className="text-sm text-gravel">No hay registros.</p>
      ) : filteredRows.length === 0 ? (
        <p className="text-sm text-gravel">No hay resultados con los filtros aplicados.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-chalk bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-chalk bg-chalk/50 text-xs text-gravel">
              <tr>
                <th className="w-8 px-3 py-2" />
                <th className="px-3 py-2">Nombre</th>
                {tableColumns.showFilterColumn ? (
                  <th className="px-3 py-2">Filtros</th>
                ) : null}
                {tableColumns.showDates ? (
                  <>
                    <th className="px-3 py-2">Inicio</th>
                    <th className="px-3 py-2">Fin</th>
                  </>
                ) : null}
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <CatalogTableRow
                  key={row.id}
                  row={row}
                  tab={tab}
                  columns={tableColumns}
                  colspan={colspan}
                  isExpanded={expandedIds.has(row.id)}
                  onToggleExpand={() => toggleExpand(row.id)}
                  onPatch={async (patch) => {
                    const body =
                      tab === 'sections' || tab === 'editorialStatuses'
                        ? { code: row.id, ...patch }
                        : { id: row.id, ...patch }
                    await patchJson(ENDPOINTS[tab], body)
                    await loadTab(tab)
                  }}
                  onNotify={notify}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function CatalogTableRow({
  row,
  tab,
  columns,
  colspan,
  isExpanded,
  onToggleExpand,
  onPatch,
  onNotify,
}: {
  row: SimpleRow & Partial<EditorialRow> & Partial<PeriodRow>
  tab: CatalogTab
  columns: CatalogTableColumns
  colspan: number
  isExpanded: boolean
  onToggleExpand: () => void
  onPatch: (patch: Record<string, unknown>) => Promise<void>
  onNotify: (text: string, isError?: boolean) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(row.name)
  const [editStarts, setEditStarts] = useState(row.startsOn ?? '')
  const [editEnds, setEditEnds] = useState(row.endsOn ?? '')

  useEffect(() => {
    if (!editing) {
      setEditName(row.name)
      setEditStarts(row.startsOn ?? '')
      setEditEnds(row.endsOn ?? '')
    }
  }, [row.name, row.startsOn, row.endsOn, editing])

  const editorial = row as EditorialRow
  const period = row as PeriodRow

  return (
    <Fragment>
      <tr
        className="cursor-pointer border-b border-chalk align-top last:border-0 hover:bg-chalk/30"
        onClick={() => {
          if (!editing) onToggleExpand()
        }}
      >
        <td className="px-3 py-2 text-gravel">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </td>
        <td className="max-w-[280px] px-3 py-2">
          {editing ? (
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <p
              className={cn(
                'line-clamp-2 font-medium text-obsidian',
                !row.isActive && 'text-gravel line-through',
              )}
            >
              {row.name}
            </p>
          )}
        </td>
        {columns.showFilterColumn ? (
          <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
            <select
              value={editorial.showInFilter ? 'active' : 'inactive'}
              disabled={row.locked}
              onChange={(e) => {
                const showInFilter = e.target.value === 'active'
                void onPatch({ showInFilter })
                  .then(() =>
                    onNotify(showInFilter ? 'Filtro activado' : 'Filtro desactivado'),
                  )
                  .catch((err) =>
                    onNotify(err instanceof Error ? err.message : 'Error', true),
                  )
              }}
              className={cn(selectClass, 'h-8 min-w-[9rem] px-2 text-xs')}
              aria-label="Estado en filtros"
            >
              <option value="active">En filtros</option>
              <option value="inactive">Oculto en filtros</option>
            </select>
          </td>
        ) : null}
        {columns.showDates ? (
          <>
            <td className="whitespace-nowrap px-3 py-2 text-xs text-gravel">
              {editing ? (
                <Input
                  type="date"
                  value={editStarts}
                  onChange={(e) => setEditStarts(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : period.startsOn ? (
                formatDateShort(period.startsOn)
              ) : (
                '—'
              )}
            </td>
            <td className="whitespace-nowrap px-3 py-2 text-xs text-gravel">
              {editing ? (
                <Input
                  type="date"
                  value={editEnds}
                  onChange={(e) => setEditEnds(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : period.endsOn ? (
                formatDateShort(period.endsOn)
              ) : (
                '—'
              )}
            </td>
          </>
        ) : null}
        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
          <select
            value={row.isActive ? 'active' : 'inactive'}
            disabled={row.locked}
            onChange={(e) => {
              const isActive = e.target.value === 'active'
              void onPatch({ isActive })
                .then(() => onNotify(isActive ? 'Activado' : 'Desactivado'))
                .catch((err) => onNotify(err instanceof Error ? err.message : 'Error', true))
            }}
            className={cn(selectClass, 'h-8 min-w-[7.5rem] px-2 text-xs')}
            aria-label="Estado del registro"
          >
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
        </td>
        <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-end gap-3">
            {editing ? (
              <>
                <button
                  type="button"
                  className="text-obsidian underline"
                  onClick={() => {
                    setEditing(false)
                    setEditName(row.name)
                    setEditStarts(row.startsOn ?? '')
                    setEditEnds(row.endsOn ?? '')
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="text-obsidian underline"
                  onClick={() =>
                    void onPatch({
                      name: editName,
                      ...(columns.showDates
                        ? {
                            startsOn: editStarts || null,
                            endsOn: editEnds || null,
                          }
                        : {}),
                    })
                      .then(() => {
                        setEditing(false)
                        onNotify('Actualizado')
                      })
                      .catch((err) =>
                        onNotify(err instanceof Error ? err.message : 'Error', true),
                      )
                  }
                >
                  Guardar
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="text-obsidian underline"
                  onClick={() => {
                    setEditing(true)
                    if (!isExpanded) onToggleExpand()
                  }}
                >
                  Editar
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
      {isExpanded ? (
        <tr className="border-b border-chalk bg-chalk/20">
          <td />
          <td colSpan={colspan - 1} className="px-3 pb-3 pt-2">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gravel">
              <span>
                <span className="font-medium text-obsidian">Código:</span> {row.id}
              </span>
              {row.locked ? (
                <span className="italic">Registro del sistema — no se puede eliminar</span>
              ) : null}
              {columns.showFilterColumn ? (
                <>
                  <span>
                    <span className="font-medium text-obsidian">Al editar entradas:</span>{' '}
                    {editorial.showInForm ? 'Sí' : 'No'}
                  </span>
                  <span>
                    <span className="font-medium text-obsidian">En búsqueda:</span>{' '}
                    {editorial.showInFilter ? 'Sí' : 'No'}
                  </span>
                </>
              ) : null}
              {tab === 'sections' && row.subtitle ? (
                <span>
                  <span className="font-medium text-obsidian">Descripción:</span> {row.subtitle}
                </span>
              ) : null}
            </div>
          </td>
        </tr>
      ) : null}
    </Fragment>
  )
}
