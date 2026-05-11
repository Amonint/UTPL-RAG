"use client"

import * as React from "react"
import {
  add,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  isEqual,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfToday,
  startOfWeek,
} from "date-fns"
import { es } from "date-fns/locale"
import { ChevronLeft, ChevronRight, PlusCircle, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useMediaQuery } from "@/hooks/use-media-query"

export interface FullscreenCalendarEvent {
  id: number
  name: string
  time: string
  datetime: string
}

export interface FullscreenCalendarDay {
  day: Date
  events: FullscreenCalendarEvent[]
}

export interface FullScreenCalendarProps {
  data: FullscreenCalendarDay[]
  /** Si es false, se oculta el botón de crear evento (p. ej. calendario solo lectura). */
  showNewEvent?: boolean
}

const colStartClasses = ["", "col-start-2", "col-start-3", "col-start-4", "col-start-5", "col-start-6", "col-start-7"]

export function FullScreenCalendar({ data, showNewEvent = true }: FullScreenCalendarProps) {
  const today = startOfToday()
  const [selectedDay, setSelectedDay] = React.useState(today)
  const [monthKey, setMonthKey] = React.useState(format(today, "yyyy-MM"))
  const firstDayCurrentMonth = parseISO(`${monthKey}-01T12:00:00`)
  const isDesktop = useMediaQuery("(min-width: 768px)")

  const days = eachDayOfInterval({
    start: startOfWeek(firstDayCurrentMonth, { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(firstDayCurrentMonth), { weekStartsOn: 0 }),
  })

  function previousMonth() {
    const d = add(firstDayCurrentMonth, { months: -1 })
    setMonthKey(format(d, "yyyy-MM"))
  }

  function nextMonth() {
    const d = add(firstDayCurrentMonth, { months: 1 })
    setMonthKey(format(d, "yyyy-MM"))
  }

  function goToToday() {
    setMonthKey(format(today, "yyyy-MM"))
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col space-y-4 p-4 md:flex-row md:items-center md:justify-between md:space-y-0 lg:flex-none">
        <div className="flex flex-auto">
          <div className="flex items-center gap-4">
            <div className="hidden w-20 flex-col items-center justify-center rounded-lg border bg-muted p-0.5 md:flex">
              <h1 className="p-1 text-xs uppercase text-muted-foreground">
                {format(today, "MMM", { locale: es })}
              </h1>
              <div className="flex w-full items-center justify-center rounded-lg border bg-background p-0.5 text-lg font-bold">
                <span>{format(today, "d")}</span>
              </div>
            </div>
            <div className="flex flex-col">
              <h2 className="text-lg font-semibold capitalize text-foreground">
                {format(firstDayCurrentMonth, "MMMM yyyy", { locale: es })}
              </h2>
              <p className="text-sm text-muted-foreground">
                {format(firstDayCurrentMonth, "d MMM yyyy", { locale: es })} —{" "}
                {format(endOfMonth(firstDayCurrentMonth), "d MMM yyyy", { locale: es })}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 md:flex-row md:gap-6">
          <Button variant="outline" size="icon" className="hidden lg:flex" type="button" aria-label="Buscar">
            <Search size={16} strokeWidth={2} aria-hidden="true" />
          </Button>

          <Separator orientation="vertical" className="hidden h-6 lg:block" />

          <div className="inline-flex w-full -space-x-px rounded-lg shadow-sm shadow-black/5 md:w-auto rtl:space-x-reverse">
            <Button
              type="button"
              onClick={previousMonth}
              className="rounded-none shadow-none first:rounded-s-lg last:rounded-e-lg focus-visible:z-10"
              variant="outline"
              size="icon"
              aria-label="Mes anterior"
            >
              <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
            </Button>
            <Button
              type="button"
              onClick={goToToday}
              className="w-full rounded-none shadow-none first:rounded-s-lg last:rounded-e-lg focus-visible:z-10 md:w-auto"
              variant="outline"
            >
              Hoy
            </Button>
            <Button
              type="button"
              onClick={nextMonth}
              className="rounded-none shadow-none first:rounded-s-lg last:rounded-e-lg focus-visible:z-10"
              variant="outline"
              size="icon"
              aria-label="Mes siguiente"
            >
              <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
            </Button>
          </div>

          <Separator orientation="vertical" className="hidden h-6 md:block" />
          <Separator orientation="horizontal" className="block w-full md:hidden" />

          {showNewEvent ? (
            <Button type="button" className="w-full gap-2 md:w-auto">
              <PlusCircle size={16} strokeWidth={2} aria-hidden="true" />
              <span>Nuevo evento</span>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="lg:flex lg:flex-auto lg:flex-col">
        <div className="grid grid-cols-7 border text-center text-xs font-semibold leading-6 capitalize lg:flex-none">
          {["dom", "lun", "mar", "mié", "jue", "vie", "sáb"].map((label, i) => (
            <div key={label} className={cn("py-2.5", i < 6 && "border-r")}>
              {label}
            </div>
          ))}
        </div>

        <div className="flex text-xs leading-6 lg:flex-auto">
          <div className="hidden w-full border-x lg:grid lg:grid-cols-7 lg:grid-rows-5">
            {days.map((day, dayIdx) =>
              !isDesktop ? (
                <button
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  key={`lg-sm-${format(day, "yyyy-MM-dd")}`}
                  className={cn(
                    isEqual(day, selectedDay) && "text-primary-foreground",
                    !isEqual(day, selectedDay) &&
                      !isToday(day) &&
                      isSameMonth(day, firstDayCurrentMonth) &&
                      "text-foreground",
                    !isEqual(day, selectedDay) &&
                      !isToday(day) &&
                      !isSameMonth(day, firstDayCurrentMonth) &&
                      "text-muted-foreground",
                    (isEqual(day, selectedDay) || isToday(day)) && "font-semibold",
                    "flex h-14 flex-col border-b border-r px-3 py-2 hover:bg-muted focus:z-10",
                  )}
                >
                  <time
                    dateTime={format(day, "yyyy-MM-dd")}
                    className={cn(
                      "ml-auto flex size-6 items-center justify-center rounded-full",
                      isEqual(day, selectedDay) &&
                        isToday(day) &&
                        "bg-primary text-primary-foreground",
                      isEqual(day, selectedDay) && !isToday(day) && "bg-primary text-primary-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </time>
                  {data.filter((d) => isSameDay(d.day, day)).length > 0 && (
                    <div>
                      {data
                        .filter((d) => isSameDay(d.day, day))
                        .map((d) => (
                          <div key={format(d.day, "yyyy-MM-dd")} className="-mx-0.5 mt-auto flex flex-wrap-reverse">
                            {d.events.map((event) => (
                              <span
                                key={event.id}
                                className="mx-0.5 mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground"
                              />
                            ))}
                          </div>
                        ))}
                    </div>
                  )}
                </button>
              ) : (
                <div
                  key={`lg-d-${format(day, "yyyy-MM-dd")}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Día ${format(day, "d 'de' MMMM", { locale: es })}`}
                  onClick={() => setSelectedDay(day)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      setSelectedDay(day)
                    }
                  }}
                  className={cn(
                    dayIdx === 0 && colStartClasses[getDay(day)],
                    !isEqual(day, selectedDay) &&
                      !isToday(day) &&
                      !isSameMonth(day, firstDayCurrentMonth) &&
                      "bg-accent/50 text-muted-foreground",
                    "relative flex flex-col border-b border-r hover:bg-muted focus:z-10",
                    !isEqual(day, selectedDay) && "hover:bg-accent/75",
                  )}
                >
                  <header className="flex items-center justify-between p-2.5">
                    <span
                      className={cn(
                        isEqual(day, selectedDay) && "text-primary-foreground",
                        !isEqual(day, selectedDay) &&
                          !isToday(day) &&
                          isSameMonth(day, firstDayCurrentMonth) &&
                          "text-foreground",
                        !isEqual(day, selectedDay) &&
                          !isToday(day) &&
                          !isSameMonth(day, firstDayCurrentMonth) &&
                          "text-muted-foreground",
                        isEqual(day, selectedDay) && isToday(day) && "border-none bg-primary",
                        isEqual(day, selectedDay) && !isToday(day) && "bg-foreground",
                        (isEqual(day, selectedDay) || isToday(day)) && "font-semibold",
                        "flex h-7 w-7 items-center justify-center rounded-full text-xs hover:border",
                      )}
                    >
                      <time dateTime={format(day, "yyyy-MM-dd")}>{format(day, "d")}</time>
                    </span>
                  </header>
                  <div className="flex-1 p-2.5">
                    {data
                      .filter((ev) => isSameDay(ev.day, day))
                      .map((d) => (
                        <div key={format(d.day, "yyyy-MM-dd")} className="space-y-1.5">
                          {d.events.slice(0, 1).map((event) => (
                            <div
                              key={event.id}
                              className="flex flex-col items-start gap-1 rounded-lg border bg-muted/50 p-2 text-xs leading-tight"
                            >
                              <p className="font-medium leading-none">{event.name}</p>
                              <p className="leading-none text-muted-foreground">{event.time}</p>
                            </div>
                          ))}
                          {d.events.length > 1 && (
                            <div className="text-xs text-muted-foreground">+ {d.events.length - 1} más</div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              ),
            )}
          </div>

          <div className="isolate grid w-full grid-cols-7 grid-rows-5 border-x lg:hidden">
            {days.map((day, dayIdx) => (
              <button
                type="button"
                onClick={() => setSelectedDay(day)}
                key={`sm-${format(day, "yyyy-MM-dd")}-${dayIdx}`}
                className={cn(
                  isEqual(day, selectedDay) && "text-primary-foreground",
                  !isEqual(day, selectedDay) &&
                    !isToday(day) &&
                    isSameMonth(day, firstDayCurrentMonth) &&
                    "text-foreground",
                  !isEqual(day, selectedDay) &&
                    !isToday(day) &&
                    !isSameMonth(day, firstDayCurrentMonth) &&
                    "text-muted-foreground",
                  (isEqual(day, selectedDay) || isToday(day)) && "font-semibold",
                  "flex h-14 flex-col border-b border-r px-3 py-2 hover:bg-muted focus:z-10",
                )}
              >
                <time
                  dateTime={format(day, "yyyy-MM-dd")}
                  className={cn(
                    "ml-auto flex size-6 items-center justify-center rounded-full",
                    isEqual(day, selectedDay) &&
                      isToday(day) &&
                      "bg-primary text-primary-foreground",
                    isEqual(day, selectedDay) && !isToday(day) && "bg-primary text-primary-foreground",
                  )}
                >
                  {format(day, "d")}
                </time>
                {data.filter((d) => isSameDay(d.day, day)).length > 0 && (
                  <div>
                    {data
                      .filter((d) => isSameDay(d.day, day))
                      .map((d) => (
                        <div key={format(d.day, "yyyy-MM-dd")} className="-mx-0.5 mt-auto flex flex-wrap-reverse">
                          {d.events.map((event) => (
                            <span
                              key={event.id}
                              className="mx-0.5 mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground"
                            />
                          ))}
                        </div>
                      ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
