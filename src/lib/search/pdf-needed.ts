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

export function pdfNeeded(query: string) {
  const q = normalizeText(query);
  return PDF_TRIGGERS.some((t) => q.includes(t));
}

