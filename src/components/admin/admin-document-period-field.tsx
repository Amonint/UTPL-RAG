'use client'

import { useEffect, useMemo, useState } from 'react'

import { findPresetByDates } from '@/lib/admin/academic-periods'
import { useAdminFilterCatalogs } from '@/hooks/use-admin-filter-catalogs'
import { AdminSelect, DateRangePicker } from '@/components/ui/date-range-picker'
import { Input } from '@/components/ui/input'

const CUSTOM_PERIOD = '__custom__'

export function AdminDocumentPeriodField({
  periodLabel,
  validFrom,
  validTo,
  onPeriodLabelChange,
  onDatesChange,
}: {
  periodLabel: string
  validFrom: string | null
  validTo: string | null
  onPeriodLabelChange: (value: string) => void
  onDatesChange: (next: { start: string | null; end: string | null }) => void
}) {
  const { periodPresets } = useAdminFilterCatalogs()
  const matchedPreset = findPresetByDates(validFrom, validTo)
  const [periodSelect, setPeriodSelect] = useState(() =>
    matchedPreset?.id ?? (periodLabel ? CUSTOM_PERIOD : ''),
  )

  useEffect(() => {
    const matched = findPresetByDates(validFrom, validTo)
    setPeriodSelect(matched?.id ?? (periodLabel ? CUSTOM_PERIOD : ''))
  }, [validFrom, validTo, periodLabel])

  const periodOptions = useMemo(
    () => (
      <>
        <option value="">— Elegir periodo —</option>
        {periodPresets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.label}
          </option>
        ))}
        <option value={CUSTOM_PERIOD}>Otro periodo (escribir nombre)</option>
      </>
    ),
    [periodPresets],
  )

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-chalk bg-[#faf9f7] p-4">
      <div>
        <p className="text-sm font-medium text-obsidian">Fechas y periodo académico</p>
        <p className="mt-0.5 text-xs text-gravel">
          El periodo es el nombre institucional. Las fechas de vigencia indican desde cuándo hasta cuándo
          aplica esta información (puede coincidir con el periodo o ser otro rango).
        </p>
      </div>

      <AdminSelect
        label="Periodo académico"
        value={periodSelect}
        onChange={(id) => {
          setPeriodSelect(id)
          if (!id) {
            onPeriodLabelChange('')
            return
          }
          if (id === CUSTOM_PERIOD) {
            if (!periodLabel) onPeriodLabelChange('')
            return
          }
          const preset = periodPresets.find((p) => p.id === id)
          if (!preset) return
          onPeriodLabelChange(preset.label)
          onDatesChange({ start: preset.validFrom, end: preset.validTo })
        }}
      >
        {periodOptions}
      </AdminSelect>

      {periodSelect === CUSTOM_PERIOD ? (
        <div>
          <label className="mb-1 block text-xs font-medium text-gravel">Nombre del periodo</label>
          <Input
            value={periodLabel}
            onChange={(e) => onPeriodLabelChange(e.target.value)}
            placeholder="Ej. Abril – Agosto 2026"
          />
        </div>
      ) : null}

      <div>
        <label className="mb-1 block text-xs font-medium text-gravel">Fechas de vigencia</label>
        <DateRangePicker value={{ start: validFrom, end: validTo }} onChange={onDatesChange} />
        <p className="mt-1 text-xs text-gravel">Elija el rango en el calendario (inicio y fin).</p>
      </div>
    </div>
  )
}
