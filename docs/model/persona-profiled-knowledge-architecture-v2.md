# Arquitectura de datos v2 (perfilada por Persona)

## Objetivo

Diseñar una base de conocimiento escalable para servicio al cliente, donde la consulta se adapte por perfil de persona y tipo de perfil, sin limitarse a un solo dominio (academico, becas, financiero, servicios, incidencias, etc.).

## Principio rector

- `Persona` es el nucleo transversal.
- El contenido se publica por audiencias (perfil/tipo), no por una unica vista fija.
- Neon conserva la verdad canónica; Meilisearch sirve la lectura rapida.

## Modelo conceptual (alto nivel)

1. **Identidad y audiencia**
   - Persona
   - Perfil de persona
   - Tipo de perfil
2. **Conocimiento y operacion**
   - Item de conocimiento (FAQ, documentacion, guia operativa)
   - Servicio / Incidencia (catalogo operativo)
3. **Clasificacion y vigencia**
   - Dominio -> Categoria -> Subcategoria -> Elemento
   - Ciclo / Modalidad / Estado editorial / Vigencia

## Esquema relacional propuesto

### A) Nucleo de identidad

#### `persons`
- `id` (uuid, pk)
- `external_ref` (text, unico, opcional)
- `display_name` (text)
- `is_active` (boolean)
- `created_at`, `updated_at`

#### `profile_catalog`
- `code` (text, pk)  
  Ej: `student`, `administrative_staff`, `teacher`, `applicant`, `alumni`
- `name` (text)
- `is_active` (boolean)

#### `profile_type_catalog`
- `id` (uuid, pk)
- `profile_code` (fk -> `profile_catalog.code`)
- `type_code` (text)  
  Ej: para `student`: `presencial`, `en_linea`, `distancia`
- `name` (text)
- `is_active` (boolean)
- `unique(profile_code, type_code)`

#### `person_profiles`
- `id` (uuid, pk)
- `person_id` (fk -> `persons.id`)
- `profile_code` (fk -> `profile_catalog.code`)
- `is_primary` (boolean)
- `is_active` (boolean)
- `created_at`, `updated_at`
- `unique(person_id, profile_code)`

#### `person_profile_types`
- `person_profile_id` (fk -> `person_profiles.id`)
- `profile_type_id` (fk -> `profile_type_catalog.id`)
- `primary key(person_profile_id, profile_type_id)`

> Nota: este bloque implementa la idea de "clase Persona + granularidad por tipo", sin herencia OO, en SQL relacional.

### B) Conocimiento y servicios

#### `knowledge_items` (se mantiene)
- Se conserva como unidad editorial principal.
- `section_code`: usar al menos:
  - `services_incidents`
  - `general_info`

#### `knowledge_item_versions` (se mantiene)
- Contenido versionado (pregunta, respuesta, sinonimos, frases).

#### `services`, `service_variants` (se mantiene y se activa su uso)
- Catalogo operativo para tramites/servicios/incidencias.
- `service_variants` concentra reglas especificas de contexto.

### C) Audiencias (nuevo)

#### `knowledge_item_audiences`
- `knowledge_item_id` (fk -> `knowledge_items.id`)
- `profile_code` (fk -> `profile_catalog.code`)
- `profile_type_id` (fk -> `profile_type_catalog.id`, nullable)
- `program_level_code` (fk -> `program_level_catalog.code`, nullable) — **V1**
- `student_type_id` (fk -> `student_types.id`, nullable) — **V1**
- `priority` (smallint, default 100)
- PK surrogate `id`; unicidad operativa por combinación de ejes

Regla:
- Si `profile_type_id` es null => aplica a todo el perfil en modalidad.
- Si `program_level_code` es null o `general` => aplica a todos los niveles.
- Si `student_type_id` es null => aplica a todos los ciclos.
- Si no hay filas para un item => item "general" (fallback).

### V1 — Decisión FAQ-only

Para **Servicios e Incidencias**, la unidad de búsqueda principal es `knowledge_items` (FAQ), no `services`/`service_variants`. Las tablas de servicio permanecen para evolución posterior.

### V1 — Tres ejes de audiencia

Además de modalidad (`profile_type`), V1 incluye:
- `program_level_code`: grado, posgrado, tec, competencias_especificas
- `student_type_id`: NUEVO, CONTINUO, POSTULANTE, ALUMNI

Ver mapeo UTPL en [`utpl-information-hierarchy.md`](utpl-information-hierarchy.md).

#### `service_variant_audiences`
- `service_variant_id` (fk -> `service_variants.id`)
- `profile_code` (fk -> `profile_catalog.code`)
- `profile_type_id` (fk -> `profile_type_catalog.id`, nullable)
- `primary key(service_variant_id, profile_code, profile_type_id)`

### D) Taxonomia y contexto (ya existente)

Mantener y fortalecer:
- `domains`
- `kb_categories`
- `kb_subcategories`
- `kb_elements`
- `modalities`
- `cycle_periods`

## Como queda la consulta para soporte

Para una consulta de un asesor, con contexto de persona:
- `profile_code = student`
- `profile_type_code = presencial`
- `domain = academic` (opcional)

Orden de matching recomendado:
1. Items exactos por `perfil + tipo`.
2. Items por `perfil` (sin tipo).
3. Items generales (sin audiencia).

Esto mejora precision y evita ruido cuando hay mucha informacion transversal.

## Separacion funcional de tabs

1. **Servicios e Incidencias**
   - `knowledge_items.section_code = 'services_incidents'`
   - Puede enlazar a `services/service_variants`.
2. **Documentacion**
   - `knowledge_items.section_code = 'general_info'`
   - Jerarquia editorial con CRUD administrativo.

## Escalabilidad por dominio

La misma estructura aplica para:
- Academico
- Becas
- Financiero
- Tramites institucionales
- Nuevos dominios futuros

No se crean tablas por dominio; se parametriza por `domains` y audiencias.

## Reglas de publicacion

Un item entra a consulta solo si:
- `editorial_status = 'published'`
- `is_active = true`
- fecha vigente (`valid_from/valid_to`)

## Proyeccion a Meilisearch

Documento de indice recomendado:
- `id` (compuesto por item + audiencia cuando aplica)
- `entity_type` (`knowledge_item` en V1)
- `section_code`, `content_type`, `domain_code`, `service_category_code`
- `category/subcategory/element` slugs y labels
- `profile_type_code`, `program_level_code`, `student_lifecycle_code`
- `question_text`, `answer_text`, `synonyms`, `trigger_phrases`, `search_text`

Búsqueda chat: **cross-sección** con boost suave por sección activa; audiencia como ranking/badges, no corte duro.
- `title/question/answer`
- `profile_codes[]`
- `profile_type_codes[]`
- `editorial_status`
- `valid_from`, `valid_to`
- `updated_at`

## Plan de migracion sin ruptura

1. Crear nuevas tablas de identidad y audiencia (sin borrar nada).
2. Renombrar semanticamente seccion operativa:
   - de `faq` a `services_incidents` (con migracion controlada), o mapear en API inicialmente.
3. Poblar `profile_catalog` y `profile_type_catalog`.
4. Asignar audiencias a items existentes (inicialmente por reglas globales).
5. Activar filtros por perfil/tipo en API y UI.
6. Cargar "Documentacion" en `general_info` con SID Data.
7. Luego, normalizar la capa `services/service_variants` y vincular progresivamente.

## Decisiones recomendadas para arrancar

1. Adoptar este esquema como baseline de largo plazo.
2. Implementar por fases para no frenar operacion.
3. Priorizar calidad de audiencias (perfil/tipo) antes que cantidad de contenido.
4. Mantener trazabilidad completa por cambio y por origen de dato.

