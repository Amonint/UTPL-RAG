"use client";

import React, { useMemo, useState } from "react";

import {
  EVENTS,
  MODALITIES,
  CATEGORY_COLORS,
  colorForCategory,
} from "@/data/calendar-events-active";
import { filterAcademicEventsFromTodayEcuador } from "@/lib/ecuador-calendar";

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(new Date(dateStr + "T00:00:00"));
}

// ─── COMPONENTE ───────────────────────────────────────────────────────────────
export default function AcademicCalendar() {
  const [query, setQuery]                   = useState("");
  const [selectedModality, setModality]     = useState("Todas");
  const [selectedCategory, setCategory]     = useState("Todas");

  const upcoming = useMemo(
    () => filterAcademicEventsFromTodayEcuador(EVENTS),
    [],
  );

  const categories = useMemo(() => {
    return ["Todas", ...new Set(upcoming.map((e) => e.category))];
  }, [upcoming]);

  const filtered = useMemo(() => {
    return [...upcoming]
      .filter(({ title, category, modality }) => {
        const q  = query.toLowerCase();
        const mq = selectedModality === "Todas" || modality.includes(selectedModality) || modality === "Todas";
        const cq = selectedCategory === "Todas" || category === selectedCategory;
        const tq = title.toLowerCase().includes(q) || category.toLowerCase().includes(q) || modality.toLowerCase().includes(q);
        return mq && cq && tq;
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [query, selectedModality, selectedCategory, upcoming]);

  return (
    <section style={s.wrapper}>
      {/* Cabecera */}
      <div style={s.header}>
        <div>
          <h2 style={s.title}>Calendario Académico UTPL</h2>
          <p style={s.subtitle}>Todas las modalidades · desde hoy (Ecuador)</p>
        </div>
        <span style={s.pill}>{filtered.length} eventos</span>
      </div>

      <div style={s.dayGridToolbar}>
        <a
          href="/calendario"
          target="_blank"
          rel="noopener noreferrer"
          style={s.dayGridToggle}
        >
          Calendario
        </a>
      </div>

      {/* Filtros */}
      <div style={s.filters}>
        <input
          type="text"
          placeholder="🔍  Buscar actividad, categoría o modalidad…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={s.input}
        />
        <select value={selectedModality} onChange={(e) => setModality(e.target.value)} style={s.select}>
          {MODALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={selectedCategory} onChange={(e) => setCategory(e.target.value)} style={s.select}>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Leyenda de categorías */}
      <div style={s.legend}>
        {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
          <button
            key={cat}
            onClick={() => setCategory(selectedCategory === cat ? "Todas" : cat)}
            style={{
              ...s.legendItem,
              outline: selectedCategory === cat ? `2px solid ${color}` : "none",
            }}
          >
            <span style={{ ...s.dot, background: color }} />
            {cat}
          </button>
        ))}
      </div>

      {/* Lista de eventos */}
      <div style={s.list}>
        {filtered.length === 0 ? (
          <p style={{ color: "#94a3b8", textAlign: "center", padding: 40 }}>
            No se encontraron eventos con los filtros aplicados.
          </p>
        ) : (
          filtered.map((event) => (
            <article key={event.id} style={s.card}>
              <span
                style={{
                  ...s.colorBar,
                  background: colorForCategory(event.category),
                }}
              />
              <div style={s.cardBody}>
                <div style={s.cardTop}>
                  <h3 style={s.cardTitle}>{event.title}</h3>
                  <span
                    style={{
                      ...s.badge,
                      background: `${colorForCategory(event.category)}18`,
                      color: colorForCategory(event.category),
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
                <p style={s.meta}>📋 {event.modality}</p>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

// ─── ESTILOS ─────────────────────────────────────────────────────────────────
const s = {
  wrapper: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: 24,
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    color: "#0f172a",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    flexWrap: "wrap" as const,
    gap: 12,
  },
  title: { margin: 0, fontSize: 28, fontWeight: 700 },
  subtitle: { margin: "4px 0 0", color: "#64748b", fontSize: 15 },
  pill: {
    background: "#f1f5f9",
    color: "#475569",
    padding: "6px 14px",
    borderRadius: 999,
    fontSize: 14,
    fontWeight: 600,
    alignSelf: "center",
  },
  filters: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr",
    gap: 12,
    marginBottom: 14,
  },
  input: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    fontSize: 14,
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  select: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    fontSize: 14,
    background: "white",
    cursor: "pointer",
  },
  legend: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 8,
    marginBottom: 20,
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 12px",
    borderRadius: 999,
    border: "1px solid #e2e8f0",
    background: "white",
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    flexShrink: 0,
  },
  list: { display: "grid", gap: 10 },
  card: {
    display: "flex",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(15,23,42,0.05)",
  },
  colorBar: { width: 5, flexShrink: 0 },
  cardBody: { flex: 1, padding: "14px 16px" },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap" as const,
  },
  cardTitle: { margin: 0, fontSize: 15, fontWeight: 600, flex: 1 },
  badge: {
    fontSize: 12,
    padding: "4px 10px",
    borderRadius: 999,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  date: { margin: "8px 0 4px", fontWeight: 600, fontSize: 14, color: "#1e293b" },
  meta: { margin: 0, color: "#64748b", fontSize: 13 },
  dayGridToolbar: {
    display: "flex",
    flexWrap: "wrap" as const,
    alignItems: "center" as const,
    gap: 10,
    marginBottom: 16,
  },
  dayGridToggle: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 16px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#1e293b",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    textDecoration: "none",
  },
};