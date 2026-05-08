import Fuse from "fuse.js";
import type { CanonicalServiceRecord, SearchResult } from "@/lib/types";
import { normalizeText } from "@/lib/search/normalize";

function pickSnippet(service: CanonicalServiceRecord) {
  const p = service.jsonPayload as any;
  const raw = (p?.descripcion ?? p?.nota ?? p?.modalidad_nivel ?? "") as string;
  const s = String(raw).trim();
  return s ? s.slice(0, 180) : undefined;
}

export function searchServices(input: {
  query: string;
  services: CanonicalServiceRecord[];
  limit: number;
}): SearchResult[] {
  const q = normalizeText(input.query);
  if (!q) return [];

  const exact = input.services
    .map((s) => ({ s, name: normalizeText(s.serviceName), cat: normalizeText(s.category) }))
    .filter(({ name, cat }) => name.includes(q) || cat.includes(q))
    .map(({ s }) => ({
      serviceId: s.serviceId,
      serviceName: s.serviceName,
      category: s.category,
      score: 1,
      hasPdfs: Boolean(s.pdfRefs?.length),
      snippet: pickSnippet(s),
    }));
  if (exact.length) return exact.slice(0, input.limit);

  const fuse = new Fuse(input.services, {
    includeScore: true,
    threshold: 0.35,
    keys: ["serviceName", "category"],
  });

  return fuse
    .search(input.query)
    .slice(0, input.limit)
    .map((r) => ({
      serviceId: r.item.serviceId,
      serviceName: r.item.serviceName,
      category: r.item.category,
      score: 1 - (r.score ?? 1),
      hasPdfs: Boolean(r.item.pdfRefs?.length),
      snippet: pickSnippet(r.item),
    }));
}

