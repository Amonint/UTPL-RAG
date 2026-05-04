#!/usr/bin/env python3
"""
Descarga todos los PDFs encontrados dentro de un archivo JSON.

Uso:
  python descargar_pdfs_json.py
  python descargar_pdfs_json.py --json servicios_utpl_jerarquico.json --out carpeta_pdfs
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


PDF_URL_RE = re.compile(r"^https?://.+\.pdf(?:\?.*)?$", re.IGNORECASE)


def extraer_pdfs(obj: Any) -> set[str]:
    """Recorre recursivamente el JSON y devuelve URLs de PDF únicas."""
    encontrados: set[str] = set()

    if isinstance(obj, dict):
        for valor in obj.values():
            encontrados.update(extraer_pdfs(valor))
    elif isinstance(obj, list):
        for item in obj:
            encontrados.update(extraer_pdfs(item))
    elif isinstance(obj, str):
        texto = obj.strip()
        if PDF_URL_RE.match(texto):
            encontrados.add(texto)

    return encontrados


def nombre_archivo_desde_url(url: str) -> str:
    """Genera nombre de archivo legible y seguro a partir de la URL."""
    path = urllib.parse.urlparse(url).path
    nombre = Path(path).name or "archivo.pdf"
    nombre = urllib.parse.unquote(nombre)
    # Limpieza mínima para nombres compatibles.
    nombre = re.sub(r"[^\w.\- ]+", "_", nombre, flags=re.UNICODE).strip()
    if not nombre.lower().endswith(".pdf"):
        nombre = f"{nombre}.pdf"
    return nombre or "archivo.pdf"


def resolver_colision(path: Path) -> Path:
    """Si el archivo existe, crea un nombre incremental."""
    if not path.exists():
        return path

    base = path.stem
    suffix = path.suffix
    i = 1
    while True:
        candidato = path.with_name(f"{base}_{i}{suffix}")
        if not candidato.exists():
            return candidato
        i += 1


def normalizar_url(url: str) -> str:
    """Codifica caracteres inválidos (espacios, tildes, etc.) en la URL."""
    partes = urllib.parse.urlsplit(url.strip())
    path = urllib.parse.quote(urllib.parse.unquote(partes.path), safe="/%")
    query = urllib.parse.quote_plus(urllib.parse.unquote_plus(partes.query), safe="=&%")
    return urllib.parse.urlunsplit((partes.scheme, partes.netloc, path, query, partes.fragment))


def descargar(url: str, destino: Path, timeout: int = 30) -> None:
    """Descarga una URL y la guarda en destino."""
    url_final = normalizar_url(url)
    with urllib.request.urlopen(url_final, timeout=timeout) as resp:
        contenido = resp.read()
    destino.write_bytes(contenido)


def main() -> int:
    parser = argparse.ArgumentParser(description="Descargar todos los PDFs de un JSON.")
    parser.add_argument(
        "--json",
        default="servicios_utpl_jerarquico.json",
        help="Ruta al archivo JSON (por defecto: servicios_utpl_jerarquico.json).",
    )
    parser.add_argument(
        "--out",
        default="pdfs_descargados",
        help="Carpeta destino para PDFs (por defecto: pdfs_descargados).",
    )
    args = parser.parse_args()

    json_path = Path(args.json).expanduser().resolve()
    out_dir = Path(args.out).expanduser().resolve()

    if not json_path.exists():
        print(f"ERROR: no existe el archivo JSON: {json_path}")
        return 1

    try:
        data = json.loads(json_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"ERROR: JSON inválido: {exc}")
        return 1

    urls = sorted(extraer_pdfs(data))
    if not urls:
        print("No se encontraron URLs de PDF en el JSON.")
        return 0

    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"PDFs únicos encontrados: {len(urls)}")
    print(f"Carpeta de salida: {out_dir}")

    ok = 0
    fail = 0

    for idx, url in enumerate(urls, start=1):
        nombre = nombre_archivo_desde_url(url)
        destino = resolver_colision(out_dir / nombre)
        try:
            descargar(url, destino)
            ok += 1
            print(f"[{idx}/{len(urls)}] OK   {destino.name}")
        except Exception as exc:  # noqa: BLE001
            fail += 1
            print(f"[{idx}/{len(urls)}] FAIL {url} -> {exc}")

    print(f"\nCompletado. Exitosos: {ok}, Fallidos: {fail}")
    return 0 if fail == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
