#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-apply}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required but not installed or not in PATH." >&2
  exit 1
fi

run_psql_file() {
  local file="$1"
  if [[ ! -f "${file}" ]]; then
    echo "SQL file not found: ${file}" >&2
    exit 1
  fi
  psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${file}"
}

if [[ "${MODE}" == "fresh" ]]; then
  echo "Resetting mutable data (fresh seed mode)..."
  psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 <<'SQL'
begin;
truncate table
  canonical_origin_links,
  source_records,
  calendar_event_attachments,
  calendar_event_student_types,
  calendar_event_modalities,
  calendar_event_cycles,
  calendar_events,
  calendars,
  knowledge_item_attachments,
  knowledge_item_responsibles,
  knowledge_item_versions,
  knowledge_items,
  kb_elements,
  kb_subcategories,
  kb_categories,
  knowledge_item_services,
  cross_relations,
  service_variant_attachments,
  service_variant_student_types,
  service_variant_modalities,
  service_variant_cycles,
  service_variants,
  services,
  service_categories,
  attachments,
  responsibles,
  cycle_periods,
  modalities,
  student_types,
  source_connectors
restart identity cascade;
commit;
SQL
fi

echo "Applying migrations..."
bash "${ROOT_DIR}/scripts/db-migrate.sh" apply

echo "Re-applying reference seeds..."
run_psql_file "${ROOT_DIR}/db/migrations/0002_seed_reference_data.sql"
run_psql_file "${ROOT_DIR}/db/migrations/0003_seed_kb_taxonomy_bootstrap.sql"
run_psql_file "${ROOT_DIR}/db/migrations/0005_seed_profile_catalog.sql"

echo "Loading FAQ XLSX canonical seed..."
python3 "${ROOT_DIR}/scripts/etl_faq_xlsx_to_canonical.py" --apply

echo "Loading manual calendar canonical seed..."
python3 "${ROOT_DIR}/scripts/etl_calendar_json_to_canonical.py" --apply

if [[ -n "${MICROSOFT_CALENDAR_API_URL:-}" || -n "${MICROSOFT_CALENDAR_INPUT_JSON:-}" ]]; then
  echo "Loading Microsoft calendar canonical seed..."
  if [[ -n "${MICROSOFT_CALENDAR_INPUT_JSON:-}" ]]; then
    python3 "${ROOT_DIR}/scripts/etl_microsoft_calendar_to_canonical.py" --apply --input-json "${MICROSOFT_CALENDAR_INPUT_JSON}"
  else
    python3 "${ROOT_DIR}/scripts/etl_microsoft_calendar_to_canonical.py" --apply --url "${MICROSOFT_CALENDAR_API_URL}"
  fi
else
  echo "Skipping Microsoft calendar seed (set MICROSOFT_CALENDAR_API_URL or MICROSOFT_CALENDAR_INPUT_JSON to include it)."
fi

echo "Seed completed. Current high-level counts:"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -At <<'SQL'
select 'knowledge_items', count(*) from knowledge_items;
select 'knowledge_item_versions', count(*) from knowledge_item_versions;
select 'calendars', count(*) from calendars;
select 'calendar_events', count(*) from calendar_events;
select 'source_records', count(*) from source_records;
select 'origin_links', count(*) from canonical_origin_links;
SQL
