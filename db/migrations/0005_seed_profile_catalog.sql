insert into profile_catalog (code, name, sort_order, is_active)
values
  ('student', 'Estudiante', 10, true),
  ('administrative_staff', 'Personal administrativo', 20, true),
  ('teacher', 'Docente', 30, true),
  ('applicant', 'Postulante', 40, true),
  ('alumni', 'Alumni', 50, true)
on conflict (code) do update
set
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

insert into profile_type_catalog (profile_code, type_code, name, sort_order, is_active)
values
  ('student', 'presencial', 'Presencial', 10, true),
  ('student', 'en_linea', 'En línea', 20, true),
  ('student', 'distancia', 'Distancia', 30, true),
  ('student', 'hibrida', 'Híbrida', 40, true),
  ('student', 'sin_tipo', 'Sin tipo', 50, true),
  ('administrative_staff', 'soporte', 'Soporte', 10, true),
  ('administrative_staff', 'gestion', 'Gestión', 20, true),
  ('teacher', 'grado', 'Docencia de grado', 10, true),
  ('teacher', 'posgrado', 'Docencia de posgrado', 20, true),
  ('applicant', 'general', 'General', 10, true),
  ('alumni', 'general', 'General', 10, true)
on conflict (profile_code, type_code) do update
set
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

-- Backfill seguro: el contenido operativo actual (faq) aplica por defecto a perfil estudiante.
insert into knowledge_item_audiences (knowledge_item_id, profile_code, profile_type_id, priority)
select
  ki.id,
  'student',
  pt.id,
  100
from knowledge_items ki
join profile_type_catalog pt
  on pt.profile_code = 'student'
 and pt.type_code = 'sin_tipo'
where ki.section_code = 'faq'
on conflict do nothing;

insert into schema_migrations (version, name)
values ('0005', 'seed_profile_catalog')
on conflict (version) do nothing;
