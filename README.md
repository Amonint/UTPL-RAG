# Atenea — base de conocimiento UTPL

**Atenea** es el nombre del producto. Este repositorio (`utpl-rag-demo`) es solo el código; en comunicación y en pantalla se usa **Atenea**.

Plataforma de **conocimiento institucional** para que **asesores** y **personal de administración** trabajen sobre la misma base en **Neon (PostgreSQL)**. Los asesores consultan; administración crea taxonomía, sube documentación y publica. No es un portal para estudiantes finales.

- Lenguaje de dominio: [`CONTEXT.md`](CONTEXT.md)
- Decisiones: [`docs/adr/`](docs/adr/)
- Plan de trabajo (admin primero): [`docs/superpowers/plans/2026-06-01-atenea-admin-panel.md`](docs/superpowers/plans/2026-06-01-atenea-admin-panel.md)
- PRD: [`docs/prd/prd-kb-atenea-v1.md`](docs/prd/prd-kb-atenea-v1.md)

## Arquitectura

| Capa | Rol |
|------|-----|
| **Neon** | Fuente de verdad: taxonomía, ítems, audiencias, adjuntos PDF, estados editoriales, calendarios. |
| **Next.js** | Panel asesor (`/`), panel admin (`/admin`), APIs. |
| **Consulta** | **Búsqueda híbrida en Neon**: full-text (`tsvector`), typos (`pg_trgm`) y semántica (`pgvector` + Gemini embeddings). |

```text
Administración (admin) → publica en Neon → Asesor navega/consulta desde Neon
```

Carga masiva inicial o por ciclo: scripts ETL (CLI). El admin **no** reemplaza el ETL histórico, pero sí la curación día a día.

## Búsqueda híbrida en Neon

**Decisión:** toda la consulta operativa vive en **PostgreSQL (Neon)** — sin Meilisearch. Ver [ADR-0007](docs/adr/ADR-0007-neon-full-text-search.md).

Implementado en `src/lib/db/knowledge-services.ts` y `src/lib/search/knowledge-search-document.ts`:

| Capa | Tecnología | Qué aporta |
|------|------------|------------|
| Documento unificado | columna `search_document` | título, pregunta, respuesta, sinónimos, frases, taxonomía |
| Full-text | `search_tsv` + GIN + `websearch_to_tsquery('spanish')` | coincidencias léxicas y frases |
| Typos | extensión `pg_trgm` + `similarity()` | *certficados* → *certificados* |
| Semántica | `pgvector` + Gemini `text-embedding-004` | consultas en lenguaje natural |
| Ranking | score híbrido ponderado | FTS + trgm + vector + audiencia + sección |

### Variables de entorno

| Variable | Uso |
|----------|-----|
| `GEMINI_API_KEY` | Embeddings semánticos (opcional; FTS+trgm funcionan sin ella) |
| `SEARCH_SEMANTIC_WEIGHT` | Peso del vector (default `0.4`) |
| `SEARCH_VECTOR_MAX_DISTANCE` | Umbral de distancia coseno (default `0.55`) |
| `SEARCH_HYBRID_ENABLED` | `false` desactiva solo la parte vectorial |
| `SEARCH_REINDEX_ENABLED` | Permite reindexar desde `/admin` |

### Migración e índices

```bash
npm run db:migrate:search-document   # search_document + search_tsv
npm run db:migrate:search-embeddings   # pgvector + pg_trgm + backfill embeddings
```

Tras publicar o editar un ítem, el panel refresca `search_document` y el embedding automáticamente.

### Chat del asesor

El chat busca en **Información** y **Preguntas frecuentes** a la vez. Cada coincidencia debe mostrar tipo, pestaña, ruta del menú y «Aplica a» ([ADR-0005](docs/adr/ADR-0005-search-result-labels-cross-section.md)). La búsqueda ampliada en Neon alimenta mejores resultados; las tarjetas del chat son trabajo de UI posterior al **panel admin**.

## Secciones de la aplicación

| Pestaña (asesor) | `section_code` | Uso |
|------------------|----------------|-----|
| **Información** | `general_info` | Documentación estructurada: guías, fechas, procedimientos. Ver abajo. |
| **Preguntas frecuentes** | `faq` | FAQ operativas, trámites e incidencias (SGA). |

Ambas leen la **misma base canónica**; la pestaña es un filtro de consulta.

### Información — qué busca el asesor

En **Información**, el asesor recorre un **árbol a la izquierda** (categoría → subcategoría → apartado) y ve el contenido publicado a la derecha. Ámbitos habituales:

1. **Fechas académicas** (calendarios)
2. **Evaluación**
3. **Lengua extranjera**
4. **Matrículas**
5. **Pagos**
6. **Trámites y servicios**

Ejemplo de ruta: `Información → Calendarios → Académico → Fecha de matrículas` → muestra toda la documentación que administración cargó para ese nodo.

Filtros dirigidos (chips y desplegables) por **tipo de estudiante** y **modalidad** acotan qué ítems aplican, sin perder la jerarquía del menú.

### Preguntas frecuentes

Misma **jerarquía lateral** que Información (categoría → subcategoría → apartado), orientada a **consultas**: al abrir un apartado se listan las preguntas publicadas; al elegir una, se muestra la respuesta completa de inmediato.

### Chat y coincidencias

El chat busca en **Información y Preguntas frecuentes** a la vez. Cada resultado indica con lenguaje claro:

- **Qué es:** Pregunta, Documento, Categoría, Subcategoría o Apartado.
- **De qué pestaña viene:** Información o Preguntas frecuentes.
- **Dónde está en el menú:** p. ej. `Matrícula › Presencial › Inscripción`.
- **A quién aplica** (modalidad, tipo de estudiante) y un **resumen** de una línea.

Así se distinguen títulos parecidos (p. ej. dos “Matrícula presencial”: una puede ser un apartado del menú y otra, una pregunta concreta). Detalle: [ADR-0005](docs/adr/ADR-0005-search-result-labels-cross-section.md).

### Textos de la interfaz

Todas las etiquetas visibles (asesor y admin) deben ser **fáciles de entender**, sin jerga técnica. Guía: [ADR-0006](docs/adr/ADR-0006-plain-language-ui-copy.md).

## Panel de administración

Ruta: [http://localhost:3000/admin](http://localhost:3000/admin) (con flags de entorno activos).

### Calendario académico (admin)

En la pestaña **Calendario** (`/admin/calendar`) se edita el mismo calendario que ven los asesores (crear, editar y desactivar eventos con área, modalidad, tipo de estudiante y periodo).

1. Aplicar tablas en Neon (si aún no existen):

```bash
psql "$DATABASE_URL" -f scripts/migrations/2026-06-01-calendar-events.sql
```

2. Cargar eventos desde los JSON institucionales (opcional, primera vez):

```bash
DATABASE_URL=postgresql://... python3 scripts/etl_calendar_json_to_canonical.py --apply
```

La app lee eventos solo desde `/api/calendar/events` (Neon). Los JSON de la raíz del repo alimentan el ETL (`npm run etl:calendar`), no la UI en tiempo de ejecución.

**Hoy** el admin permite crear categorías, ítems y adjuntos sobre Neon. **Dirección de producto** (ADR-0004): hacer explícito en cada pantalla:

- **(a)** Nombre del servicio o categoría / elemento de información.
- **(b)** Modalidad y tipo de estudiante (chips y selects).
- **(c)** Documentación ordenada (texto + PDFs) reflejada tal cual en la vista del asesor.

Capacidades requeridas:

1. Generar **nuevos apartados** (taxonomía) según necesidad.
2. **Estructurar** contenido de forma intuitiva (editor o bloques).
3. **Clasificar** por audiencia antes de publicar.

**Plan de implementación:** [`docs/superpowers/plans/2026-06-01-atenea-admin-panel.md`](docs/superpowers/plans/2026-06-01-atenea-admin-panel.md) (prioridad antes del rediseño del chat y antes de ADR-0007 en código).

### Estado actual vs. planificado

| Área | Hoy | Planificado (ADRs) |
|------|-----|-------------------|
| Datos y consulta | Neon + SQL; admin y asesor operativos | Mantener Neon como default |
| Navegación lateral | Pestañas Información / Preguntas frecuentes | Misma jerarquía en ambas |
| Chat | Búsqueda básica en título/pregunta/respuesta | Tarjetas ADR-0005 + búsqueda ampliada ADR-0007 |
| Admin | CRUD sobre Neon | UI intuitiva (plan admin 2026-06-01) |
| Copy | Parcial | Revisión global lenguaje claro (ADR-0006) |
| Búsqueda Neon | Híbrida | FTS + pg_trgm + pgvector (ADR-0007) |

## Inicio rápido

```bash
cp .env.example .env
# DATABASE_URL → tu proyecto Neon (esquema y datos ya cargados)
# ADMIN_ENABLED=true
# NEXT_PUBLIC_ADMIN_ENABLED=true
# SEARCH_HYBRID_ENABLED=true
# SEARCH_SEMANTIC_WEIGHT=0.4
# GEMINI_API_KEY=   # embeddings semánticos (opcional)

npm install
npm run dev
```

| URL | Descripción |
|-----|-------------|
| `/` | Panel asesor |
| `/admin` | Administración |

```bash
npm run admin:db-stats   # conteos en Neon
```

Reinicia `npm run dev` después de cambiar `NEXT_PUBLIC_ADMIN_ENABLED`.

## Variables de entorno (resumen)

Ver [`.env.example`](.env.example).

| Variable | Default recomendado |
|----------|---------------------|
| `DATABASE_URL` | Obligatorio (Neon) |
| `GEMINI_API_KEY` | Embeddings semánticos + RAG con PDF |
| `SEARCH_SEMANTIC_WEIGHT` / `SEARCH_VECTOR_MAX_DISTANCE` | Afinar ranking híbrido |
| `SEARCH_REINDEX_ENABLED` | Reindexar desde admin |
| `ADMIN_ENABLED` / `NEXT_PUBLIC_ADMIN_ENABLED` | `true` en local si usas admin |

## ETL y actualización de contenido

```bash
npm run etl:faq:xlsx          # FAQ → Neon
npm run etl:sid:test          # Datos de prueba general_info
npm run etl:calendar          # Calendarios → Neon
```

No hay migraciones SQL versionadas en el repo; el esquema vive en Neon.

## Pruebas

```bash
npm test
npm run lint
```

## Pipeline de calendarios PDF (complementario)

Extracción de eventos desde PDFs en `doop/` (Textract, Vision). Salida en `data/derived/`. Alimenta ETL de calendario, no el núcleo del panel asesor.

```bash
npm run extract:doop-textract -- --dry-run
npm run process:textract-calendar
```

## Estructura del repo

```text
src/app/          Rutas Next.js
src/components/kb/   Navegación y paneles del asesor
src/components/admin/  Panel de administración
src/lib/db/       Acceso a Neon
scripts/          ETL y utilidades
docs/adr/         Decisiones de arquitectura
```
