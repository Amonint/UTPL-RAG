"use client"

import { useCallback, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, Calendar, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

export type EventColor = "blue" | "green" | "purple" | "orange" | "pink" | "red"

export interface Event {
  id: string
  title: string
  description?: string
  startTime: Date
  endTime: Date
  color: EventColor
  category?: string
  tags?: string[]
}

export interface EventManagerProps {
  events?: Event[]
  readOnly?: boolean
  categories?: string[]
  colors?: { name: string; value: EventColor; bg: string; text: string }[]
  defaultView?: "month" | "list"
  className?: string
}

const defaultColors: { name: string; value: EventColor; bg: string; text: string }[] = [
  { name: "Blue", value: "blue", bg: "bg-blue-500", text: "text-blue-700" },
  { name: "Green", value: "green", bg: "bg-green-500", text: "text-green-700" },
  { name: "Purple", value: "purple", bg: "bg-purple-500", text: "text-purple-700" },
  { name: "Orange", value: "orange", bg: "bg-orange-500", text: "text-orange-700" },
  { name: "Pink", value: "pink", bg: "bg-pink-500", text: "text-pink-700" },
  { name: "Red", value: "red", bg: "bg-red-500", text: "text-red-700" },
]

function toLocalYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function eventOverlapsDay(event: Event, day: Date): boolean {
  const dayStr = toLocalYmd(day)
  const startStr = toLocalYmd(event.startTime)
  const endStr = toLocalYmd(event.endTime)
  return startStr <= dayStr && dayStr <= endStr
}

/** Un evento de varios días solo se lista el primer día de cada tramo continuo dentro de la grilla (evita repetir el mismo acto en todas las celdas). */
function eventStartsVisibleRunOnDay(event: Event, day: Date, dayIndex: number, gridDays: Date[]): boolean {
  if (!eventOverlapsDay(event, day)) return false
  if (dayIndex === 0) return true
  return !eventOverlapsDay(event, gridDays[dayIndex - 1]!)
}

/** Rango típico UTPL: 00:00 del día inicio → 23:59:59 del día fin (sin hora concreta de actividad). */
function isDayBasedAcademicBlock(start: Date, end: Date): boolean {
  if (start.getHours() !== 0 || start.getMinutes() !== 0 || start.getSeconds() !== 0) return false
  if (end.getHours() !== 23 || end.getMinutes() !== 59) return false
  return true
}

function formatEventScheduleForDialog(ev: Event): string {
  const { startTime: a, endTime: b } = ev
  const sameLocalDay = toLocalYmd(a) === toLocalYmd(b)
  const block = isDayBasedAcademicBlock(a, b)

  if (block && sameLocalDay) {
    return `${a.toLocaleDateString("es-EC", { dateStyle: "long" })} · Todo el día`
  }
  if (block && !sameLocalDay) {
    return `${a.toLocaleDateString("es-EC", { dateStyle: "long" })} — ${b.toLocaleDateString("es-EC", { dateStyle: "long" })} · Todo el día`
  }
  return `${a.toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" })} — ${b.toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" })}`
}

/** Una línea corta para listas: solo fechas de vigencia. */
function formatEventDateRangeCompact(ev: Event): string {
  const { startTime: a, endTime: b } = ev
  if (toLocalYmd(a) === toLocalYmd(b)) return a.toLocaleDateString("es-EC", { dateStyle: "medium" })
  return `${a.toLocaleDateString("es-EC", { dateStyle: "medium" })} — ${b.toLocaleDateString("es-EC", { dateStyle: "medium" })}`
}

function formatModalityForDialog(ev: Event): string {
  const m = ev.description?.trim() ?? ""
  if (!m || m === "Todas") {
    return "Todas las modalidades de estudio (presencial, en línea, posgrado, etc.), según el calendario oficial."
  }
  return m
}

export function EventManager({
  events: initialEvents = [],
  readOnly = false,
  categories = [],
  colors = defaultColors,
  defaultView = "month",
  className,
}: EventManagerProps) {
  const [events] = useState<Event[]>(initialEvents)
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [view, setView] = useState<"month" | "list">(readOnly ? "month" : defaultView)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matches =
          event.title.toLowerCase().includes(q) ||
          event.description?.toLowerCase().includes(q) ||
          event.category?.toLowerCase().includes(q) ||
          event.tags?.some((t) => t.toLowerCase().includes(q))
        if (!matches) return false
      }
      if (selectedCategories.length > 0 && event.category && !selectedCategories.includes(event.category)) {
        return false
      }
      return true
    })
  }, [events, searchQuery, selectedCategories])

  const navigateDate = useCallback(
    (direction: "prev" | "next") => {
      setCurrentDate((prev) => {
        const d = new Date(prev)
        d.setMonth(prev.getMonth() + (direction === "next" ? 1 : -1))
        return d
      })
    },
    [],
  )

  const getColorClasses = useCallback(
    (colorValue: string) => {
      return colors.find((c) => c.value === colorValue) ?? colors[0]!
    },
    [colors],
  )

  const monthTitle = currentDate.toLocaleDateString("es-EC", {
    month: "long",
    year: "numeric",
  })

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <h2 className="text-xl font-semibold capitalize sm:text-2xl">
            {view === "month" ? monthTitle : "Todos los eventos"}
          </h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigateDate("prev")} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
              Hoy
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigateDate("next")} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {!readOnly ? (
          <div className="flex gap-1 rounded-lg border bg-background p-1">
            <Button
              variant={view === "month" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("month")}
              className="h-8"
            >
              <Calendar className="h-4 w-4" />
              <span className="ml-1">Mes</span>
            </Button>
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("list")}
              className="h-8"
            >
              Lista
            </Button>
          </div>
        ) : null}
      </div>

      <div className="relative flex-1">
        <Input
          placeholder="Buscar actividades…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full border-chalk/55 shadow-none dark:border-white/10"
        />
      </div>

      {categories.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground">Categoría:</span>
          <Button
            variant={selectedCategories.length === 0 ? "secondary" : "outline"}
            size="sm"
            onClick={() => setSelectedCategories([])}
          >
            Todas
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategories.includes(cat) ? "secondary" : "outline"}
              size="sm"
              onClick={() =>
                setSelectedCategories((prev) =>
                  prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
                )
              }
            >
              {cat}
            </Button>
          ))}
        </div>
      ) : null}

      {view === "month" && (
        <MonthView
          currentDate={currentDate}
          events={filteredEvents}
          readOnly={readOnly}
          onEventClick={(event) => {
            setSelectedEvent(event)
            setIsDialogOpen(true)
          }}
          getColorClasses={getColorClasses}
        />
      )}

      {view === "list" && !readOnly && (
        <ListView events={filteredEvents} onEventClick={(e) => { setSelectedEvent(e); setIsDialogOpen(true) }} getColorClasses={getColorClasses} />
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="pr-6 text-base leading-snug sm:text-lg">{selectedEvent?.title}</DialogTitle>
            <DialogDescription className="text-left text-pretty">
              Origen: calendario académico publicado por la UTPL (cronograma de plazos y actividades del periodo). Las
              fechas no son una cita personal: indican en qué días aplica cada ítem en el calendario institucional.
            </DialogDescription>
          </DialogHeader>
          {selectedEvent ? (
            <div className="space-y-4 text-sm">
              <dl className="grid gap-3">
                <div className="space-y-1">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Categoría</dt>
                  <dd className="text-foreground">{selectedEvent.category?.trim() || "—"}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                    Vigencia en el calendario
                  </dt>
                  <dd className="text-foreground">{formatEventScheduleForDialog(selectedEvent)}</dd>
                  <dd className="text-xs leading-relaxed text-muted-foreground">
                    Es el rango de días en que la universidad marca el trámite o la actividad como vigente en el
                    cronograma; suele contar como día completo en cada fecha, no como hora de clase concreta.
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Modalidad (a quién aplica)
                  </dt>
                  <dd className="text-foreground">{formatModalityForDialog(selectedEvent)}</dd>
                </div>
              </dl>
              {selectedEvent.tags && selectedEvent.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {selectedEvent.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false)
                setSelectedEvent(null)
              }}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EventChip({
  event,
  readOnly,
  onEventClick,
  getColorClasses,
}: {
  event: Event
  readOnly: boolean
  onEventClick: (e: Event) => void
  getColorClasses: (c: string) => { bg: string; text: string }
}) {
  const colorClasses = getColorClasses(event.color)
  return (
    <button
      type="button"
      draggable={!readOnly}
      onClick={() => onEventClick(event)}
      className={cn(
        "w-full truncate rounded px-1.5 py-0.5 text-left text-xs font-medium text-white transition hover:opacity-90",
        colorClasses.bg,
      )}
    >
      {event.title}
    </button>
  )
}

function MonthView({
  currentDate,
  events,
  readOnly,
  onEventClick,
  getColorClasses,
}: {
  currentDate: Date
  events: Event[]
  readOnly: boolean
  onEventClick: (event: Event) => void
  getColorClasses: (c: string) => { bg: string; text: string }
}) {
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const startDate = new Date(firstDayOfMonth)
  startDate.setDate(startDate.getDate() - startDate.getDay())

  const days: Date[] = []
  const cur = new Date(startDate)
  for (let i = 0; i < 42; i++) {
    days.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }

  const getEventsForDay = (date: Date, dayIndex: number) =>
    events.filter((event) => eventStartsVisibleRunOnDay(event, date, dayIndex, days))

  const weekdayLabels = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"]

  return (
    <Card className="overflow-hidden border-chalk/65 bg-eggshell shadow-sm dark:border-white/10 dark:bg-zinc-950/80 dark:shadow-none">
      <div className="grid grid-cols-7 border-b border-chalk/55 dark:border-white/[0.08]">
        {weekdayLabels.map((day) => (
          <div
            key={day}
            className="border-r border-chalk/45 p-2 text-center text-xs font-medium capitalize text-muted-foreground last:border-r-0 sm:text-sm dark:border-white/[0.06]"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          const dayEvents = getEventsForDay(day, index)
          const isCurrentMonth = day.getMonth() === currentDate.getMonth()
          const isToday = toLocalYmd(day) === toLocalYmd(new Date())

          return (
            <div
              key={index}
              className={cn(
                "min-h-20 border-b border-r border-chalk/45 p-1 last:border-r-0 sm:min-h-24 sm:p-2 dark:border-white/[0.06]",
                !isCurrentMonth && "bg-chalk/25 dark:bg-white/[0.04]",
              )}
            >
              <div
                className={cn(
                  "mb-1 flex h-5 w-5 items-center justify-center rounded-full text-xs sm:h-6 sm:w-6 sm:text-sm",
                  isToday && "bg-primary font-semibold text-primary-foreground",
                )}
              >
                {day.getDate()}
              </div>
              <div className="flex max-h-24 flex-col gap-0.5 overflow-hidden sm:max-h-28">
                {dayEvents.slice(0, 4).map((event) => (
                  <EventChip
                    key={event.id}
                    event={event}
                    readOnly={readOnly}
                    onEventClick={onEventClick}
                    getColorClasses={getColorClasses}
                  />
                ))}
                {dayEvents.length > 4 ? (
                  <div className="text-[10px] text-muted-foreground sm:text-xs">+{dayEvents.length - 4} más</div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function ListView({
  events,
  onEventClick,
  getColorClasses,
}: {
  events: Event[]
  onEventClick: (event: Event) => void
  getColorClasses: (c: string) => { bg: string; text: string }
}) {
  const sorted = [...events].sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
  return (
    <Card className="p-4">
      <ul className="space-y-2">
        {sorted.map((event) => {
          const cc = getColorClasses(event.color)
          return (
            <li key={event.id}>
              <button
                type="button"
                onClick={() => onEventClick(event)}
                className="flex w-full items-start gap-2 rounded-lg border p-3 text-left hover:bg-muted/50"
              >
                <span className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", cc.bg)} />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{event.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {event.category ?? "—"} · Vigencia: {formatEventDateRangeCompact(event)}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
