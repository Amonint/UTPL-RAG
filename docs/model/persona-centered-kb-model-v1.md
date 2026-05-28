# Modelo centrado en Persona (v1)

## Objetivo

Definir una estructura de datos que permita:

- gestionar contenido confiable para el personal administrativo,
- consultar rapido desde interfaz por jerarquia,
- y soportar multiples perfiles (estudiante presencial, en linea, administrativo, etc.).

## Vista funcional de la interfaz

El panel izquierdo se divide en dos pestañas:

1. **Documentación**
   - Contiene conocimiento institucional general.
   - Se organiza de forma jerarquica por `Dominio -> Categoria KB -> Subcategoria KB -> Elemento de Lista -> Item de Conocimiento`.
   - Debe ser administrable por CRUD desde el panel de administracion.

2. **Servicios e Incidencias**
   - Contiene tramites, servicios operativos e incidencias frecuentes.
   - Debe permitir filtrar rapidamente por perfil y contexto de atencion.

## Modelo de dominio propuesto

### Nucleo de identidad

- `Persona`: entidad base transversal.
- `Perfil de Persona`: clasifica el rol operativo de la persona.
  - Ejemplos: `estudiante`, `administrativo`, `docente`, `postulante`.
- `Tipo de Perfil`: especializacion del perfil.
  - Ejemplos para estudiante: `presencial`, `en_linea`, `distancia`.

### Relacion con conocimiento y servicios

- Una `Persona` puede tener **uno o varios** perfiles.
- Un `Perfil de Persona` puede tener **muchos** servicios/incidencias aplicables.
- Los `Items de Conocimiento` pueden declararse aplicables a:
  - perfil(es),
  - tipo(s) de perfil,
  - modalidad(es),
  - ciclo/periodo.

## Traduccion relacional sugerida

No se usa herencia OO literal en base de datos; se modela con tablas y relaciones:

- `personas` (id, identificadores, estado)
- `person_profiles` (id, persona_id, profile_code)
- `profile_types` (id, profile_code, type_code, name)
- `person_profile_types` (person_profile_id, profile_type_id)
- `knowledge_item_audiences` (knowledge_item_id, profile_code, profile_type_code opcional)
- `service_variant_audiences` (service_variant_id, profile_code, profile_type_code opcional)

Este enfoque logra el efecto de "clase Persona + perfiles derivados" sin perder integridad SQL.

## Regla de publicacion y busqueda

- **Neon** conserva el modelo canonico completo (fuente de verdad).
- **Meilisearch** indexa solo contenido `published` y vigente.
- El documento de busqueda debe incluir, como minimo:
  - `entity_type`,
  - `profile_codes[]`,
  - `profile_type_codes[]`,
  - `domain/category/subcategory/element`,
  - `title/question/answer`,
  - `updated_at`.

## Beneficios esperados

- Mayor claridad para el personal (dos contextos funcionales claros).
- Mejor escalabilidad para nuevos perfiles sin redisenar el sistema.
- Mejor precision en busqueda al filtrar por perfil/tipo de perfil.
- Trazabilidad y control editorial mantenidos en una sola base canonica.
