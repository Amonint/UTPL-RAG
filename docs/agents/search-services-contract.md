# Contrato de `POST /api/search-services` (dual-read)

Este contrato permite transicionar de `faq` al esquema perfilado sin romper clientes existentes.

## Request body

```json
{
  "query": "retiro matricula",
  "limit": 20,
  "category": "matricula",
  "subcategory": "retiro",
  "element": "retiro-voluntario",
  "uiSection": "services_incidents",
  "profileCode": "student",
  "profileTypeCode": "presencial",
  "taxonomyOnly": false,
  "includeUnfiltered": false
}
```

## Campos nuevos

- `uiSection`: define contexto UI
  - `services_incidents` -> mapeado temporalmente a `knowledge_items.section_code='faq'`
  - `documentation` -> mapeado a `knowledge_items.section_code='general_info'`
- `profileCode`: perfil de audiencia (`student`, `administrative_staff`, etc.)
- `profileTypeCode`: granularidad de perfil (por ejemplo `presencial`)

## Priorización de audiencia

Cuando `profileCode` viene en request:

1. Coincidencia exacta `profile + profileType`.
2. Coincidencia `profile` sin tipo.
3. Contenido general (sin audiencias explícitas).

Si no se envía `profileCode`, se mantiene comportamiento de compatibilidad.

## Backend de búsqueda (dual-read)

- `SEARCH_BACKEND_MODE=sql|shadow|meili`.
- En `shadow`, la respuesta al cliente sigue siendo SQL; Meili se ejecuta en paralelo solo para comparación de calidad.
- `SEARCH_SHADOW_SAMPLE_RATE` controla el muestreo de logs comparativos.
- `jsonPayload.source` puede ser:
  - `canonical_db` cuando el resultado viene de SQL.
  - `meili` cuando el backend primario es Meilisearch.
