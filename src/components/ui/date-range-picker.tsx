'use client'

import {
  addDays,
  addMonths,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

function fromIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = parseISO(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function toIsoDate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

function formatRangeLabel(start: string | null, end: string | null): string {
  const s = fromIsoDate(start)
  const e = fromIsoDate(end)
  if (!s && !e) return 'Elegir fechas'
  if (s && e) {
    return `${format(s, 'd MMM yyyy', { locale: es })} – ${format(e, 'd MMM yyyy', { locale: es })}`
  }
  if (s) return format(s, 'd MMM yyyy', { locale: es })
  return 'Elegir fechas'
}

const selectClassName =
  'w-full rounded-md border border-chalk bg-white px-3 py-2 text-sm text-obsidian'

export function AdminSelect({
  label,
  value,
  onChange,
  children,
  hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
  hint?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gravel">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClassName}>
        {children}
      </select>
      {hint ? <p className="mt-1 text-xs text-gravel">{hint}</p> : null}
    </div>
  )
}

export function DateRangePicker({
  value,
  onChange,
  className,
}: {
  value: { start: string | null; end: string | null }
  onChange: (next: { start: string | null; end: string | null }) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => fromIsoDate(value.start) ?? new Date())
  const [selecting, setSelecting] = useState<{ start: Date; end: Date | null } | null>(null)

  const range = useMemo(
    () => ({
      start: fromIsoDate(value.start),
      end: fromIsoDate(value.end),
    }),
    [value.end, value.start],
  )

  const active = selecting ?? range

  const days = useMemo(() => {
    const result: Date[] = []
    let day = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
    const last = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
    while (day <= last) {
      result.push(day)
      day = addDays(day, 1)
    }
    return result
  }, [month])

  const applyRange = (start: Date, end: Date) => {
    onChange({ start: toIsoDate(startOfDay(start)), end: toIsoDate(endOfDay(end)) })
    setSelecting(null)
    setOpen(false)
  }

  const onDayClick = (day: Date) => {
    if (!active.start || (active.start && active.end)) {
      setSelecting({ start: startOfDay(day), end: null })
      return
    }
    if (day >= active.start) {
      applyRange(active.start, day)
      return
    }
    applyRange(day, active.start)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn('w-full justify-start gap-2 font-normal text-obsidian', className)}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 text-gravel" />
          <span className="truncate">{formatRangeLabel(value.start, value.end)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] p-3">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium capitalize text-obsidian">
            {format(month, 'MMMM yyyy', { locale: es })}
          </span>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setMonth(subMonths(month, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setMonth(addMonths(month, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium uppercase text-gravel">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {days.map((day) => {
            const inMonth = isSameMonth(day, month)
            const isStart = active.start && isSameDay(day, active.start)
            const isEnd = active.end && isSameDay(day, active.end)
            const inRange =
              active.start &&
              active.end &&
              isWithinInterval(day, { start: active.start, end: active.end })

            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => onDayClick(day)}
                className={cn(
                  'mx-auto flex h-8 w-8 items-center justify-center rounded-md text-sm transition',
                  !inMonth && 'text-fog',
                  inMonth && 'text-obsidian hover:bg-powder',
                  inRange && !isStart && !isEnd && 'rounded-none bg-powder',
                  (isStart || isEnd) && 'bg-obsidian text-white',
                  isToday(day) && !isStart && !isEnd && 'ring-1 ring-obsidian/25',
                )}
              >
                {format(day, 'd')}
              </button>
            )
          })}
        </div>
        <div className="mt-3 flex justify-end gap-2 border-t border-chalk pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange({ start: null, end: null })
              setSelecting(null)
              setOpen(false)
            }}
          >
            Limpiar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
