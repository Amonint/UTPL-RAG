import { normalizeText } from "@/lib/search/normalize";

const PDF_TRIGGERS = [
  "pdf",
  "formato",
  "descargar",
  "manual",
  "reglamento",
  "documento",
  "anexo",
  "plantilla",
  "llenar",
  "firma",
  "instructivo",
  "requisitos detallados",
];

export function pdfNeeded(query: string): boolean {
  const q = normalizeText(query);
  const tokens = new Set(q.match(/[a-z0-9]+/g) ?? []);

  return PDF_TRIGGERS.some((t) => {
    // Phrases should stay as substring matches; single words should be token-aware.
    if (t.includes(" ")) return q.includes(t);
    return tokens.has(t);
  });
}
