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

  // Prefilter + boost ranking: exact name > name substring > category substring.
  const boosted = input.services
    .map((s) => {
      const serviceNameNorm = normalizeText(s.serviceName);
      const categoryNorm = normalizeText(s.category);
      const nameExact = serviceNameNorm === q;
      const nameIncludes = serviceNameNorm.includes(q);
      const categoryIncludes = categoryNorm.includes(q);

      let score = 0;
      if (nameExact) score = 1;
      else if (nameIncludes) score = 0.95;
      else if (categoryIncludes) score = 0.9;

      return { s, serviceNameNorm, categoryNorm, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Deterministic tie-break to avoid flaky ordering.
      return a.serviceNameNorm.localeCompare(b.serviceNameNorm);
    })
    .slice(0, input.limit)
    .map(({ s, score }) => ({
      serviceId: s.serviceId,
      serviceName: s.serviceName,
      category: s.category,
      score,
      hasPdfs: Boolean(s.pdfRefs?.length),
      snippet: pickSnippet(s),
    }));
  if (boosted.length) return boosted;

  // Fuse fallback must be accent-insensitive: index normalized fields and search with normalized query.
  const indexed = input.services.map((item) => ({
    item,
    serviceNameNorm: normalizeText(item.serviceName),
    categoryNorm: normalizeText(item.category),
  }));

  const fuse = new Fuse(indexed, {
    includeScore: true,
    threshold: 0.35,
    keys: ["serviceNameNorm", "categoryNorm"],
  });

  return fuse
    .search(q)
    .slice(0, input.limit)
    .map((r) => ({
      serviceId: r.item.item.serviceId,
      serviceName: r.item.item.serviceName,
      category: r.item.item.category,
      score: 1 - (r.score ?? 1),
      hasPdfs: Boolean(r.item.item.pdfRefs?.length),
      snippet: pickSnippet(r.item.item),
    }));
}
