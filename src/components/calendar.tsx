"use client";

import React, { useMemo, useState } from "react";

import {
  EVENTS,
  MODALITIES,
  CATEGORY_COLORS,
  colorForCategory,
} from "@/data/calendar-events-active";
import { filterAcademicEventsFromTodayEcuador } from "@/lib/ecuador-calendar";

const UTPL_NAVY = "#003978";
const UTPL_GOLD = "#c9a227";

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
          className="transition-colors duration-150 hover:bg-[#003978] hover:text-white"
          style={s.dayGridToggle}
        >
          Calendario
        </a>
      </div>

      {/* Filtros */}
      <div style={s.filters}>
        <input
          type="text"
          placeholder="Buscar actividad, categoría o modalidad…"
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
        {Object.entries(CATEGORY_COLORS).map(([cat, color]) => {
          const active = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(active ? "Todas" : cat)}
              style={{
                ...s.legendItem,
                border: active ? `1px solid ${UTPL_NAVY}` : `1px solid ${UTPL_NAVY}33`,
                background: active ? "#ffffff" : "#fafbfc",
                boxShadow: active ? `inset 3px 0 0 ${UTPL_GOLD}` : "none",
              }}
            >
              <span style={{ ...s.dot, background: color }} />
              {cat}
            </button>
          );
        })}
      </div>

      {/* Lista de eventos */}
      <div style={s.list}>
        {filtered.length === 0 ? (
          <p style={{ color: `${UTPL_NAVY}99`, textAlign: "center", padding: "48px 24px", fontSize: 14 }}>
            No se encontraron eventos con los filtros aplicados.
          </p>
        ) : (
          filtered.map((event, i) => {
            const catColor = colorForCategory(event.category)
            return (
              <article
                key={event.id}
                style={{
                  ...s.card,
                  background: i % 2 === 0 ? "#ffffff" : "#f7f9fc",
                }}
              >
                <span
                  style={{
                    ...s.colorBar,
                    background: catColor,
                  }}
                />
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
                </div>
              </article>
            )
          })
        )}
      </div>
    </section>
  );
}

// ─── ESTILOS (UTPL: azul, blanco, acentos dorados) ────────────────────────────
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
  legend: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 8,
    marginBottom: 22,
    padding: "14px 16px",
    borderRadius: 4,
    background: "#ffffff",
    border: `1px solid ${UTPL_NAVY}14`,
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 12px",
    borderRadius: 999,
    border: `1px solid ${UTPL_NAVY}33`,
    background: "#fafbfc",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
    color: "#334155",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    flexShrink: 0,
  },
  list: { display: "grid", gap: 8 },
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