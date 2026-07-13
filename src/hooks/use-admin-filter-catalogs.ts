'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  ACADEMIC_PERIOD_PRESETS,
  type AcademicPeriodPreset,
} from '@/lib/admin/academic-periods'
import {
  EDITORIAL_STATUS_FILTER_OPTIONS,
  EDITORIAL_STATUS_FORM_OPTIONS,
  SECTION_OPTIONS,
  labelEditorialStatus,
  labelSection,
  type EditorialStatusCode,
  type SectionCode,
} from '@/lib/admin/ui-labels'

export type FilterCatalogs = {
  sections: Array<{ code: string; name: string; hint?: string | null }>
  domains: Array<{ id: string; code: string; name: string }>
  profileTypes: Array<{ id: string; profileCode: string; typeCode: string; name: string }>
  studentTypes: Array<{ id: string; code: string; name: string }>
  editorialStatuses: Array<{ code: string; name: string; showInForm?: boolean }>
  cyclePeriods: Array<{
    id: string
    code: string
    name: string
    startsOn: string | null
    endsOn: string | null
  }>
}

const EMPTY: FilterCatalogs = {
  sections: [],
  domains: [],
  profileTypes: [],
  studentTypes: [],
  editorialStatuses: [],
  cyclePeriods: [],
}

export function cyclePeriodsToPresets(
  periods: FilterCatalogs['cyclePeriods'],
): AcademicPeriodPreset[] {
  const fromDb = periods
    .filter((p) => p.startsOn && p.endsOn)
    .map((p) => ({
      id: p.id,
      code: p.code,
      label: p.name,
      validFrom: p.startsOn!,
      validTo: p.endsOn!,
    }))
  if (fromDb.length > 0) return fromDb
  return ACADEMIC_PERIOD_PRESETS
}

export function resolveSectionOptions(sections: FilterCatalogs['sections']) {
  if (sections.length > 0) {
    return sections.map((s) => ({
      value: s.code,
      label: s.name,
      hint: s.hint ?? '',
    }))
  }
  return SECTION_OPTIONS.map((o) => ({ value: o.value, label: o.label, hint: o.hint }))
}

export function resolveEditorialFilterOptions(
  statuses: FilterCatalogs['editorialStatuses'],
): Array<{ code: string; label: string }> {
  if (statuses.length > 0) {
    return statuses.map((s) => ({ code: s.code, label: s.name }))
  }
  return EDITORIAL_STATUS_FILTER_OPTIONS.map((code) => ({
    code,
    label: labelEditorialStatus(code as EditorialStatusCode),
  }))
}

export function resolveEditorialFormOptions(
  statuses: FilterCatalogs['editorialStatuses'],
): Array<{ code: string; label: string }> {
  const list =
    statuses.length > 0
      ? statuses.filter((s) => s.showInForm !== false)
      : []
  if (list.length > 0) {
    return list.map((s) => ({ code: s.code, label: s.name }))
  }
  return EDITORIAL_STATUS_FORM_OPTIONS.map((code) => ({
    code,
    label: labelEditorialStatus(code as EditorialStatusCode),
  }))
}

export function labelSectionFromCatalog(
  code: string | null | undefined,
  sections: FilterCatalogs['sections'],
): string {
  if (!code) return '—'
  const hit = sections.find((s) => s.code === code)
  if (hit) return hit.name
  return labelSection(code as SectionCode)
}

export function findPeriodPresetById(
  id: string | null | undefined,
  periods: FilterCatalogs['cyclePeriods'],
): AcademicPeriodPreset | undefined {
  if (!id?.trim()) return undefined
  return cyclePeriodsToPresets(periods).find((p) => p.id === id)
}

export function useAdminFilterCatalogs() {
  const [catalogs, setCatalogs] = useState<FilterCatalogs>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/admin/catalogs')
    const body = await res.json()
    if (!res.ok) {
      setError(body.error ?? 'No se pudieron cargar los catálogos')
      setCatalogs(EMPTY)
    } else {
      setCatalogs({
        sections: body.sections ?? [],
        domains: body.domains ?? [],
        profileTypes: body.profileTypes ?? [],
        studentTypes: body.studentTypes ?? [],
        editorialStatuses: body.editorialStatuses ?? [],
        cyclePeriods: body.cyclePeriods ?? [],
      })
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const periodPresets = useMemo(
    () => cyclePeriodsToPresets(catalogs.cyclePeriods),
    [catalogs.cyclePeriods],
  )

  return { catalogs, loading, error, reload, periodPresets }
}
