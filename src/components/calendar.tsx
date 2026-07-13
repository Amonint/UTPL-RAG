"use client";

import { AcademicCalendarView } from "@/components/academic-calendar-view";
import { useAcademicCalendarEvents } from "@/hooks/use-academic-calendar-events";

export default function AcademicCalendar() {
  const { events, loading, error } = useAcademicCalendarEvents();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-[#003978]/70">
        Cargando calendario…
      </div>
    );
  }

  if (error && events.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 px-4 text-center text-sm text-[#003978]/80">
        <p>No se pudo cargar el calendario.</p>
        <p className="text-xs text-[#003978]/60">{error}</p>
      </div>
    );
  }

  return (
    <AcademicCalendarView
      events={events}
      readOnly
      subtitle="Calendario institucional · desde hoy (Ecuador)"
    />
  );
}
