#!/usr/bin/env python3
"""
ETL SID Data -> conocimiento canónico (sección general_info).

Uso:
  DATABASE_URL=... python3 scripts/etl_sid_data_to_canonical.py --input data/sid-data.json --dry-run
  DATABASE_URL=... python3 scripts/etl_sid_data_to_canonical.py --input data/sid-data.csv --apply
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import psycopg
from psycopg.types.json import Json


def slugify(value: str) -> str:
    text = unicodedata.normalize("NFKD", value or "")
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-{2,}", "-", text).strip("-")
    return text or "item"


def split_multi(value: str | None) -> list[str]:
    if not value:
        return []
    return [v.strip() for v in re.split(r"[\n,;]+", value) if v and v.strip()]


def sha1_hex(value: str) -> str:
    return hashlib.sha1(value.encode("utf-8")).hexdigest()


@dataclass
class SidRow:
    external_id: str
    domain_code: str
    category: str
    subcategory: str
    element: str
    title: str
    question: str
    answer: str
    forms: list[str]
    phrases: list[str]
    synonyms: list[str]
    responsible: str
    profile_code: str | None
    profile_type_code: str | None
    source_payload: dict[str, Any]

    @property
    def item_slug(self) -> str:
        seed = self.question or self.title or self.element
        digest = sha1_hex(f"{self.domain_code}|{self.category}|{self.subcategory}|{seed}")[:10]
        return f"{slugify(seed)}-{digest}"


def normalize_domain(value: str) -> str:
    raw = (value or "").strip().lower()
    aliases = {
        "academico": "academic",
        "academic": "academic",
        "financiero": "financial",
        "financial": "financial",
        "lengua-extranjera": "foreign_language",
        "foreign_language": "foreign_language",
        "calendarios": "calendar",
        "calendar": "calendar",
        "servicios": "services",
        "services": "services",
    }
    return aliases.get(slugify(raw), "academic")


def from_json(path: Path) -> list[SidRow]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("SID JSON debe ser una lista de objetos")
    rows: list[SidRow] = []
    for idx, raw in enumerate(data, start=1):
        if not isinstance(raw, dict):
            continue
        category = str(raw.get("category", "")).strip() or "General"
        subcategory = str(raw.get("subcategory", "")).strip() or "General"
        element = str(raw.get("element", "")).strip() or subcategory
        question = str(raw.get("question", "")).strip()
        answer = str(raw.get("answer", "")).strip()
        title = str(raw.get("title", "")).strip() or question or element
        if not question and not answer:
            continue
        rows.append(
            SidRow(
                external_id=str(raw.get("external_id", f"sid-{idx}")),
                domain_code=normalize_domain(str(raw.get("domain", "academic"))),
                category=category,
                subcategory=subcategory,
                element=element,
                title=title,
                question=question,
                answer=answer,
                forms=split_multi(raw.get("forms") if isinstance(raw.get("forms"), str) else None),
                phrases=split_multi(raw.get("phrases") if isinstance(raw.get("phrases"), str) else None),
                synonyms=split_multi(raw.get("synonyms") if isinstance(raw.get("synonyms"), str) else None),
                responsible=str(raw.get("responsible", "")).strip(),
                profile_code=(str(raw.get("profile_code", "")).strip().lower() or None),
                profile_type_code=(str(raw.get("profile_type_code", "")).strip().lower() or None),
                source_payload=raw,
            )
        )
    return rows


def from_csv(path: Path) -> list[SidRow]:
    with path.open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        rows: list[SidRow] = []
        for idx, raw in enumerate(reader, start=1):
            category = (raw.get("category") or "").strip() or "General"
            subcategory = (raw.get("subcategory") or "").strip() or "General"
            element = (raw.get("element") or "").strip() or subcategory
            question = (raw.get("question") or "").strip()
            answer = (raw.get("answer") or "").strip()
            title = (raw.get("title") or "").strip() or question or element
            if not question and not answer:
                continue
            rows.append(
                SidRow(
                    external_id=(raw.get("external_id") or f"sid-{idx}").strip(),
                    domain_code=normalize_domain(raw.get("domain") or "academic"),
                    category=category,
                    subcategory=subcategory,
                    element=element,
                    title=title,
                    question=question,
                    answer=answer,
                    forms=split_multi(raw.get("forms")),
                    phrases=split_multi(raw.get("phrases")),
                    synonyms=split_multi(raw.get("synonyms")),
                    responsible=(raw.get("responsible") or "").strip(),
                    profile_code=((raw.get("profile_code") or "").strip().lower() or None),
                    profile_type_code=((raw.get("profile_type_code") or "").strip().lower() or None),
                    source_payload={k: v for k, v in raw.items()},
                )
            )
        return rows


def load_rows(input_path: Path) -> list[SidRow]:
    if input_path.suffix.lower() == ".json":
        return from_json(input_path)
    return from_csv(input_path)


def ensure_sid_source_connector(cur: psycopg.Cursor[Any]) -> None:
    cur.execute(
        """
        insert into source_connectors (code, name, connector_type, is_active)
        values ('sid_data', 'SID Data', 'file', true)
        on conflict (code) do update
          set name = excluded.name,
              connector_type = excluded.connector_type,
              is_active = excluded.is_active,
              updated_at = now()
        """
    )


def upsert_rows(cur: psycopg.Cursor[Any], rows: list[SidRow]) -> None:
    for row in rows:
        category_slug = slugify(row.category)
        sub_slug = slugify(row.subcategory)
        element_slug = slugify(row.element)

        cur.execute(
            """
            insert into kb_categories (domain_id, name, slug, description, sort_order, is_active)
            select d.id, %s, %s, null, 1000, true
            from domains d where d.code = %s
            on conflict (domain_id, slug) do update
              set name = excluded.name, updated_at = now()
            """,
            (row.category, category_slug, row.domain_code),
        )
        cur.execute(
            """
            insert into kb_subcategories (kb_category_id, name, slug, description, sort_order, is_active)
            select c.id, %s, %s, null, 1000, true
            from kb_categories c
            join domains d on d.id = c.domain_id
            where c.slug = %s and d.code = %s
            on conflict (kb_category_id, slug) do update
              set name = excluded.name, updated_at = now()
            """,
            (row.subcategory, sub_slug, category_slug, row.domain_code),
        )
        cur.execute(
            """
            insert into kb_elements (kb_subcategory_id, name, slug, description, element_type, is_active)
            select sc.id, %s, %s, null, 'documentation', true
            from kb_subcategories sc
            join kb_categories c on c.id = sc.kb_category_id
            join domains d on d.id = c.domain_id
            where sc.slug = %s and c.slug = %s and d.code = %s
            on conflict (kb_subcategory_id, slug) do update
              set name = excluded.name, updated_at = now()
            """,
            (row.element, element_slug, sub_slug, category_slug, row.domain_code),
        )

        cur.execute(
            """
            insert into knowledge_items (
              kb_element_id, domain_id, section_code, canonical_slug, title,
              ingestion_status, editorial_status, review_policy, is_active
            )
            select
              e.id, d.id, 'general_info', %s, %s,
              'processed', 'ingest_draft', null, true
            from kb_elements e
            join kb_subcategories sc on sc.id = e.kb_subcategory_id
            join kb_categories c on c.id = sc.kb_category_id
            join domains d on d.id = c.domain_id
            where e.slug = %s and sc.slug = %s and c.slug = %s and d.code = %s
            on conflict (kb_element_id, canonical_slug) do update
              set title = excluded.title,
                  ingestion_status = excluded.ingestion_status,
                  updated_at = now()
            returning id
            """,
            (row.item_slug, row.title, element_slug, sub_slug, category_slug, row.domain_code),
        )
        knowledge_item_id = cur.fetchone()[0]

        cur.execute("select coalesce(max(version_number), 0) + 1 from knowledge_item_versions where knowledge_item_id = %s", (knowledge_item_id,))
        next_version = cur.fetchone()[0]

        cur.execute(
            """
            insert into knowledge_item_versions (
              knowledge_item_id, version_number, question_text, answer_text,
              search_forms_json, phrases_json, synonyms_json, change_summary
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                knowledge_item_id,
                next_version,
                row.question or None,
                row.answer or None,
                Json(row.forms),
                Json(row.phrases),
                Json(row.synonyms),
                "SID Data ingest",
            ),
        )

        cur.execute(
            """
            insert into source_records (
              source_connector_id, external_id, source_location, payload_hash, payload_json, fetched_at, processed_at
            )
            select sc.id, %s, %s, %s, %s, now(), now()
            from source_connectors sc
            where sc.code = 'sid_data'
            on conflict (source_connector_id, external_id, payload_hash) do update
              set payload_json = excluded.payload_json,
                  processed_at = excluded.processed_at
            returning id
            """,
            (
                row.external_id,
                "sid_data",
                sha1_hex(json.dumps(row.source_payload, sort_keys=True, ensure_ascii=False)),
                Json(row.source_payload),
            ),
        )
        source_record_id = cur.fetchone()[0]

        cur.execute(
            """
            insert into canonical_origin_links (entity_type, entity_id, source_record_id, link_role, is_primary)
            values ('knowledge_item', %s, %s, 'source', true)
            on conflict (entity_type, entity_id, source_record_id, link_role) do nothing
            """,
            (knowledge_item_id, source_record_id),
        )

        if row.profile_code:
            requested_type = row.profile_type_code or "sin_tipo"
            cur.execute(
                """
                insert into knowledge_item_audiences (knowledge_item_id, profile_code, profile_type_id, priority)
                values (
                  %s,
                  %s,
                  (
                    select pt.id
                    from profile_type_catalog pt
                    where pt.profile_code = %s and pt.type_code = %s
                    limit 1
                  ),
                  100
                )
                on conflict do nothing
                """,
                (
                    knowledge_item_id,
                    row.profile_code,
                    row.profile_code,
                    requested_type,
                ),
            )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="ETL SID Data a sección general_info")
    parser.add_argument("--input", required=True, help="Ruta SID Data (.json o .csv)")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--apply", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    input_path = Path(args.input).expanduser().resolve()
    if not input_path.exists():
        raise FileNotFoundError(f"No existe el archivo SID Data: {input_path}")

    rows = load_rows(input_path)
    print(f"SID rows candidatas: {len(rows)}")
    if args.dry_run:
        print("Dry-run: no se aplicaron cambios.")
        return

    database_url = os.environ.get("DATABASE_URL", "").strip()
    if not database_url:
        raise RuntimeError("DATABASE_URL es requerido para --apply")

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            ensure_sid_source_connector(cur)
            upsert_rows(cur, rows)
        conn.commit()
    print("ETL SID completado.")


if __name__ == "__main__":
    main()
