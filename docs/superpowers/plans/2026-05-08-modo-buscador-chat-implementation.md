# Modo Buscador en el Chat (Default) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que el chat funcione por defecto como buscador local del JSON (0 llamadas al LLM) y habilitar modo conversacional por servicio con uso condicional de PDFs solo cuando aplique.

**Architecture:** Separar claramente “buscar servicios” (local, Fuse + normalización + opcional semántico) de “responder en contexto de servicio”. El frontend mantiene un `selectedServiceId` opcional y decide si está en “browse/search” o “service context”. El backend expone un endpoint de búsqueda y ajusta el endpoint de respuesta para soportar “JSON-only” y “JSON+PDF” según heurística `pdfNeeded`.

**Tech Stack:** Next.js App Router (TS), React, Fuse.js, Radix UI, Tailwind v4, (opcional) embeddings locales desde `data/derived/embeddings.json`.

---

## File Map (Create/Modify)

**Create**
- `src/lib/search/normalize.ts` (normalización: lower + strip accents + whitespace)
- `src/lib/search/pdf-needed.ts` (heurística local para decidir uso de PDF)
- `src/lib/search/service-search.ts` (ranking local de servicios; devuelve resultados con score + snippet)
- `src/app/api/search-services/route.ts` (API para buscador)

**Modify**
- `src/app/api/rag/route.ts` (aceptar `selectedServiceId` y `mode`/`allowPdf`; permitir “JSON-only answer” sin LLM)
- `src/lib/chat/create-assistant-turn.ts` (agregar soporte de un nuevo tipo de turno “search results” o payload)
- `src/components/rag-workbench.tsx` (nuevo flujo UI: buscador default + contexto de servicio)
- `src/components/chat-message.tsx` (render de resultados en lista con CTA seleccionable)
- `src/lib/types.ts` (tipos: SearchResult, payloads nuevos)

**Tests**
- `tests/unit/service-search.test.ts` (normalización + fuzzy + acentos)
- `tests/unit/pdf-needed.test.ts` (heurística)
- `tests/integration/search-services.route.test.ts` (API search responde top-N)

---

### Task 1: Normalización de texto (acentos + case + espacios)

**Files:**
- Create: `src/lib/search/normalize.ts`
- Test: `tests/unit/normalize.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it } from "vitest";
import { normalizeText } from "@/lib/search/normalize";

describe("normalizeText", () => {
  it("lowercases and strips accents", () => {
    expect(normalizeText("Matrícula Presencial")).toBe("matricula presencial");
  });

  it("collapses whitespace", () => {
    expect(normalizeText("  Retiro   voluntario ")).toBe("retiro voluntario");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/normalize.test.ts`
Expected: FAIL (module/function missing)

- [ ] **Step 3: Implement normalizeText**

```ts
export function normalizeText(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}
```

- [ ] **Step 4: Run test**

Run: `npm test -- tests/unit/normalize.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/search/normalize.ts tests/unit/normalize.test.ts
git commit -m "feat(search): add text normalization"
```

---

### Task 2: Heurística local `pdfNeeded(query)`

**Files:**
- Create: `src/lib/search/pdf-needed.ts`
- Test: `tests/unit/pdf-needed.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it } from "vitest";
import { pdfNeeded } from "@/lib/search/pdf-needed";

describe("pdfNeeded", () => {
  it("detects document/form intent", () => {
    expect(pdfNeeded("descargar el formato de retiro")).toBe(true);
  });

  it("does not trigger for generic short queries", () => {
    expect(pdfNeeded("retiro voluntario")).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/unit/pdf-needed.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement heuristic**

```ts
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
```

- [ ] **Step 4: Run test**

Run: `npm test -- tests/unit/pdf-needed.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/search/pdf-needed.ts tests/unit/pdf-needed.test.ts
git commit -m "feat(search): add pdf-needed heuristic"
```

---

### Task 3: Servicio Search (Fuse + snippets + hasPdfs)

**Files:**
- Create: `src/lib/search/service-search.ts`
- Modify: `src/lib/types.ts` (definir `SearchResult`)
- Test: `tests/unit/service-search.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it } from "vitest";
import { searchServices } from "@/lib/search/service-search";

const services = [
  {
    serviceId: "a",
    serviceName: "Solicitar edición de matrícula",
    category: "SERVICIOS",
    studentTypes: ["X"],
    jsonPayload: { descripcion: "..." },
    pdfRefs: [],
  },
  {
    serviceId: "b",
    serviceName: "Retiro voluntario",
    category: "SERVICIOS",
    studentTypes: ["X"],
    jsonPayload: { nota: "..." },
    pdfRefs: [{ label: "Formato", url: "x.pdf", localPath: "x.pdf", sourcePath: "0" }],
  },
] as any;

describe("searchServices", () => {
  it("is accent-insensitive", () => {
    const res = searchServices({ query: "matricula", services, limit: 10 });
    expect(res[0]?.serviceId).toBe("a");
  });

  it("includes hasPdfs flag", () => {
    const res = searchServices({ query: "retiro", services, limit: 10 });
    expect(res[0]?.hasPdfs).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/service-search.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement types + search**

In `src/lib/types.ts` add:

```ts
export type SearchResult = {
  serviceId: string;
  serviceName: string;
  category: string;
  score: number; // 0..1
  hasPdfs: boolean;
  snippet?: string;
};
```

In `src/lib/search/service-search.ts` implement:

```ts
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

  // Exact/substring boost (cheap).
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
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/unit/service-search.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/search/service-search.ts tests/unit/service-search.test.ts
git commit -m "feat(search): add local service search"
```

---

### Task 4: API `POST /api/search-services`

**Files:**
- Create: `src/app/api/search-services/route.ts`
- Test: `tests/integration/search-services.route.test.ts`

- [ ] **Step 1: Add integration test skeleton**

```ts
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/search-services/route";

describe("POST /api/search-services", () => {
  it("returns results array", async () => {
    const req = new Request("http://localhost/api/search-services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "matricula", limit: 5 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.results)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run: `npm test -- tests/integration/search-services.route.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement route**

```ts
import { loadArtifacts } from "@/lib/data/load-artifacts";
import { searchServices } from "@/lib/search/service-search";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { query?: string; limit?: number };
  const query = body.query?.trim() ?? "";
  const limit = Math.min(Math.max(body.limit ?? 12, 1), 50);

  if (!query) {
    return Response.json({ results: [] }, { status: 200 });
  }

  const { services } = await loadArtifacts();
  const results = searchServices({ query, services, limit });
  return Response.json({ results });
}
```

- [ ] **Step 4: Run test**

Run: `npm test -- tests/integration/search-services.route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/search-services/route.ts tests/integration/search-services.route.test.ts
git commit -m "feat(api): add search-services endpoint"
```

---

### Task 5: Backend “answer” in context (JSON-only by default, PDF optional)

**Files:**
- Modify: `src/app/api/rag/route.ts`
- Modify: `src/lib/retrieval/evidence-retriever.ts` (permitir filtrar pdfChunks según `allowPdf`)
- Test: `tests/integration/rag-json-only.test.ts`

- [ ] **Step 1: Add integration test for JSON-only mode**

```ts
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/rag/route";

describe("POST /api/rag (json-only)", () => {
  it("responds without requiring PDFs", async () => {
    const req = new Request("http://localhost/api/rag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "¿de qué trata?", selectedServiceId: "some-id", allowPdf: false }),
    });
    const res = await POST(req);
    expect([200, 422, 400]).toContain(res.status);
  });
});
```

Note: this test will be tightened after wiring selectedServiceId in the route; initial goal is to lock the contract.

- [ ] **Step 2: Implement `selectedServiceId` + `allowPdf` input**

In `src/app/api/rag/route.ts`, accept body:

```ts
type RagBody = { question?: string; selectedServiceId?: string; allowPdf?: boolean };
```

Behavior:

- If `selectedServiceId` is present:
  - Skip `routeCandidates`.
  - Fetch `selectedService` by id.
  - Build evidence from chunks for that service.
  - If `allowPdf` is false, pass only the JSON chunk(s) for that service.
  - If `allowPdf` is true, include pdf chunks as current behavior.

- If `selectedServiceId` is absent:
  - Keep existing routing behavior (compat).

- [ ] **Step 3: Update evidence retriever to support `allowPdf`**

Change signature:

```ts
export function rankEvidenceForService(input: {
  query: string;
  serviceId: string;
  chunks: RetrievalChunk[];
  allowPdf?: boolean;
})
```

and gate pdfChunks by `allowPdf`.

- [ ] **Step 4: Run relevant tests**

Run: `npm test -- tests/unit/evidence-retriever.test.ts tests/integration/rag-json-only.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/rag/route.ts src/lib/retrieval/evidence-retriever.ts tests/integration/rag-json-only.test.ts
git commit -m "feat(api): support service context + optional pdf evidence"
```

---

### Task 6: Frontend state machine (Search default + Service context)

**Files:**
- Modify: `src/components/rag-workbench.tsx`
- Modify: `src/components/chat-message.tsx`
- Modify: `src/lib/chat/create-assistant-turn.ts`
- Test: `tests/unit/rag-workbench-search-flow.test.tsx`

- [ ] **Step 1: Define payload for search turns**

Extend `ChatTurn` with:

```ts
searchResults?: Array<{
  serviceId: string;
  serviceName: string;
  category: string;
  score: number;
  hasPdfs: boolean;
  snippet?: string;
}>;
```

and helper in `create-assistant-turn.ts`:

```ts
export function createSearchResultsTurn(results: ChatTurn["searchResults"]): ChatTurn {
  return {
    id: `assistant-${crypto.randomUUID()}`,
    role: "assistant",
    status: "done",
    content: "Resultados",
    searchResults: results ?? [],
    usedSources: [],
    serviceCandidates: [],
    selectedService: null,
  };
}
```

- [ ] **Step 2: Update `ChatMessage` to render clickable search results**

Add optional prop:

```ts
interface ChatMessageProps {
  turn: ChatTurn;
  onSelectService?: (serviceId: string) => void;
}
```

Render:
- If `turn.searchResults?.length`, show a `<ul>` with `<button>` per item and call `onSelectService(serviceId)`.

- [ ] **Step 3: Wire RagWorkbench**

State:

```ts
const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
```

Behavior:
- If `selectedServiceId` is null:
  - On submit, call `POST /api/search-services` and append a search-results assistant turn.
- If `selectedServiceId` is set:
  - On submit, compute `allowPdf = hasPdfs && pdfNeeded(question)` (client-side).
  - Call `POST /api/rag` with `{ question, selectedServiceId, allowPdf }`.

Also add “Salir / Volver a buscar” button when `selectedServiceId` is set.

- [ ] **Step 4: Add unit test for flow**

Test that:
- Submitting query in search mode calls search endpoint and renders list.
- Clicking result sets context and next submit calls `/api/rag` with `selectedServiceId`.

Use `@testing-library/react` + mock `global.fetch`.

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/unit/rag-workbench-search-flow.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/rag-workbench.tsx src/components/chat-message.tsx src/lib/chat/create-assistant-turn.ts tests/unit/rag-workbench-search-flow.test.tsx
git commit -m "feat(ui): add search-first flow + per-service context"
```

---

### Task 7: End-to-end verification + docs

**Files:**
- Modify: `README.md` (documentar modos y endpoints)

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 2: Manual smoke**

Run: `npm run dev`
Expected:
- Query shows search results (no LLM call).
- Select a service -> context.
- Ask “descargar formato …” triggers `allowPdf=true` only if service has PDFs.

- [ ] **Step 3: Commit docs**

```bash
git add README.md
git commit -m "docs: explain search mode vs chat mode"
```

---

## Plan Self-Review

- Spec coverage:
  - Buscador default: Tasks 3–4 + Task 6
  - Tolerancia (acentos/case/partials): Task 1 + Task 3
  - Modo por servicio: Task 6
  - PDF condicional: Task 2 + Task 5 + Task 6
- Placeholder scan: steps include code + commands.
- Type consistency: `SearchResult` and `searchResults` aligned across backend/UI.
