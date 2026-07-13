'use client'

import { useEffect, useMemo, useState } from 'react'

import type { AcademicCalendarEventRecord } from '@/data/academic-calendar-events'
import { CALENDAR_EVENT_CATEGORIES, defaultCalendarEventCategory } from '@/lib/calendar/event-categories'
import type { CalendarEventScopeMeta } from '@/lib/calendar/event-scope-meta'
import {
  ACADEMIC_PERIOD_PRESETS,
  type AcademicPeriodPreset,
  resolvePresetFromScope,
} from '@/lib/admin/academic-periods'
import { labelModality } from '@/lib/admin/ui-labels'
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

type DomainRow = { code: string; name: string }
type ProfileTypeRow = { typeCode: string; name: string; profileCode: string }
type StudentTypeRow = { code: string; name: string }

export type CalendarEventDialogFilters = {
  domainCode: string
  profileTypeCode: string
  studentTypeCode: string
  periodSelect: string
}

type Props = {
  open: boolean
  mode: 'create' | 'edit'
  event: AcademicCalendarEventRecord | null
  initialScope: CalendarEventScopeMeta | null
  filters: CalendarEventDialogFilters
  domains: DomainRow[]
  profileTypes: ProfileTypeRow[]
  studentTypes: StudentTypeRow[]
  /** Mismos periodos que el filtro del listado (DB); fallback a presets fijos. */
  periodPresets?: AcademicPeriodPreset[]
  onClose: () => void
  onSaved: () => void
}

const selectClass = 'rounded-md border border-chalk bg-white px-3 py-2 text-sm text-obsidian w-full'

function findPeriodInList(
  periods: AcademicPeriodPreset[],
  id: string | null | undefined,
): AcademicPeriodPreset | undefined {
  if (!id?.trim()) return undefined
  return periods.find((p) => p.id === id)
}

export function AdminCalendarEventDialog({
  open,
  mode,
  event,
  initialScope,
  filters,
  domains,
  profileTypes,
  studentTypes,
  periodPresets,
  onClose,
  onSaved,
}: Props) {
  const [title, setTitle] = useState('')
  const [eventType, setEventType] = useState(defaultCalendarEventCategory())
  const [startsOn, setStartsOn] = useState('')
  const [endsOn, setEndsOn] = useState('')
  const [domainCode, setDomainCode] = useState('')
  const [profileTypeCode, setProfileTypeCode] = useState('')
  const [studentTypeCode, setStudentTypeCode] = useState('')
  const [periodSelect, setPeriodSelect] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const periods = useMemo(
    () => (periodPresets && periodPresets.length > 0 ? periodPresets : ACADEMIC_PERIOD_PRESETS),
    [periodPresets],
  )

  const studentModalities = useMemo(
    () => profileTypes.filter((p) => p.profileCode === 'student'),
    [profileTypes],
  )

  useEffect(() => {
    if (!open) return
    setError(null)

    if (mode === 'edit' && event) {
      setTitle(event.title)
      setEventType(event.category)
      setStartsOn(event.start)
      setEndsOn(event.end)
    } else {
      setTitle('')
      setEventType(defaultCalendarEventCategory())
      setStartsOn('')
      setEndsOn('')
    }

    const scope =
      mode === 'edit' && initialScope
        ? initialScope
        : {
            domainCode: filters.domainCode,
            profileTypeCode: filters.profileTypeCode,
            studentTypeCode: filters.studentTypeCode,
          }

    setDomainCode(scope.domainCode ?? filters.domainCode)
    setProfileTypeCode(scope.profileTypeCode ?? filters.profileTypeCode)
    setStudentTypeCode(scope.studentTypeCode ?? filters.studentTypeCode)
    const periodPreset =
      mode === 'edit' && initialScope
        ? periods.find(
            (p) =>
              (initialScope.periodValidFrom &&
                initialScope.periodValidTo &&
                p.validFrom === initialScope.periodValidFrom &&
                p.validTo === initialScope.periodValidTo) ||
              (initialScope.periodLabel && p.label === initialScope.periodLabel),
          ) ?? resolvePresetFromScope(initialScope)
        : findPeriodInList(periods, filters.periodSelect)
    setPeriodSelect(periodPreset?.id ?? '')
  }, [open, mode, event, initialScope, filters, periods])

  const selectedPeriod = findPeriodInList(periods, periodSelect)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const preset = findPeriodInList(periods, periodSelect)
    if (!preset) {
      setError('Elija un periodo del listado.')
      setSaving(false)
      return
    }

    const scope: CalendarEventScopeMeta = {
      domainCode: domainCode.trim(),
      profileTypeCode: profileTypeCode.trim(),
      studentTypeCode: studentTypeCode.trim(),
      periodLabel: preset.label,
      periodValidFrom: preset.validFrom,
      periodValidTo: preset.validTo,
      periodCode: preset.code,
      source: initialScope?.source ?? 'admin',
      /** Al guardar desde admin se publica (sale de revisión). */
      editorialStatus: 'published',
    }

    if (!scope.domainCode || !scope.profileTypeCode || !scope.studentTypeCode) {
      setError('Complete área, modalidad y tipo de estudiante.')
      setSaving(false)
      return
    }

    const payload = {
      title: title.trim(),
      eventType,
      startsOn,
      endsOn,
      scope,
    }

    try {
      const url =
        mode === 'edit' && event
          ? `/api/admin/calendar-events/${encodeURIComponent(String(event.id))}`
          : '/api/admin/calendar-events'
      const method = mode === 'edit' ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? 'No se pudo guardar')
        return
      }
      onSaved()
      onClose()
    } catch {
      setError('Error de red al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-5xl overflow-y-auto sm:w-full">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Agregar evento' : 'Editar evento'}</DialogTitle>
          <DialogDescription>
            Indique el alcance (área, modalidad, tipo de estudiante y periodo) y las fechas del
            evento en el calendario académico.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <fieldset className="space-y-2 rounded-md border border-chalk p-3">
            <legend className="px-1 text-xs font-medium text-gravel">Alcance</legend>
            <label className="block text-xs font-medium text-gravel">Área</label>
            <select
              className={selectClass}
              value={domainCode}
              onChange={(ev) => setDomainCode(ev.target.value)}
              required
            >
              <option value="">— Elegir área —</option>
              {domains.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.name}
                </option>
              ))}
            </select>

            <label className="block text-xs font-medium text-gravel">Modalidad</label>
            <select
              className={selectClass}
              value={profileTypeCode}
              onChange={(ev) => setProfileTypeCode(ev.target.value)}
              required
            >
              <option value="">— Elegir modalidad —</option>
              {studentModalities.map((m) => (
                <option key={m.typeCode} value={m.typeCode}>
                  {labelModality(m.typeCode, m.name)}
                </option>
              ))}
            </select>

            <label className="block text-xs font-medium text-gravel">Tipo de estudiante</label>
            <select
              className={selectClass}
              value={studentTypeCode}
              onChange={(ev) => setStudentTypeCode(ev.target.value)}
              required
            >
              <option value="">— Elegir tipo —</option>
              {studentTypes.map((st) => (
                <option key={st.code} value={st.code}>
                  {st.name}
                </option>
              ))}
            </select>

            <label className="block text-xs font-medium text-gravel">Periodo</label>
            <select
              className={selectClass}
              value={periodSelect}
              onChange={(ev) => setPeriodSelect(ev.target.value)}
              required
            >
              <option value="">— Elegir periodo —</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            {selectedPeriod ? (
              <p className="text-xs text-gravel">
                Vigencia del periodo: {selectedPeriod.validFrom} — {selectedPeriod.validTo}
              </p>
            ) : null}
          </fieldset>

          <fieldset className="space-y-2 rounded-md border border-chalk p-3">
            <legend className="px-1 text-xs font-medium text-gravel">Evento</legend>
            <Input
              placeholder="Título del evento"
              value={title}
              onChange={(ev) => setTitle(ev.target.value)}
              required
            />
            <label className="block text-xs font-medium text-gravel">Categoría</label>
            <select
              className={selectClass}
              value={eventType}
              onChange={(ev) => setEventType(ev.target.value)}
            >
              {CALENDAR_EVENT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gravel">Inicio</label>
                <Input
                  type="date"
                  value={startsOn}
                  onChange={(ev) => setStartsOn(ev.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gravel">Fin</label>
                <Input
                  type="date"
                  value={endsOn}
                  onChange={(ev) => setEndsOn(ev.target.value)}
                  required
                />
              </div>
            </div>
          </fieldset>

          {error ? <p className="text-sm text-red-700">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
