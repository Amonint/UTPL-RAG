export type AcademicPeriodPreset = {
  id: string
  label: string
  validFrom: string
  validTo: string
  /** Código oficial UTPL cuando viene de BD (p. ej. 202630). */
  code?: string
}

/** Periodos académicos frecuentes (UTPL). Las fechas son inclusivas en vigencia del ítem. */
export const ACADEMIC_PERIOD_PRESETS: AcademicPeriodPreset[] = [
  {
    id: '2026-abr-ago',
    label: 'Abril – Agosto 2026',
    validFrom: '2026-04-01',
    validTo: '2026-08-31',
  },
  {
    id: '2026-sep-feb',
    label: 'Septiembre 2026 – Febrero 2027',
    validFrom: '2026-09-01',
    validTo: '2027-02-28',
  },
  {
    id: '2027-abr-ago',
    label: 'Abril – Agosto 2027',
    validFrom: '2027-04-01',
    validTo: '2027-08-31',
  },
]

export function findPresetByDates(
  validFrom: string | null | undefined,
  validTo: string | null | undefined,
): AcademicPeriodPreset | undefined {
  if (!validFrom || !validTo) return undefined
  return ACADEMIC_PERIOD_PRESETS.find((p) => p.validFrom === validFrom && p.validTo === validTo)
}

export function findPresetById(id: string | null | undefined): AcademicPeriodPreset | undefined {
  if (!id?.trim()) return undefined
  return ACADEMIC_PERIOD_PRESETS.find((p) => p.id === id)
}

export function findPresetByLabel(label: string | null | undefined): AcademicPeriodPreset | undefined {
  if (!label?.trim()) return undefined
  return ACADEMIC_PERIOD_PRESETS.find((p) => p.label === label.trim())
}

export function resolvePresetFromScope(scope: {
  periodLabel?: string
  periodValidFrom?: string
  periodValidTo?: string
}): AcademicPeriodPreset | undefined {
  return (
    findPresetByDates(scope.periodValidFrom, scope.periodValidTo) ??
    findPresetByLabel(scope.periodLabel)
  )
}
