"use client";

import React, { useMemo, useState } from "react";

import type { AcademicCalendarEventRecord } from "@/data/academic-calendar-events";
import { colorForCategory, modalityOptionsFromEvents } from "@/lib/calendar/event-categories";
import { normalizeText } from "@/lib/search/normalize";
import { filterAcademicEventsFromTodayEcuador, getEcuadorTodayYmd } from "@/lib/ecuador-calendar";

const UTPL_NAVY = "#003978";

export type AcademicCalendarViewProps = {
  events: AcademicCalendarEventRecord[];
  readOnly?: boolean;
  compact?: boolean;
  subtitle?: string;
  showMonthLink?: boolean;
  modalityOptions?: readonly string[];
  onCreate?: () => void;
  onEdit?: (event: AcademicCalendarEventRecord) => void;
  onDelete?: (event: AcademicCalendarEventRecord) => void;
};

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(dateStr + "T00:00:00"));
}

function parseYmdToDayNumber(ymd: string): number {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return Number.NaN;
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

function isExpiringInThreeDays(endYmd: string, todayYmd: string): boolean {
  const today = parseYmdToDayNumber(todayYmd);
  const end = parseYmdToDayNumber(endYmd);
  if (Number.isNaN(today) || Number.isNaN(end)) return false;
  const delta = end - today;
  return delta >= 0 && delta <= 3;
}

function eventKey(event: AcademicCalendarEventRecord): string {
  return String(event.id);
}

export function AcademicCalendarView({
  events,
  readOnly = true,
  compact = false,
  subtitle = "Calendario institucional · desde hoy (Ecuador)",
  showMonthLink = true,
  modalityOptions,
  onCreate,
  onEdit,
  onDelete,
}: AcademicCalendarViewProps) {
  const [query, setQuery] = useState("");
  const [selectedModality, setModality] = useState("Todas");
  const [selectedCategory, setCategory] = useState("Todas");
  const todayYmd = useMemo(() => getEcuadorTodayYmd(), []);

  const modalities = useMemo(
    () => modalityOptions ?? modalityOptionsFromEvents(events),
    [modalityOptions, events],
  );

  const upcoming = useMemo(
    () =>
      filterAcademicEventsFromTodayEcuador(events).filter((event) => {
        return parseYmdToDayNumber(event.start) >= parseYmdToDayNumber(todayYmd);
      }),
    [events, todayYmd],
  );

  const categories = useMemo(() => {
    return ["Todas", ...new Set(upcoming.map((e) => e.category))];
  }, [upcoming]);

  const filtered = useMemo(() => {
    return [...upcoming]
      .filter(({ title, category, modality }) => {
        const q = normalizeText(query);
        const norm = normalizeText;
        const mq =
          selectedModality === "Todas" ||
          modality.includes(selectedModality) ||
          modality === "Todas";
        const cq = selectedCategory === "Todas" || category === selectedCategory;
        const tq =
          !q ||
          norm(title).includes(q) ||
          norm(category).includes(q) ||
          norm(modality).includes(q);
        return mq && cq && tq;
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [query, selectedModality, selectedCategory, upcoming]);

  const expiringSoon = useMemo(() => {
    return [...filtered]
      .filter((e) => isExpiringInThreeDays(e.end, todayYmd))
      .sort((a, b) => new Date(a.end).getTime() - new Date(b.end).getTime());
  }, [filtered, todayYmd]);

  const wrapperStyle = compact
    ? { ...s.wrapper, maxWidth: "100%", padding: "16px 12px 20px" }
    : s.wrapper;

  return (
    <section style={wrapperStyle}>
      <div style={s.header}>
        <div>
          <h2 style={compact ? { ...s.title, fontSize: 18 } : s.title}>Calendario Académico UTPL</h2>
          <p style={s.subtitle}>{subtitle}</p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {!readOnly && onCreate ? (
            <button type="button" onClick={onCreate} style={s.primaryBtn}>
              Agregar evento
            </button>
          ) : null}
          <span style={s.pill}>{filtered.length} eventos</span>
        </div>
      </div>

      {showMonthLink ? (
        <div style={s.dayGridToolbar}>
          <a
            href="/calendario"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors duration-150 hover:bg-[#003978] hover:text-white"
            style={s.dayGridToggle}
          >
            Calendario
          </a>
        </div>
      ) : null}

      <div style={compact ? { ...s.filters, gridTemplateColumns: "1fr" } : s.filters}>
        <input
          type="text"
          placeholder="Buscar actividad, categoría o modalidad…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={s.input}
        />
        <select value={selectedModality} onChange={(e) => setModality(e.target.value)} style={s.select}>
          {modalities.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select value={selectedCategory} onChange={(e) => setCategory(e.target.value)} style={s.select}>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div style={compact ? { ...s.contentGrid, flexDirection: "column" as const } : s.contentGrid}>
        <div style={s.list}>
          {filtered.length === 0 ? (
            <p style={{ color: `${UTPL_NAVY}99`, textAlign: "center", padding: "48px 24px", fontSize: 14 }}>
              No se encontraron eventos con los filtros aplicados.
            </p>
          ) : (
            filtered.map((event, i) => {
              const catColor = colorForCategory(event.category);
              return (
                <article
                  key={eventKey(event)}
                  style={{
                    ...s.card,
                    background: i % 2 === 0 ? "#ffffff" : "#f7f9fc",
                  }}
                >
                  <span style={{ ...s.colorBar, background: catColor }} />
                  <div style={s.cardBody}>
                    <div style={s.cardTop}>
                      <h3 style={s.cardTitle}>{event.title}</h3>
                      <span
                        style={{
                          ...s.badge,
                          background: `${catColor}14`,
                          color: catColor,
                          borderColor: `${catColor}33`,
                        }}
                      >
                        {event.category}
                      </span>
                    </div>
                    <p style={s.date}>
                      {event.start === event.end
                        ? formatDate(event.start)
                        : `${formatDate(event.start)} → ${formatDate(event.end)}`}
                    </p>
                    <p style={s.meta}>{event.modality}</p>
                    {!readOnly && (onEdit || onDelete) ? (
                      <div style={s.cardActions}>
                        {onEdit ? (
                          <button type="button" style={s.actionBtn} onClick={() => onEdit(event)}>
                            Editar
                          </button>
                        ) : null}
                        {onDelete ? (
                          <button
                            type="button"
                            style={{ ...s.actionBtn, color: "#b91c1c", borderColor: "#fecaca" }}
                            onClick={() => onDelete(event)}
                          >
                            Eliminar
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </div>
        <aside style={compact ? { ...s.sidePanel, width: "100%", position: "relative" as const } : s.sidePanel}>
          <div style={s.sideHeader}>
            <h3 style={s.sideTitle}>Por vencer (3 días)</h3>
            <span style={s.sideCount}>{expiringSoon.length}</span>
          </div>
          {expiringSoon.length === 0 ? (
            <p style={s.sideEmpty}>No hay eventos por vencer en los próximos 3 días.</p>
          ) : (
            <ul style={s.sideList}>
              {expiringSoon.slice(0, 12).map((event) => (
                <li key={`exp-${eventKey(event)}`} style={s.sideItem}>
                  <p style={s.sideItemTitle}>{event.title}</p>
                  <p style={s.sideItemDate}>Fin: {formatDate(event.end)}</p>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </section>
  );
}

const s = {
  wrapper: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "28px 24px 36px",
    fontFamily: "var(--font-body), Inter, ui-sans-serif, system-ui, sans-serif",
    color: "#0f172a",
    background: "#ffffff",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    paddingBottom: 20,
    borderBottom: `1px solid ${UTPL_NAVY}18`,
    flexWrap: "wrap" as const,
    gap: 14,
  },
  title: { margin: 0, fontSize: 22, fontWeight: 600, color: UTPL_NAVY, letterSpacing: "-0.02em" },
  subtitle: { margin: "6px 0 0", color: "#64748b", fontSize: 14, fontWeight: 400 },
  pill: {
    background: `linear-gradient(135deg, ${UTPL_NAVY} 0%, #0d4d8c 100%)`,
    color: "#ffffff",
    padding: "6px 12px",
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
    alignSelf: "center",
  },
  primaryBtn: {
    padding: "8px 14px",
    borderRadius: 4,
    border: "none",
    background: UTPL_NAVY,
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  filters: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr",
    gap: 10,
    marginBottom: 16,
  },
  input: {
    padding: "11px 14px",
    borderRadius: 4,
    border: `1px solid ${UTPL_NAVY}26`,
    fontSize: 14,
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
    background: "#ffffff",
    minHeight: 44,
  },
  select: {
    padding: "11px 2.75rem 11px 14px",
    borderRadius: 4,
    border: `1px solid ${UTPL_NAVY}26`,
    fontSize: 14,
    background: "#ffffff",
    cursor: "pointer",
    color: "#0f172a",
    boxSizing: "border-box" as const,
    width: "100%",
    minHeight: 44,
  },
  contentGrid: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 16,
    alignItems: "start",
  },
  list: { display: "grid", gap: 8, flex: 1, minWidth: 0 },
  sidePanel: {
    border: `1px solid ${UTPL_NAVY}14`,
    borderRadius: 4,
    padding: "12px",
    background: "#ffffff",
    position: "sticky" as const,
    top: 12,
    width: 320,
    maxWidth: "100%",
    flexShrink: 0,
  },
  sideHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sideTitle: { margin: 0, fontSize: 14, fontWeight: 700, color: UTPL_NAVY },
  sideCount: {
    fontSize: 12,
    borderRadius: 999,
    padding: "2px 8px",
    background: `${UTPL_NAVY}14`,
    color: UTPL_NAVY,
    fontWeight: 700,
  },
  sideEmpty: { margin: 0, fontSize: 12, color: "#64748b" },
  sideList: { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 },
  sideItem: {
    border: `1px solid ${UTPL_NAVY}14`,
    borderRadius: 4,
    padding: "8px",
    background: "#f8fafc",
  },
  sideItemTitle: { margin: 0, fontSize: 12, fontWeight: 600, color: "#0f172a" },
  sideItemDate: { margin: "4px 0 0", fontSize: 11, color: "#475569" },
  card: {
    display: "flex",
    border: `1px solid ${UTPL_NAVY}14`,
    borderRadius: 4,
    overflow: "hidden",
    boxShadow: "none",
  },
  colorBar: { width: 4, flexShrink: 0 },
  cardBody: { flex: 1, padding: "14px 16px" },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap" as const,
  },
  cardTitle: { margin: 0, fontSize: 15, fontWeight: 600, flex: 1, color: "#0f172a" },
  badge: {
    fontSize: 11,
    padding: "4px 10px",
    borderRadius: 4,
    fontWeight: 600,
    whiteSpace: "nowrap",
    border: "1px solid transparent",
  },
  date: { margin: "8px 0 4px", fontWeight: 600, fontSize: 13, color: UTPL_NAVY },
  meta: { margin: 0, color: "#64748b", fontSize: 13 },
  cardActions: { display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" as const },
  actionBtn: {
    padding: "4px 10px",
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 4,
    border: `1px solid ${UTPL_NAVY}33`,
    background: "#fff",
    color: UTPL_NAVY,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  dayGridToolbar: {
    display: "flex",
    flexWrap: "wrap" as const,
    alignItems: "center" as const,
    gap: 10,
    marginBottom: 18,
  },
  dayGridToggle: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "9px 16px",
    borderRadius: 4,
    border: `1px solid ${UTPL_NAVY}`,
    background: "#ffffff",
    color: UTPL_NAVY,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    textDecoration: "none",
  },
};
