create table persons (
  id uuid primary key default gen_random_uuid(),
  external_ref text unique,
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table profile_catalog (
  code text primary key,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table profile_type_catalog (
  id uuid primary key default gen_random_uuid(),
  profile_code text not null references profile_catalog(code),
  type_code text not null,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_code, type_code)
);

create table person_profiles (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references persons(id) on delete cascade,
  profile_code text not null references profile_catalog(code),
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, profile_code)
);

create unique index person_profiles_one_primary
  on person_profiles (person_id)
  where is_primary;

create table person_profile_types (
  person_profile_id uuid not null references person_profiles(id) on delete cascade,
  profile_type_id uuid not null references profile_type_catalog(id),
  created_at timestamptz not null default now(),
  primary key (person_profile_id, profile_type_id)
);

create table knowledge_item_audiences (
  knowledge_item_id uuid not null references knowledge_items(id) on delete cascade,
  profile_code text not null references profile_catalog(code),
  profile_type_id uuid references profile_type_catalog(id),
  priority integer not null default 100,
  created_at timestamptz not null default now(),
  primary key (knowledge_item_id, profile_code, profile_type_id)
);

create table service_variant_audiences (
  service_variant_id uuid not null references service_variants(id) on delete cascade,
  profile_code text not null references profile_catalog(code),
  profile_type_id uuid references profile_type_catalog(id),
  priority integer not null default 100,
  created_at timestamptz not null default now(),
  primary key (service_variant_id, profile_code, profile_type_id)
);

create index knowledge_item_audiences_item_idx
  on knowledge_item_audiences (knowledge_item_id);
create index knowledge_item_audiences_profile_idx
  on knowledge_item_audiences (profile_code, profile_type_id);
create index service_variant_audiences_variant_idx
  on service_variant_audiences (service_variant_id);
create index service_variant_audiences_profile_idx
  on service_variant_audiences (profile_code, profile_type_id);
create index profile_type_catalog_profile_idx
  on profile_type_catalog (profile_code, type_code);
create index person_profiles_person_idx
  on person_profiles (person_id, profile_code);

insert into schema_migrations (version, name)
values ('0004', 'persona_profile_audience')
on conflict (version) do nothing;
