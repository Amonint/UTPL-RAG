"use client"

import { FullScreenCalendar } from "@/components/ui/fullscreen-calendar"

const dummyEvents = [
  {
    day: new Date("2026-01-02T12:00:00"),
    events: [
      { id: 1, name: "Planificación Q1", time: "10:00", datetime: "2026-01-02T10:00:00" },
      { id: 2, name: "Sincronización de equipo", time: "14:00", datetime: "2026-01-02T14:00:00" },
    ],
  },
  {
    day: new Date("2026-01-07T12:00:00"),
    events: [
      { id: 3, name: "Revisión de lanzamiento", time: "14:00", datetime: "2026-01-07T14:00:00" },
      { id: 4, name: "Marketing sync", time: "11:00", datetime: "2026-01-07T11:00:00" },
      { id: 5, name: "Reunión con proveedor", time: "16:30", datetime: "2026-01-07T16:30:00" },
    ],
  },
  {
    day: new Date("2026-01-10T12:00:00"),
    events: [{ id: 6, name: "Taller de equipo", time: "11:00", datetime: "2026-01-10T11:00:00" }],
  },
  {
    day: new Date("2026-01-13T12:00:00"),
    events: [
      { id: 7, name: "Análisis de presupuesto", time: "15:30", datetime: "2026-01-13T15:30:00" },
      { id: 8, name: "Planificación de sprint", time: "09:00", datetime: "2026-01-13T09:00:00" },
      { id: 9, name: "Revisión de diseño", time: "13:00", datetime: "2026-01-13T13:00:00" },
    ],
  },
  {
    day: new Date("2026-01-16T12:00:00"),
    events: [
      { id: 10, name: "Presentación al cliente", time: "10:00", datetime: "2026-01-16T10:00:00" },
      { id: 11, name: "Almuerzo de equipo", time: "12:30", datetime: "2026-01-16T12:30:00" },
      { id: 12, name: "Estado del proyecto", time: "14:00", datetime: "2026-01-16T14:00:00" },
    ],
  },
]

export function CalendarFullscreenDemo() {
  return (
    <div className="flex min-h-[85vh] flex-1 flex-col scale-90">
      <FullScreenCalendar data={dummyEvents} />
    </div>
  )
}
