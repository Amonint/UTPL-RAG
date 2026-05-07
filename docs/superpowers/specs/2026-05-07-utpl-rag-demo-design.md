# UTPL Service-Linked RAG Demo Design

**Date:** 2026-05-07

## Goal

Construir una demo web gratuita en Render que responda preguntas sobre servicios estudiantiles UTPL con prioridad absoluta en precisión, usando como fuente principal el JSON estructurado del portal y usando PDFs locales solo cuando estén enlazados al servicio consultado.

## Constraints

- Presupuesto operativo: cero.
- Hosting objetivo: Render free tier.
- Stack preferido: Next.js.
- Prioridad principal: precisión, no velocidad.
- No se debe mezclar evidencia entre servicios distintos.
- Muchos servicios no tienen PDF; en esos casos la respuesta debe salir solo del JSON.
- Los PDFs locales en `pdfs_descargados/` están ligados al JSON, no son una base documental global independiente.

## Current Dataset Understanding

- `servicios_utpl_jerarquico.json` contiene 113 registros de servicio distribuidos por tipo de estudiante y categoría.
- Existen 42 PDFs únicos descargados localmente en `pdfs_descargados/`.
- Los 42 PDFs provienen de URLs encontradas dentro del JSON.
- Solo 7 servicios tienen algún PDF asociado.
- 99 servicios no tienen PDF asociado.
- La relación servicio -> PDF aparece en dos formas:
  - `manual[].url`
  - `requisitos_pestanas...pdf`
- Un servicio puede tener múltiples PDFs y un mismo servicio puede repetirse en varios tipos de estudiante.

## Product Scope

La demo debe permitir que un usuario haga preguntas en lenguaje natural sobre un trámite o servicio UTPL y reciba:

- una respuesta grounded en fuentes del dataset local,
- datos del servicio desde el JSON,
- detalle adicional desde PDFs solo si ese mismo servicio tiene PDFs asociados,
- citas claras que indiquen si la evidencia salió del JSON o del PDF,
- manejo explícito de ambigüedad cuando la pregunta pueda referirse a varios servicios.

Fuera de alcance en esta fase:

- autenticación,
- historial de conversaciones persistente,
- panel administrativo,
- reindexado automático en Render,
- scraping en producción,
- uso de PDFs no enlazados al servicio recuperado.

## Recommended Architecture

### Overview

La arquitectura recomendada es un RAG jerárquico orientado a servicio:

1. identificar el servicio candidato,
2. recuperar siempre el registro JSON de ese servicio,
3. recuperar solo los chunks de PDFs ligados a ese servicio,
4. sintetizar la respuesta,
5. validar que las afirmaciones estén soportadas por la evidencia recuperada.

### Runtime Layout

- Un único proyecto Next.js con App Router.
- Frontend y backend en el mismo deploy.
- Despliegue en Render como Web Service Node.
- Índices y artefactos de ingesta versionados dentro del repo.
- Sin base vectorial externa en la primera iteración.

### Why This Architecture

- Maximiza precisión porque impone una restricción dura por servicio.
- Reduce alucinaciones al no dejar que el modelo busque libremente en todo el corpus.
- Evita agregar complejidad operativa innecesaria para un corpus pequeño.
- Funciona dentro de las limitaciones del free tier de Render, que no incluye cron ni background workers gratuitos.

## Source of Truth Rules

1. El JSON del servicio es la fuente base obligatoria.
2. Los PDFs solo complementan al servicio al que están enlazados en el JSON.
3. Nunca se deben usar PDFs de otro servicio como evidencia semánticamente similar.
4. Si un servicio no tiene PDF, la respuesta debe construirse solo con el JSON.
5. Si JSON y PDF discrepan, la respuesta debe reportar el conflicto explícitamente.
6. Si una afirmación no está soportada por evidencia recuperada, no debe incluirse.

## Data Model

### Canonical Service Record

Cada servicio debe normalizarse a un registro canónico con identificador estable:

- `service_id`
- `service_name`
- `student_types[]`
- `category`
- `json_payload`
- `pdf_refs[]`

`service_id` debe derivarse del nombre canónico del servicio más categoría para evitar colisiones simples y permitir enlazar chunks de distintas fuentes.

### Retrieval Units

#### JSON Chunk

Cada servicio tendrá al menos un chunk maestro derivado del JSON con:

- `chunk_id`
- `service_id`
- `source_kind = "json"`
- `service_name`
- `student_types[]`
- `category`
- `text`
- `metadata`

El texto debe incluir en formato lineal los campos más importantes:

- nombre,
- descripción,
- requisitos,
- requisitos por pestañas,
- costo,
- tiempo de respuesta,
- periodos,
- nota,
- importante,
- enlaces manuales.

#### PDF Chunk

Cada fragmento extraído de PDF debe incluir:

- `chunk_id`
- `service_id`
- `source_kind = "pdf"`
- `pdf_filename`
- `pdf_url_original`
- `page_number`
- `text`
- `metadata`

## Ingestion Design

La ingesta se ejecuta localmente y produce artefactos listos para deploy.

### Steps

1. Leer `servicios_utpl_jerarquico.json`.
2. Consolidar servicios repetidos por tipo de estudiante en un registro canónico.
3. Resolver todas las referencias de PDF del servicio.
4. Mapear cada URL PDF al archivo local correspondiente en `pdfs_descargados/`.
5. Extraer texto por página de cada PDF.
6. Generar chunks de JSON y chunks de PDF.
7. Generar embeddings para ambos tipos de chunk.
8. Guardar artefactos serializados para uso en runtime.

### Artifact Outputs

La ingesta debe producir al menos:

- `data/derived/services.json`
- `data/derived/chunks.jsonl`
- `data/derived/embeddings.json`
- `data/derived/pdf-manifest.json`

## Retrieval Design

### Stage 1: Candidate Service Routing

La primera etapa debe encontrar servicios candidatos con alta recall usando combinación de:

- coincidencia exacta por nombre,
- normalización de texto,
- coincidencia difusa,
- similitud vectorial sobre chunks JSON.

La salida debe ser `top N` servicios candidatos con score compuesto.

### Stage 2: Ambiguity Handling

Si la distancia entre candidatos es pequeña o la consulta es demasiado genérica, el sistema no debe adivinar.

Debe:

- devolver una pregunta de aclaración, o
- listar 2-3 servicios probables para que el usuario elija.

### Stage 3: Evidence Retrieval

Una vez elegido el `service_id`:

- traer siempre el chunk JSON maestro del servicio,
- recuperar `top K` chunks de PDF solo entre los PDFs enlazados a ese servicio,
- combinar scores léxicos y vectoriales para reranking final.

### Stage 4: Answer Synthesis

La generación debe producir una respuesta estructurada con:

- nombre del servicio,
- respuesta directa a la pregunta,
- requisitos o condiciones relevantes,
- aclaraciones por tipo de estudiante si aplican,
- fuentes citadas.

### Stage 5: Faithfulness Check

Antes de devolver la respuesta final, un paso de verificación debe revisar:

- que cada afirmación tenga soporte textual en la evidencia,
- que no haya mezclas entre servicios,
- que las citas correspondan al mismo `service_id`.

Si la verificación falla, el sistema debe responder de forma más conservadora.

## Model Strategy

### Generation Model

Usar Gemini como modelo principal de generación por viabilidad de free tier y mejor margen operativo que OpenRouter free.

### Embedding Model

Usar Gemini Embedding si la cuota práctica resulta suficiente.

Si la cuota no alcanza, cambiar a embeddings generados localmente o por otro proveedor gratuito, pero sin alterar la lógica de retrieval ligada por servicio.

### Why Not NVIDIA NIM as Primary

NVIDIA NIM puede ser útil para evaluación, pero no es la opción principal para una demo pública gratuita porque su acceso gratis para Developer Program está orientado a desarrollo, testing, research o evaluación.

## UX Requirements

- El usuario debe poder preguntar en lenguaje natural.
- La interfaz debe mostrar claramente cuándo una respuesta se basa en JSON y cuándo en PDF.
- Si no existe evidencia suficiente, la UI debe decirlo explícitamente.
- Si la pregunta es ambigua, la UI debe pedir precisión en lugar de inventar.
- Debe existir una vista simple de fuentes recuperadas para depuración y confianza.

## API Requirements

La API interna del proyecto debe exponer al menos:

- un endpoint de consulta RAG,
- un endpoint opcional de depuración para inspeccionar candidatos y evidencia recuperada.

La respuesta del endpoint principal debe incluir:

- `answer`
- `serviceCandidates`
- `selectedService`
- `citations`
- `usedSources`
- `needsDisambiguation`

## Precision Requirements

La demo se considera correcta solo si cumple estas reglas:

- no responde con PDFs de otros servicios,
- no responde con información no soportada,
- cita la fuente usada,
- conserva diferenciación por tipo de estudiante cuando sea necesaria,
- prefiere pedir aclaración antes que adivinar.

## Testing Strategy

La implementación debe incluir pruebas sobre:

- consolidación de servicios desde el JSON,
- resolución de enlaces servicio -> PDF local,
- chunking y metadata,
- candidate routing,
- ambiguity handling,
- retrieval restringido por `service_id`,
- generación de respuestas estructuradas,
- verificación de groundedness.

También debe existir un pequeño set de consultas doradas manuales, incluyendo:

- un servicio sin PDF,
- un servicio con un solo PDF,
- un servicio con varios PDFs,
- un caso ambiguo entre servicios,
- un caso donde la respuesta depende del tipo de estudiante.

## Deployment Notes

- Render free Web Service puede dormir por inactividad; esto es aceptable para demo.
- No se debe depender de cron jobs o background workers gratuitos en Render.
- La ingesta e indexación deben correr localmente antes del deploy.
- Los artefactos de índice deben viajar con el repositorio o con el build.

## Implementation Direction

La primera implementación debe priorizar:

1. pipeline de ingesta confiable,
2. índice local correcto,
3. retrieval restringido por servicio,
4. respuesta con citas,
5. verificación ligera de groundedness,
6. UI simple de consulta y depuración.

Esta secuencia maximiza precisión desde la primera versión y evita perder tiempo en infraestructura innecesaria.
