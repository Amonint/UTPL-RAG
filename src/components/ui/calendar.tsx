'use client'

import {
  addDays,
  addMonths,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isEqual,
  isSameDay,
  isSameMonth,
  isToday,
  isValid,
  isWithinInterval,
  parse,
  startOfDay,
  startOfMonth,
  startOfWeek,
  sub,
  subDays,
  subHours,
  subMinutes,
  subMonths,
  subWeeks,
  subYears,
  type Duration,
} from 'date-fns'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { es } from 'date-fns/locale'
import clsx from 'clsx'
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  X,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { twMerge } from 'tailwind-merge'

import { Button } from '@/components/ui/button-1'
import { FieldInput as Input } from '@/components/ui/input-field'
import { Material } from '@/components/ui/material-1'
import { Select } from '@/components/ui/select-1'
import { useClickOutside } from '@/components/ui/use-click-outside'

export interface RangeValue {
  start: Date | null
  end: Date | null
}

export interface PresetValue {
  text: string
  start: Date
  end: Date
}

export type PresetMap = Record<string, PresetValue>

const DATE_DISPLAY_FORMAT = 'd MMM yyyy'
const TIME_DISPLAY_FORMAT = 'HH:mm'
const DATETIME_PARSE_FORMAT = 'd MMM yyyy HH:mm'

const WEEKDAY_HEADERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const

function normalizeRelativeUnit(raw: string): keyof Duration | null {
  const unit = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')

  if (unit.startsWith('dia') || unit === 'day') return 'days'
  if (unit.startsWith('semana') || unit === 'week') return 'weeks'
  if (unit.startsWith('mes') || unit === 'month') return 'months'
  if (unit.startsWith('ano') || unit.startsWith('year')) return 'years'
  if (unit.startsWith('hora') || unit === 'hour') return 'hours'
  if (unit.startsWith('minut')) return 'minutes'
  return null
}

function parseRelativeDate(input: string): PresetMap | null {
  const regex = /(\d+)\s*(d[ií]a|semana|mes|a[nñ]o|hora|minuto|day|week|month|year|hour|minute)s?/i
  const match = input.match(regex)

  if (!match) {
    return null
  }

  const value = parseInt(match[1], 10)
  const unitKey = normalizeRelativeUnit(match[2])
  if (!unitKey || Number.isNaN(value)) {
    return null
  }

  const now = new Date()
  const duration: Duration = { [unitKey]: value }
  const start = startOfDay(sub(now, duration))
  const end = endOfDay(now)

  return {
    [input]: { text: input, start, end },
  }
}

function parseExactDate(input: string): PresetMap | null {
  const now = new Date()
  const currentYear = now.getFullYear()
  const dateFormats = [DATE_DISPLAY_FORMAT, 'd MMM', 'yyyy-MM-dd', 'd/M/yyyy', 'd/M']

  for (const dateFormat of dateFormats) {
    const date = parse(input.trim(), dateFormat, now, { locale: es })

    if (isValid(date)) {
      if (dateFormat === 'd MMM' || dateFormat === 'd/M') {
        date.setFullYear(currentYear)
      }

      return {
        [input]: {
          text: input,
          start: startOfDay(date),
          end: endOfDay(date),
        },
      }
    }
  }

  return null
}

function parseFixedRange(input: string): PresetMap | null {
  const rangePattern = /(.+)\s*[-–]\s*(.+)/
  const match = input.match(rangePattern)

  if (!match) {
    return parseExactDate(input)
  }

  const [, startStr, endStr] = match
  if (!startStr || !endStr) {
    return null
  }

  const possibleFormats = [DATE_DISPLAY_FORMAT, 'd MMM', 'yyyy-MM-dd', 'd/M/yyyy', 'd/M']
  const now = new Date()
  const year = now.getFullYear()

  for (const dateFormat of possibleFormats) {
    const start = parse(startStr.trim(), dateFormat, now, { locale: es })
    const end = parse(endStr.trim(), dateFormat, now, { locale: es })

    const finalStart = isValid(start) ? startOfDay(start) : null
    const finalEnd = isValid(end) ? endOfDay(end) : null

    if (finalStart && finalEnd) {
      if (dateFormat === 'd MMM' || dateFormat === 'd/M') {
        finalStart.setFullYear(year)
        finalEnd.setFullYear(year)
      }
      return {
        [input]: { text: input, start: finalStart, end: finalEnd },
      }
    }
  }

  return null
}

function parseDateInput(input: string): PresetMap | null {
  const relative = parseRelativeDate(input)
  if (relative) return relative

  const fixedRange = parseFixedRange(input)
  if (fixedRange) return fixedRange

  return parseExactDate(input)
}

function filterPresets(obj: PresetMap, search: string): PresetMap {
  if (!search) {
    return obj
  }

  const searchWords = search.toLowerCase().split('-').filter(Boolean)

  const filtered = Object.fromEntries(
    Object.entries(obj).filter(([, value]) => {
      const keyLower = value.text.toLowerCase()
      return searchWords.every((word) => keyLower.includes(word))
    }),
  )

  if (Object.keys(filtered).length > 0) {
    return filtered
  }

  const parsed = parseDateInput(search)
  if (parsed) {
    return parsed
  }

  const numberMatch = search.match(/\d+/)
  if (!numberMatch) {
    return {}
  }

  const n = parseInt(numberMatch[0], 10)
  const now = new Date()

  return {
    [`last-${n}-days`]: {
      text: `Últimos ${n} días`,
      start: startOfDay(subDays(now, n)),
      end: endOfDay(now),
    },
    [`last-${n}-weeks`]: {
      text: `Últimas ${n} semanas`,
      start: startOfDay(subWeeks(now, n)),
      end: endOfDay(now),
    },
    [`last-${n}-months`]: {
      text: `Últimos ${n} meses`,
      start: startOfDay(subMonths(now, n)),
      end: endOfDay(now),
    },
    [`last-${n}-years`]: {
      text: `Últimos ${n} años`,
      start: startOfDay(subYears(now, n)),
      end: endOfDay(now),
    },
  }
}

function formatDateRange(start: Date, end: Date, timezone: string) {
  const isStartMidnight = isEqual(start, startOfDay(start))
  const isEndEOD = isEqual(end, endOfDay(end))
  const sameDay = isSameDay(start, end)

  const formatSingle = (date: Date) =>
    formatInTimeZone(
      date,
      timezone,
      isStartMidnight ? 'EEE, d MMM' : 'EEE, d MMM, HH:mm',
      { locale: es },
    )

  const formatMonth = (date: Date) => formatInTimeZone(date, timezone, 'MMM', { locale: es })
  const formatDay = (date: Date) => formatInTimeZone(date, timezone, 'd', { locale: es })
  const formatYear = (date: Date) => formatInTimeZone(date, timezone, 'yy', { locale: es })

  const formatDateWithTimeIfNeeded = (date: Date, showTime: boolean) =>
    formatInTimeZone(date, timezone, showTime ? 'd MMM, HH:mm' : 'd MMM', { locale: es })

  if (sameDay) {
    return formatSingle(start)
  }

  const sameMonth =
    formatMonth(start) === formatMonth(end) && formatYear(start) === formatYear(end)
  const sameYear = formatYear(start) === formatYear(end)

  const startHasTime = !isStartMidnight
  const endHasTime = !isEndEOD

  if (startHasTime || endHasTime) {
    const startFormatted = formatDateWithTimeIfNeeded(start, startHasTime)
    const endFormatted = formatDateWithTimeIfNeeded(end, endHasTime)
    return `${startFormatted} - ${endFormatted}`
  }

  if (sameMonth) {
    return `${formatMonth(start)} ${formatDay(start)} - ${formatDay(end)}`
  }

  if (sameYear) {
    return `${formatMonth(start)} ${formatDay(start)} - ${formatMonth(end)} ${formatDay(end)}`
  }

  return `${formatMonth(start)} ${formatDay(start)} '${formatYear(start)} - ${formatMonth(end)} ${formatDay(end)} '${formatYear(end)}`
}

const typeRelativeTimes: PresetValue[] = [
  {
    text: '45m',
    start: subMinutes(new Date(), 45),
    end: new Date(),
  },
  {
    text: '12 horas',
    start: subHours(new Date(), 12),
    end: new Date(),
  },
  {
    text: '10d',
    start: startOfDay(subDays(new Date(), 10)),
    end: endOfDay(new Date()),
  },
  {
    text: '2 semanas',
    start: startOfDay(subWeeks(new Date(), 2)),
    end: endOfDay(new Date()),
  },
  {
    text: 'mes pasado',
    start: startOfDay(subMonths(new Date(), 1)),
    end: endOfDay(new Date()),
  },
  {
    text: 'ayer',
    start: startOfDay(subDays(new Date(), 1)),
    end: endOfDay(subDays(new Date(), 1)),
  },
  {
    text: 'hoy',
    start: startOfDay(new Date()),
    end: endOfDay(new Date()),
  },
]

const typeFixedTimes: PresetValue[] = [
  {
    text: '1 ene',
    start: startOfDay(new Date(new Date().getFullYear(), 0, 1)),
    end: endOfDay(new Date(new Date().getFullYear(), 0, 1)),
  },
  {
    text: '1 ene - 2 ene',
    start: startOfDay(new Date(new Date().getFullYear(), 0, 1)),
    end: endOfDay(new Date(new Date().getFullYear(), 0, 2)),
  },
  {
    text: '1/1',
    start: startOfDay(new Date(new Date().getFullYear(), 0, 1)),
    end: endOfDay(new Date(new Date().getFullYear(), 0, 1)),
  },
  {
    text: '1/1 - 1/2',
    start: startOfDay(new Date(new Date().getFullYear(), 0, 1)),
    end: endOfDay(new Date(new Date().getFullYear(), 0, 2)),
  },
]

interface CalendarComboboxProps {
  stacked: boolean
  compact: boolean
  value: RangeValue | null
  onChange: (date: RangeValue | null) => void
  presets: PresetMap
  presetIndex?: number
  periodPlaceholder: string
}

function CalendarCombobox({
  stacked,
  compact,
  value,
  onChange,
  presets,
  presetIndex,
  periodPlaceholder,
}: CalendarComboboxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [currentPreset, setCurrentPreset] = useState<PresetValue | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const closeMenu = useCallback(() => setIsOpen(false), [])
  useClickOutside(ref, closeMenu)

  const onFocus = () => {
    setIsOpen(true)
  }

  const onChangeInputValue = (next: string) => {
    setInputValue(next)
  }

  const onClickPreset = (preset: PresetValue) => {
    setInputValue(preset.text)
    setCurrentPreset(preset)
    onChange({ start: preset.start, end: preset.end })
    setIsOpen(false)
  }

  const filteredPresets = filterPresets(presets, inputValue)

  useEffect(() => {
    const entries = Object.entries(presets)
    if (presetIndex === undefined || presetIndex < 0 || presetIndex >= entries.length) {
      return
    }
    const [, preset] = entries[presetIndex]
    setInputValue(preset.text)
    setCurrentPreset(preset)
    onChange({ start: preset.start, end: preset.end })
  }, [presetIndex, presets, onChange])

  useEffect(() => {
    if (!currentPreset || !value) {
      return
    }
    if (currentPreset.start !== value.start || currentPreset.end !== value.end) {
      setCurrentPreset(null)
      setInputValue('')
    }
  }, [value, currentPreset])

  const presetMatchesValue =
    currentPreset &&
    value &&
    currentPreset.start === value.start &&
    currentPreset.end === value.end

  return (
    <div
      ref={ref}
      className={twMerge(
        clsx(
          'inline-block font-sans text-sm',
          compact ? 'absolute left-[38px] w-[180px]' : 'relative w-[250px]',
          compact && !isOpen && 'pl-[140px]',
          compact && (isOpen || presetMatchesValue) && 'pl-0',
        ),
      )}
    >
      <Input
        prefix={compact ? undefined : <Clock className="h-4 w-4 text-gray-1000" />}
        prefixStyling="pl-2.5"
        suffix={
          <ChevronDown
            className={clsx('h-4 w-4 text-gray-1000 duration-200', isOpen && 'rotate-180')}
          />
        }
        suffixStyling={clsx(
          'cursor-pointer',
          compact &&
            !isOpen &&
            !presetMatchesValue &&
            'w-10 !px-0',
        )}
        placeholder={periodPlaceholder}
        onFocus={onFocus}
        value={inputValue}
        onChange={onChangeInputValue}
        wrapperClassName={clsx(
          'hover:z-10',
          stacked && !compact && 'rounded-b-none',
          !stacked && !compact && 'rounded-r-none',
          compact && 'rounded-l-none',
          (isOpen || (compact && presetMatchesValue)) && 'z-10',
        )}
        className={clsx(
          'pl-2 placeholder:!text-gray-1000 placeholder:!opacity-100',
          compact && !isOpen && !presetMatchesValue && '!w-0 !px-0',
        )}
      />
      <Material
        type="menu"
        className={clsx(
          'absolute left-0 top-12 z-50',
          compact ? 'w-full' : 'grid w-[200%] grid-cols-2',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0 duration-200',
        )}
      >
        <ul className="border-r border-r-gray-200 p-2">
          {Object.entries(filteredPresets).length > 0 ? (
            Object.entries(filteredPresets).map(([key, preset]) => (
              <li key={key}>
                <button
                  type="button"
                  className="flex h-9 w-full cursor-pointer items-center rounded-md px-2 font-sans text-sm text-gray-1000 hover:bg-gray-alpha-300 active:bg-gray-alpha-300"
                  onClick={() => onClickPreset(preset)}
                >
                  {preset.text}
                </button>
              </li>
            ))
          ) : (
            <li>
              <span className="flex h-9 w-full items-center px-2 font-sans text-sm text-gray-1000">
                {inputValue}
              </span>
            </li>
          )}
        </ul>
        {!compact && (
          <div className="p-4 pr-[30px]">
            <div className="font-sans text-sm text-gray-900">Escribir tiempos relativos</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {typeRelativeTimes.map((preset) => (
                <button
                  key={preset.text}
                  type="button"
                  className="inline-flex h-5 cursor-pointer items-center rounded border-none bg-accents-2 px-1.5 font-mono text-[13px] text-gray-1000"
                  onClick={() => onClickPreset(preset)}
                >
                  {preset.text}
                </button>
              ))}
            </div>
            <div className="mt-4 font-sans text-sm text-gray-900">Escribir fechas fijas</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {typeFixedTimes.map((preset) => (
                <button
                  key={preset.text}
                  type="button"
                  className="inline-flex h-5 cursor-pointer items-center rounded border-none bg-accents-2 px-1.5 font-mono text-[13px] text-gray-1000"
                  onClick={() => onClickPreset(preset)}
                >
                  {preset.text}
                </button>
              ))}
            </div>
          </div>
        )}
      </Material>
    </div>
  )
}

export interface CalendarProps {
  allowClear?: boolean
  compact?: boolean
  stacked?: boolean
  horizontalLayout?: boolean
  showTimeInput?: boolean
  popoverAlignment?: 'start' | 'center' | 'end'
  value: RangeValue | null
  onChange: (date: RangeValue | null) => void
  presets?: PresetMap
  presetIndex?: number
  minValue?: Date
  maxValue?: Date
  periodPlaceholder?: string
  dateRangePlaceholder?: string
  className?: string
}

export const Calendar = ({
  allowClear = false,
  compact = false,
  stacked = false,
  horizontalLayout = false,
  showTimeInput = true,
  popoverAlignment = 'start',
  value,
  onChange,
  presets,
  presetIndex,
  minValue,
  maxValue,
  periodPlaceholder = 'Seleccionar periodo',
  dateRangePlaceholder = 'Seleccionar fechas',
  className,
}: CalendarProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [hoverDate, setHoverDate] = useState<Date | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)

  const timezones = useMemo(
    () => [
      { value: 'UTC', label: 'UTC' },
      {
        value: Intl.DateTimeFormat().resolvedOptions().timeZone,
        label: `Local (${Intl.DateTimeFormat().resolvedOptions().timeZone})`,
      },
    ],
    [],
  )

  const [selectedTimezone, setSelectedTimezone] = useState(
    () => timezones[1]?.value ?? 'UTC',
  )

  const [startDate, setStartDate] = useState(() =>
    formatInTimeZone(value?.start ?? new Date(), selectedTimezone, DATE_DISPLAY_FORMAT, {
      locale: es,
    }),
  )
  const [startTime, setStartTime] = useState(() =>
    formatInTimeZone(value?.start ?? startOfDay(new Date()), selectedTimezone, TIME_DISPLAY_FORMAT, {
      locale: es,
    }),
  )
  const [endDate, setEndDate] = useState(() =>
    formatInTimeZone(value?.end ?? new Date(), selectedTimezone, DATE_DISPLAY_FORMAT, {
      locale: es,
    }),
  )
  const [endTime, setEndTime] = useState(() =>
    formatInTimeZone(value?.end ?? endOfDay(new Date()), selectedTimezone, TIME_DISPLAY_FORMAT, {
      locale: es,
    }),
  )

  const [startDateError, setStartDateError] = useState(false)
  const [startTimeError, setStartTimeError] = useState(false)
  const [endDateError, setEndDateError] = useState(false)
  const [endTimeError, setEndTimeError] = useState(false)

  const calendarRef = useRef<HTMLDivElement | null>(null)

  const closePopover = useCallback(() => setIsOpen(false), [])
  useClickOutside(calendarRef as RefObject<HTMLElement | null>, closePopover)

  useEffect(() => {
    const handleViewportChange = () => setIsOpen(false)
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)
    return () => {
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [])

  const daysArray = useMemo(() => {
    const result: Date[] = []
    let day = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 })
    const last = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 })
    while (day <= last) {
      result.push(day)
      day = addDays(day, 1)
    }
    return result
  }, [currentDate])

  const prevMonth = () => setCurrentDate((date) => subMonths(date, 1))
  const nextMonth = () => setCurrentDate((date) => addMonths(date, 1))

  const handleDateClick = (day: Date) => {
    if (!value?.start || (value.start && value.end)) {
      onChange({ start: startOfDay(day), end: null })
      setHoverDate(day)
      setIsSelecting(true)
      return
    }

    if (isSelecting) {
      if (day > value.start) {
        onChange({ ...value, end: endOfDay(day) })
      } else {
        onChange({ start: startOfDay(day), end: endOfDay(value.start) })
      }
      setIsSelecting(false)
      setHoverDate(null)
      setIsOpen(false)
    }
  }

  const handleMouseEnter = (day: Date) => {
    if (value?.start && !value.end) {
      setHoverDate(day)
    }
  }

  const onApply = () => {
    const parsedStartDate = parse(startDate, DATE_DISPLAY_FORMAT, new Date(), { locale: es })
    const parsedEndDate = parse(endDate, DATE_DISPLAY_FORMAT, new Date(), { locale: es })

    let parsedStart: Date
    let parsedEnd: Date

    if (showTimeInput) {
      const parsedStartTime = parse(startTime, TIME_DISPLAY_FORMAT, new Date(), { locale: es })
      const parsedEndTime = parse(endTime, TIME_DISPLAY_FORMAT, new Date(), { locale: es })

      if (
        !isValid(parsedStartDate) ||
        !isValid(parsedStartTime) ||
        !isValid(parsedEndDate) ||
        !isValid(parsedEndTime)
      ) {
        setStartDateError(!isValid(parsedStartDate))
        setStartTimeError(!isValid(parsedStartTime))
        setEndDateError(!isValid(parsedEndDate))
        setEndTimeError(!isValid(parsedEndTime))
        return
      }

      parsedStart = parse(`${startDate} ${startTime}`, DATETIME_PARSE_FORMAT, new Date(), {
        locale: es,
      })
      parsedEnd = parse(`${endDate} ${endTime}`, DATETIME_PARSE_FORMAT, new Date(), {
        locale: es,
      })
    } else {
      if (!isValid(parsedStartDate) || !isValid(parsedEndDate)) {
        setStartDateError(!isValid(parsedStartDate))
        setEndDateError(!isValid(parsedEndDate))
        return
      }

      parsedStart = startOfDay(parsedStartDate)
      parsedEnd = endOfDay(parsedEndDate)
    }

    if (!isValid(parsedStart) || !isValid(parsedEnd)) {
      setStartDateError(!isValid(parsedStart))
      setEndDateError(!isValid(parsedEnd))
      return
    }

    setStartDateError(false)
    setStartTimeError(false)
    setEndDateError(false)
    setEndTimeError(false)

    onChange({
      start: fromZonedTime(parsedStart, selectedTimezone),
      end: fromZonedTime(parsedEnd, selectedTimezone),
    })
    setIsOpen(false)
  }

  useEffect(() => {
    if (!isOpen) {
      return
    }
    setStartDate(
      formatInTimeZone(value?.start ?? new Date(), selectedTimezone, DATE_DISPLAY_FORMAT, {
        locale: es,
      }),
    )
    setStartTime(
      formatInTimeZone(value?.start ?? startOfDay(new Date()), selectedTimezone, TIME_DISPLAY_FORMAT, {
        locale: es,
      }),
    )
    setEndDate(
      formatInTimeZone(value?.end ?? new Date(), selectedTimezone, DATE_DISPLAY_FORMAT, {
        locale: es,
      }),
    )
    setEndTime(
      formatInTimeZone(value?.end ?? endOfDay(new Date()), selectedTimezone, TIME_DISPLAY_FORMAT, {
        locale: es,
      }),
    )
  }, [isOpen, value, selectedTimezone])

  const rangeLabel =
    value?.start && value?.end
      ? formatDateRange(value.start, value.end, selectedTimezone)
      : dateRangePlaceholder

  return (
    <div className={twMerge('relative', className)}>
      <div
        className={clsx(
          presets && 'flex',
          presets && stacked && 'flex-col',
          compact && 'w-[220px]',
        )}
      >
        {presets ? (
          <div>
            <CalendarCombobox
              stacked={stacked}
              compact={compact}
              presets={presets}
              value={value}
              onChange={onChange}
              presetIndex={presetIndex}
              periodPlaceholder={periodPlaceholder}
            />
          </div>
        ) : null}
        <div className="flex items-center justify-between">
          <div className="relative">
            <Button
              className={clsx(
                '!justify-start focus:!border-transparent focus:!shadow-focus-input',
                presets && !stacked && !compact && 'rounded-l-none -ml-px',
                presets && stacked && !compact && '-mt-px rounded-t-none',
                presets && compact && '-mr-px rounded-r-none',
                compact ? 'w-[180px] gap-1.5' : 'w-[250px]',
              )}
              prefix={<CalendarIcon className="h-4 w-4 shrink-0" />}
              type="secondary"
              onClick={() => setIsOpen((open) => !open)}
            >
              <div className="truncate pr-4">{rangeLabel}</div>
            </Button>
            {allowClear && value?.start && value?.end ? (
              <Button
                aria-label="Borrar rango de fechas"
                svgOnly
                variant="unstyled"
                className="absolute right-0 top-1/2 -translate-y-1/2 fill-gray-700 hover:fill-gray-1000"
                onClick={() => onChange(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      {isOpen ? (
        <Material
          ref={calendarRef}
          type="menu"
          className={twMerge(
            clsx(
              'absolute top-12 z-10 p-3 font-sans',
              horizontalLayout ? 'w-[462px]' : 'w-[280px]',
              presets && !stacked && !compact && 'left-[250px]',
              presets && stacked && 'top-[88px]',
              popoverAlignment === 'center' && 'left-[125px] -translate-x-1/2',
              popoverAlignment === 'end' && 'left-[250px] -translate-x-full',
            ),
          )}
        >
          <div className={clsx(horizontalLayout && 'flex gap-5')}>
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium capitalize text-gray-1000">
                  {formatInTimeZone(currentDate, selectedTimezone, 'MMMM yyyy', { locale: es })}
                </h2>
                <div className="flex gap-0.5">
                  <Button variant="unstyled" onClick={prevMonth} aria-label="Mes anterior">
                    <ChevronLeft className="h-4 w-4 text-gray-700" />
                  </Button>
                  <Button variant="unstyled" onClick={nextMonth} aria-label="Mes siguiente">
                    <ChevronRight className="h-4 w-4 text-gray-700" />
                  </Button>
                </div>
              </div>
              <div className="mb-2 grid grid-cols-7 text-center text-xs uppercase text-gray-900">
                {WEEKDAY_HEADERS.map((label) => (
                  <div key={label}>{label}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 items-center gap-y-2">
                {daysArray.map((day) => {
                  const isStart = value?.start && isSameDay(day, value.start)
                  const isEnd = value?.end && isSameDay(day, value.end)
                  const currentHover =
                    hoverDate && isSelecting && isSameDay(day, hoverDate)
                  const isInRange =
                    value?.start &&
                    ((value.end &&
                      isWithinInterval(day, { start: value.start, end: value.end })) ||
                      (hoverDate &&
                        isWithinInterval(day, { start: value.start, end: hoverDate })))
                  const isAllowedDate =
                    (minValue ? day >= startOfDay(minValue) : true) &&
                    (maxValue ? day <= endOfDay(maxValue) : true)

                  return (
                    <div
                      key={day.toISOString()}
                      className={clsx(
                        'flex items-center justify-center rounded text-center text-sm transition',
                        isSameMonth(day, currentDate) && isAllowedDate
                          ? 'bg-background-100 text-gray-1000'
                          : 'bg-background-100 text-gray-700',
                        isInRange && !isStart && !isEnd && !currentHover && '!rounded-none !bg-accents-2',
                        isAllowedDate ? 'cursor-pointer' : 'cursor-not-allowed',
                      )}
                      onMouseEnter={() => isAllowedDate && handleMouseEnter(day)}
                      onClick={() => isAllowedDate && handleDateClick(day)}
                    >
                      <div
                        className={clsx(
                          'flex h-8 w-8 items-center justify-center rounded',
                          (isStart || isEnd || currentHover) &&
                            isAllowedDate &&
                            '!bg-gray-1000 !text-background-100',
                          !isStart &&
                            !isEnd &&
                            !currentHover &&
                            !isToday(day) &&
                            isAllowedDate &&
                            'hover:border hover:border-gray-alpha-500 hover:text-gray-1000',
                          currentHover && isAllowedDate && '!shadow-focus-calendar-date',
                          isToday(day) && '!bg-blue-900 !text-background-100',
                        )}
                      >
                        {format(day, 'd', { locale: es })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div
              className={clsx(
                'flex flex-col gap-2',
                horizontalLayout
                  ? 'justify-between'
                  : '-mx-3 mt-3 border-t border-gray-alpha-100 px-3 pt-2.5',
              )}
            >
              <div className="flex flex-col gap-2">
                <div>
                  <div className="text-[13px] capitalize text-gray-900">Inicio</div>
                  <div className="mt-1 grid grid-cols-3 gap-2">
                    <div className={showTimeInput ? 'col-span-2' : 'col-span-3'}>
                      <Input
                        size="small"
                        value={startDate}
                        onChange={setStartDate}
                        error={startDateError}
                      />
                    </div>
                    {showTimeInput ? (
                      <Input
                        size="small"
                        value={startTime}
                        onChange={setStartTime}
                        error={startTimeError}
                      />
                    ) : null}
                  </div>
                </div>
                <div>
                  <div className="text-[13px] capitalize text-gray-900">Fin</div>
                  <div className="mt-1 grid grid-cols-3 gap-2">
                    <div className={showTimeInput ? 'col-span-2' : 'col-span-3'}>
                      <Input
                        size="small"
                        value={endDate}
                        onChange={setEndDate}
                        error={endDateError}
                      />
                    </div>
                    {showTimeInput ? (
                      <Input
                        size="small"
                        value={endTime}
                        onChange={setEndTime}
                        error={endTimeError}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex flex-col font-medium">
                  <Button
                    type="secondary"
                    size="small"
                    suffix={<span className="mt-1 text-xs">↵</span>}
                    onClick={onApply}
                  >
                    Aplicar
                  </Button>
                </div>
                <div className="w-fit self-center">
                  <Select
                    size="xsmall"
                    variant="ghost"
                    options={timezones}
                    value={selectedTimezone}
                    onChange={(event) => setSelectedTimezone(event.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </Material>
      ) : null}
    </div>
  )
}
