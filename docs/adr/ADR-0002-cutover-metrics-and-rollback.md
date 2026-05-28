# ADR-0002: Métricas de corte gradual y plan de rollback

- Estado: Aprobado
- Fecha: 2026-05-27
- Decisores: Equipo Atenea KB

## Contexto

La migración al modelo perfilado se ejecuta en modo dual-read para evitar ruptura operativa.
Se requiere un criterio objetivo para avanzar o revertir por fase.

## Decisión

Se adopta un control de calidad por métricas operativas con umbrales de corte.

## Métricas obligatorias

1. `no_results_rate` por sección (`services_incidents`, `documentation`).
2. Latencia `p95` de `POST /api/search-services`.
3. Cobertura de audiencia:
   - `% items con audience explícita`
   - `% items servidos por fallback general`
4. Tasa de error 5xx del endpoint.

## Umbrales de avance

- `no_results_rate` no supera +10% del baseline por 24h.
- `p95` no supera +20% del baseline por 24h.
- Cobertura explícita de audiencia en operativo >= 90%.
- Error 5xx < 1%.

## Rollback

Si cualquiera de los umbrales falla:

1. Forzar `uiSection=services_incidents` a comportamiento previo (`faq` puro, sin prioridad de audiencia).
2. Desactivar temporalmente filtros `profileCode/profileTypeCode`.
3. Reindexar proyección de búsqueda desde snapshot estable.
4. Abrir incidente de datos para corregir mapeo de audiencias.

## Consultas de control sugeridas

```sql
-- Cobertura de audiencias en operativo actual (faq)
select
  count(*) as total_items,
  count(*) filter (
    where exists (
      select 1
      from knowledge_item_audiences kia
      where kia.knowledge_item_id = ki.id
    )
  ) as items_with_audience
from knowledge_items ki
where ki.section_code = 'faq';
```

```sql
-- Mezcla por sección
select section_code, count(*)
from knowledge_items
group by section_code
order by 2 desc;
```
