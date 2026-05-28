# ADR-0001: Neon como fuente de verdad y Meilisearch como indice de consulta

- Estado: Aprobado
- Fecha: 2026-05-27
- Decisores: Equipo Atenea KB

## Contexto

El personal administrativo y asesores necesita consultar informacion de tramites, servicios, FAQ y calendario con rapidez y confiabilidad.

El proyecto requiere:

- Gobernanza editorial (borrador, revision, aprobado, publicado, archivado).
- Trazabilidad completa de cambios (quien, que, cuando y por que).
- Integridad y relaciones del modelo canonico (Dominio, Categoria KB, Subcategoria KB, Elemento de Lista, Item de Conocimiento, Servicio, Variantes, Calendario).
- Busqueda de alta velocidad y calidad para operacion diaria.

Un enfoque de "chatbot generativo libre" no cumple confiabilidad institucional por riesgo de alucinaciones.

## Decisión

Se adopta una arquitectura de dos capas:

1. **Neon (PostgreSQL)** como **fuente de verdad**.
2. **Meilisearch** como **indice de lectura optimizado para busqueda**.

Reglas operativas:

- Toda creacion/edicion/gobernanza ocurre en Neon.
- Solo contenido **publicado y vigente** se proyecta a Meilisearch.
- Meilisearch no es sistema transaccional ni fuente de verdad.
- Todo documento en Meilisearch mantiene un identificador canonico para trazabilidad y resolucion de detalle en Neon.

## Consecuencias

### Positivas

- Alta confiabilidad operativa: las respuestas consultadas provienen de contenido validado.
- Mejor rendimiento de consulta con facetas, typo-tolerance y ranking.
- Reindexacion controlada: el indice puede reconstruirse desde Neon en cualquier momento.
- Separacion clara de responsabilidades: gobernanza vs recuperacion.

### Costos y trade-offs

- Se requiere pipeline de sincronizacion Neon -> Meilisearch (full + incremental + despublicacion).
- Mayor complejidad operativa inicial (observabilidad de sync y tareas de indexacion).
- Necesidad de versionar settings de relevancia en Meilisearch.

## Implementación

1. Definir contrato de documento de busqueda (search document contract) versionado.
2. Implementar proyeccion desde Neon de contenido publicado/vigente.
3. Implementar sincronizacion incremental por `updated_at` y manejo de bajas/despublicaciones.
4. Registrar metricas de calidad de busqueda (`no_results_rate`, latencia, CTR top result).
5. Mantener endpoints de detalle apoyados en Neon para trazabilidad completa.

## Alternativas consideradas

1. **Solo Neon (sin indice dedicado)**  
   Rechazada por menor rendimiento y peor experiencia de busqueda a escala.

2. **Solo Meilisearch (sin base relacional canonica)**  
   Rechazada por falta de gobernanza editorial relacional y trazabilidad fuerte como sistema de registro.

3. **Chatbot generativo como fuente principal de respuesta**  
   Rechazada por riesgo de respuestas no verificables en contexto institucional critico.

