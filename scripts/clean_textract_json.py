#!/usr/bin/env python3
"""Convert Textract raw JSON files into clean UTF-8 TXT files."""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from typing import Any


DEFAULT_INPUT_DIR = "~/Desktop/UTPL RAG/data/derived/textract-raw"
DEFAULT_OUTPUT_DIR = "~/Desktop/UTPL RAG/data/derived/textract-clean"


def _bbox_order(block: dict[str, Any]) -> tuple[float, float]:
    geometry = block.get("Geometry") or {}
    bbox = geometry.get("BoundingBox") or {}
    top = float(bbox.get("Top", 0.0) or 0.0)
    left = float(bbox.get("Left", 0.0) or 0.0)
    return (top, left)


def _page_number(block: dict[str, Any]) -> int:
    page = block.get("Page")
    if isinstance(page, int) and page > 0:
        return page
    return 1


def _collect_relationship_ids(block: dict[str, Any], rel_type: str) -> list[str]:
    out: list[str] = []
    for rel in block.get("Relationships") or []:
        if rel.get("Type") != rel_type:
            continue
        for rel_id in rel.get("Ids") or []:
            if isinstance(rel_id, str):
                out.append(rel_id)
    return out


def _build_cell_text(cell_block: dict[str, Any], blocks_by_id: dict[str, dict[str, Any]]) -> str:
    words: list[str] = []
    for child_id in _collect_relationship_ids(cell_block, "CHILD"):
        child = blocks_by_id.get(child_id)
        if not child:
            continue
        if child.get("BlockType") != "WORD":
            continue
        text = child.get("Text")
        if isinstance(text, str) and text:
            words.append(text)
    return " ".join(words)


def _render_table(
    table_block: dict[str, Any],
    blocks_by_id: dict[str, dict[str, Any]],
) -> list[str]:
    table_cell_ids = _collect_relationship_ids(table_block, "CHILD")
    cell_blocks = [
        blocks_by_id[cell_id]
        for cell_id in table_cell_ids
        if cell_id in blocks_by_id and blocks_by_id[cell_id].get("BlockType") == "CELL"
    ]

    if not cell_blocks:
        return []

    max_row = max(int(cell.get("RowIndex", 0) or 0) for cell in cell_blocks)
    max_col = max(int(cell.get("ColumnIndex", 0) or 0) for cell in cell_blocks)
    if max_row <= 0 or max_col <= 0:
        return []

    grid_text = [["" for _ in range(max_col)] for _ in range(max_row)]
    row_flags: dict[int, dict[str, bool]] = defaultdict(lambda: {"header": False, "section": False})

    for cell in cell_blocks:
        row = int(cell.get("RowIndex", 0) or 0)
        col = int(cell.get("ColumnIndex", 0) or 0)
        if row <= 0 or col <= 0:
            continue
        text = _build_cell_text(cell, blocks_by_id)
        grid_text[row - 1][col - 1] = text

        entity_types = cell.get("EntityTypes") or []
        if "COLUMN_HEADER" in entity_types:
            row_flags[row]["header"] = True
        if "TABLE_SECTION_TITLE" in entity_types:
            row_flags[row]["section"] = True

    rendered: list[str] = []
    for row_idx, row_values in enumerate(grid_text, start=1):
        flags = row_flags[row_idx]
        if flags["header"]:
            rendered.append(f"HEADER: {' | '.join(row_values)}")
            continue
        if flags["section"]:
            first_non_empty = next((value for value in row_values if value.strip()), "")
            rendered.append(f"## {first_non_empty}".rstrip())
            continue
        rendered.append(" | ".join(row_values))
    return rendered


def _document_metadata(doc: dict[str, Any], json_path: Path) -> tuple[str, str, Any]:
    local_path = doc.get("localPath")
    relative_path = doc.get("relativePath")

    archivo: str
    if isinstance(local_path, str) and local_path.strip():
        archivo = Path(local_path).name
    elif isinstance(relative_path, str) and relative_path.strip():
        archivo = Path(relative_path).name
    else:
        archivo = json_path.name

    if isinstance(relative_path, str):
        ruta = relative_path
    elif isinstance(local_path, str):
        ruta = local_path
    else:
        ruta = ""

    return archivo, ruta, doc.get("bytes")


def process_textract_file(json_path: Path, output_dir: Path) -> tuple[int, int]:
    with json_path.open("r", encoding="utf-8") as handle:
        doc = json.load(handle)

    blocks = doc.get("blocks") or []
    blocks_by_id: dict[str, dict[str, Any]] = {}
    for block in blocks:
        block_id = block.get("Id")
        if isinstance(block_id, str):
            blocks_by_id[block_id] = block

    cell_child_ids: set[str] = set()
    for block in blocks:
        if block.get("BlockType") != "CELL":
            continue
        for child_id in _collect_relationship_ids(block, "CHILD"):
            cell_child_ids.add(child_id)

    free_lines = [
        block
        for block in blocks
        if block.get("BlockType") == "LINE" and block.get("Id") not in cell_child_ids
    ]
    free_lines.sort(key=lambda item: (_page_number(item),) + _bbox_order(item))

    tables = [block for block in blocks if block.get("BlockType") == "TABLE"]
    tables.sort(key=lambda item: (_page_number(item),) + _bbox_order(item))

    pages: set[int] = set()
    for block in blocks:
        if block.get("BlockType") == "PAGE":
            pages.add(_page_number(block))
    for line in free_lines:
        pages.add(_page_number(line))
    for table in tables:
        pages.add(_page_number(table))
    sorted_pages = sorted(pages or {1})

    lines_by_page: dict[int, list[str]] = defaultdict(list)
    for line_block in free_lines:
        page = _page_number(line_block)
        text = line_block.get("Text")
        if isinstance(text, str) and text:
            lines_by_page[page].append(text)

    tables_by_page: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for table_block in tables:
        tables_by_page[_page_number(table_block)].append(table_block)

    file_lines: list[str] = []
    archivo, ruta, doc_bytes = _document_metadata(doc, json_path)
    file_lines.append("[METADATA]")
    file_lines.append(f"archivo: {archivo}")
    file_lines.append(f"ruta: {ruta}")
    file_lines.append(f"bytes: {doc_bytes}")
    file_lines.append("")

    table_number = 0
    for page in sorted_pages:
        file_lines.append(f"=== PÁGINA {page} ===")
        file_lines.append("[TEXTO LIBRE]")
        file_lines.extend(lines_by_page.get(page, []))

        for table_block in tables_by_page.get(page, []):
            table_number += 1
            file_lines.append(f"[TABLA {table_number}]")
            rendered_rows = _render_table(table_block, blocks_by_id)
            if rendered_rows:
                file_lines.extend(rendered_rows)
        file_lines.append("")

    output_path = output_dir / f"{json_path.stem}.txt"
    output_path.write_text("\n".join(file_lines).rstrip() + "\n", encoding="utf-8")

    return (table_number, len(free_lines))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Procesa JSON Textract crudo y genera TXT limpio por archivo."
    )
    parser.add_argument(
        "--input-dir",
        default=DEFAULT_INPUT_DIR,
        help=f"Directorio de entrada (default: {DEFAULT_INPUT_DIR})",
    )
    parser.add_argument(
        "--output-dir",
        default=DEFAULT_OUTPUT_DIR,
        help=f"Directorio de salida (default: {DEFAULT_OUTPUT_DIR})",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    input_dir = Path(args.input_dir).expanduser()
    output_dir = Path(args.output_dir).expanduser()

    if not input_dir.exists() or not input_dir.is_dir():
        raise SystemExit(f"Directorio de entrada no válido: {input_dir}")

    output_dir.mkdir(parents=True, exist_ok=True)

    processed = 0
    total_tables = 0
    total_free_text_blocks = 0

    for json_path in sorted(input_dir.iterdir()):
        if not json_path.is_file():
            continue
        if json_path.name == "manifest.json":
            continue
        if json_path.suffix.lower() != ".json":
            continue

        try:
            file_tables, free_blocks = process_textract_file(json_path, output_dir)
        except json.JSONDecodeError as exc:
            print(f"Saltando {json_path.name}: JSON inválido ({exc})")
            continue
        except Exception as exc:  # noqa: BLE001
            print(f"Saltando {json_path.name}: error inesperado ({exc})")
            continue

        processed += 1
        total_tables += file_tables
        total_free_text_blocks += free_blocks

    print(f"Total de archivos procesados: {processed}")
    print(f"Total de tablas encontradas: {total_tables}")
    print(f"Total de bloques de texto libre encontrados: {total_free_text_blocks}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
