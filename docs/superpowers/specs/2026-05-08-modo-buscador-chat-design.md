# Modo Buscador en el Chat (Default) + Modo Conversacional Condicional

Fecha: 2026-05-08

## Objetivo

Cambiar el comportamiento del sistema para que, por defecto, funcione como **buscador local** sobre el JSON (sin llamadas al modelo), y reservar el **modo conversacional con RAG (JSON + PDFs)** solo para los casos puntuales donde el servicio tenga PDFs asociados y la pregunta requiera ese nivel de detalle.

Motivación principal:

- La mayor parte de la información relevante ya está en el JSON normalizado.
- Se quiere minimizar costo/latencia y evitar llamadas al modelo para preguntas resolubles con el JSON.
- Los PDFs se usan como fuente adicional solo cuando aportan valor real.

## Estado Actual (Baseline)

- El backend expone `POST /api/rag` que:
  - Carga artefactos normalizados desde `data/derived/services.json` y `data/derived/chunks.jsonl`.
  - “Rutea” un servicio candidato (Fuse sobre `serviceName` y `category`).
  - Cuando hay un candidato claro, arma evidencia del servicio (`rankEvidenceForService`) y llama a generación (`generateGroundedAnswer`).
- Los PDFs están “embebidos” en el JSON fuente y se normalizan a `pdfRefs` por servicio.

## Definiciones

- **Servicio**: una entrada normalizada con `serviceId`, `serviceName`, `category`, `studentTypes`, `jsonPayload`, `pdfRefs`.
- **Modo Buscador**: respuesta es una lista de resultados (vertical) con relevancia; no hay generación de texto por LLM.
- **Modo Chat**: interacción conversacional para un servicio seleccionado; puede producir respuestas generadas.
- **Uso de PDF**: cuando la pregunta requiere información que típicamente vive en anexos/manuales/formats; se permite incluir chunks PDF del servicio.

## Requerimiento Funcional

### 1) Modo por defecto

- El sistema debe operar en **Modo Buscador** por defecto.
- Una consulta del usuario debe devolver resultados tipo buscador (lista vertical), tolerante a:
  - Mayúsculas/minúsculas
  - Acentos/diacríticos
  - Coincidencias parciales
  - Términos “similares” (fuzzy / semánticos si se dispone)

### 2) Activación de modo conversacional (por servicio)

La activación es **por servicio**, no global:

- Un servicio puede tener o no PDFs asociados (`pdfRefs.length > 0`).
- El “modo chat” se habilita cuando el usuario **selecciona** un servicio en los resultados.

### 3) Uso condicional de PDFs (modo mixto)

Aun cuando el servicio seleccionado tenga PDFs:

- Por defecto, responder **solo con JSON** si la pregunta se puede resolver con el `jsonPayload`.
- Solo consultar PDFs cuando la pregunta indique o requiera información típicamente presente en documentos anexos (ver heurística).

## UX / Flujo

### A. Pantalla inicial

- Caja de búsqueda (input) y, tras escribir, una lista vertical de resultados.

### B. Resultados

Cada resultado muestra como mínimo:

- `serviceName`
- `category`
- Indicador si tiene PDFs (badge “PDF” o similar)
- Opcional: un snippet corto (ej. `descripcion` o `nota` si existe)

### C. Selección de servicio

Al seleccionar un resultado:

- Se entra a “contexto de servicio” (modo chat por servicio).
- Se presenta una ficha resumen con lo que esté en JSON (sin LLM).
- Si el servicio tiene PDFs: mostrar que hay soporte documental y que se usará solo cuando sea necesario.

### D. Mensajes subsecuentes

Mientras haya un servicio seleccionado:

- Preguntas del usuario se interpretan como referidas a ese servicio.
- Respuesta:
  - JSON-only si no se requiere PDF.
  - JSON+PDF si se requiere PDF y existen `pdfRefs`.

## Búsqueda: Ranking y Tolerancia

### 1) Normalización de texto

Aplicar a query y campos indexados:

- lowercase
- Unicode NFD + stripping de diacríticos
- trim + colapsar espacios

### 2) Señales de matching (mínimo)

- Exact match y substring match sobre:
  - `serviceName`
  - `category`
  - campos textuales del `jsonPayload` relevantes (ej. `descripcion`, `nota`, `modalidad_nivel`, etc.)

### 3) Fuzzy (tolerancia a typos)

- Fuse.js (ya existe en el proyecto) para fuzzy matching.

### 4) “Resultados relacionados”

Preferencia:

- **Embeddings locales precomputados** (0 llamadas en runtime) para semántica.

Fallback:

- Fuzzy lexical + reglas simples (por ejemplo, la misma raíz o términos compartidos).

## Heurística “Requiere PDF”

Definición: `pdfNeeded(query, selectedService)` devuelve boolean.

Debe ser **local** (sin LLM) y conservadora (evitar costos):

Disparadores típicos por intención:

- query contiene términos como: `pdf`, `formato`, `descargar`, `manual`, `reglamento`, `documento`, `anexo`, `plantilla`, `llenar`, `firma`, `requisitos detallados`, `instructivo`.

Disparadores por insuficiencia de JSON:

- Si `jsonPayload` no contiene `descripcion`/`nota`/campos útiles y la pregunta solicita detalle operacional (“pasos”, “requisitos”, “cómo hacer”) y el servicio tiene PDFs.

Regla de seguridad:

- Si el servicio **no** tiene PDFs, `pdfNeeded` no debe activar una consulta a PDFs; se responde con JSON disponible.

## Arquitectura / APIs (Propuesta)

### 1) Separación de “buscar” vs “responder”

Introducir dos comportamientos explícitos (en un endpoint nuevo o extendiendo el existente):

- `searchServices(query) -> results[]`
- `answerInServiceContext({ query, selectedServiceId, allowPdf }) -> answerPayload`

Donde:

- `allowPdf` depende de `pdfNeeded` y de que el servicio tenga `pdfRefs`.

### 2) Response shapes

**Search response**

- `results`: `[{ serviceId, serviceName, category, score, hasPdfs, snippet? }]`

**Answer response**

- `selectedService`
- `answer` (string) o `jsonExtract` (si se decide responder sin LLM)
- `usedSources` (si se usaron PDFs, incluir chunks PDF; si JSON-only, puede ser vacío o incluir el chunk JSON del servicio)

### 3) Artefactos / datos

Baseline existente:

- `data/derived/services.json` (servicios normalizados)
- `data/derived/chunks.jsonl` (chunks JSON y PDF por servicio)

Recomendado para “relacionados” sin LLM:

- Artefacto adicional de embeddings por servicio (o un índice) para búsqueda semántica local.

## No-Objetivos (por ahora)

- No se implementa una experiencia multi-servicio (contexto simultáneo).
- No se implementa un “agente” que decida con LLM si usar PDFs.
- No se implementa autenticación, guardado de sesiones, ni analíticas.

## Criterios de Éxito

- Consultas comunes encuentran resultados relevantes con tolerancia a:
  - acentos (“matricula” vs “matrícula”)
  - parciales (“retiro” encuentra “Retiro voluntario …”)
  - typos leves (fuzzy)
- En Modo Buscador:
  - 0 llamadas al modelo.
  - UI lista vertical clara y accionable.
- En Modo Chat:
  - Respuestas JSON-only cuando basta.
  - PDFs se consultan solo cuando `pdfNeeded` se activa y el servicio tiene PDFs.

## Preguntas Abiertas (para resolver antes de implementar)

- ¿Cuántos resultados mostrar por defecto (10, 20)?
- ¿Se requiere paginación o basta con top-N?
- ¿Qué campos del `jsonPayload` deben mostrarse como snippet?
- ¿Debe existir un “botón de salir” del contexto del servicio (“volver a buscar”)?

