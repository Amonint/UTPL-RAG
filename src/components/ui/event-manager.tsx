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
          className="w-full"
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
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title}</DialogTitle>
            <DialogDescription>
              {selectedEvent?.category}
              {selectedEvent?.description ? ` · ${selectedEvent.description}` : ""}
            </DialogDescription>
          </DialogHeader>
          {selectedEvent ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  {selectedEvent.startTime.toLocaleString("es-EC", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}{" "}
                  —{" "}
                  {selectedEvent.endTime.toLocaleString("es-EC", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>
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

  const getEventsForDay = (date: Date) => events.filter((event) => eventOverlapsDay(event, date))

  const weekdayLabels = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"]

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b">
        {weekdayLabels.map((day) => (
          <div key={day} className="border-r p-2 text-center text-xs font-medium capitalize last:border-r-0 sm:text-sm">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          const dayEvents = getEventsForDay(day)
          const isCurrentMonth = day.getMonth() === currentDate.getMonth()
          const isToday = toLocalYmd(day) === toLocalYmd(new Date())

          return (
            <div
              key={index}
              className={cn(
                "min-h-20 border-b border-r p-1 last:border-r-0 sm:min-h-24 sm:p-2",
                !isCurrentMonth && "bg-muted/30",
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
                    {event.startTime.toLocaleDateString("es-EC")} — {event.category}
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
