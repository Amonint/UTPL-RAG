"""
Generador de JSON jerárquico — Servicios Estudiantiles UTPL
Fuente directa: https://portales.utpl.edu.ec/servicios-academicos
Genera: servicios_utpl_jerarquico.json

FIXES aplicados:
  1. get_strong_label() ahora busca <strong> dentro de <span> también
  2. SOLICITUD/RESPUESTA se detectan en <li> además de <p>
  3. Períodos sin <hr> entre ellos se detectan por <p><strong> con keyword de período
  4. Bloques <style>, <script>, inputs radio se eliminan antes de parsear
  5. Requisitos con pestañas (CSS :has + radios): no mezclar <li> de todos los paneles;
     extraer PDFs en campo "pdf"; aplica a prácticum, retiros, etc.
  6. Si field_tipo_estudiante viene vacío en el API, el servicio se asigna a SIN_TIPO_EN_API
     (evita perder filas en el JSON).
  7. Bloques «Calendario» con acordeón de facultades: no tomar NOTA/h5/div.accordion como modalidades.
  8. Clasificación por <p> con <strong> recupera costo/tiempo/modalidad mezclados en un bloque.
  9. Filtra ruido Drupal (disableblock, encabezados «SERVICIOS DE …») y metadata para RAG.
"""

import json
import re
import requests
from collections import defaultdict
from bs4 import BeautifulSoup, NavigableString, Comment

# ── Endpoint ─────────────────────────────────────────────────────────────────
URL = "https://portales.utpl.edu.ec/servicios-academicos"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
    "Referer": "https://portales.utpl.edu.ec/servicios",
}

# ── Etiquetas de sección ──────────────────────────────────────────────────────
LABELS_DESCRIPCION = {"descripción", "descripcion"}
LABELS_MODALIDAD   = {"modalidad y nivel de estudio", "modalidad y nivel de estudios"}
LABELS_TIEMPO      = {"tiempo de respuesta"}
LABELS_REQUISITOS  = {"requisitos", "requisito"}
LABELS_COSTO       = {"costo"}
LABELS_MANUAL      = {"manual"}
LABELS_NOTA        = {"nota"}
LABELS_IMPORTANTE  = {"importante", "información", "aplica"}
LABELS_SOLICITUD   = {"solicitud", "enviar"}
LABELS_RESPUESTA   = {"respuesta"}

PERIODO_KEYWORDS = {
    "periodo", "período", "calendar", "ciclo", "acad"
}

# Cuando el API no asigna tipo de estudiante (campo vacío)
TIPO_ESTUDIANTE_FALLBACK = "SIN_TIPO_EN_API"

# Encabezados-fantasma del CMS (no son servicios útiles)
RUIDO_NOMBRE_RX = re.compile(r"^[\W_]*SERVICIOS\s+DE\b", re.I)

# Párrafos cuyo <strong> no debe mezclarse en el texto de «Descripción»
_SKIP_DESCR_P = (
    LABELS_MODALIDAD | LABELS_TIEMPO | LABELS_COSTO | LABELS_NOTA
    | LABELS_MANUAL | LABELS_REQUISITOS | LABELS_IMPORTANTE
)


# ─────────────────────────────────────────────────────────────────────────────
# Utilidades
# ─────────────────────────────────────────────────────────────────────────────

def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _texto_util(s: str | None) -> bool:
    """False si el texto es vacío o solo puntuación típica de maquetación Drupal."""
    if not s:
        return False
    t = s.strip().strip(":\xa0 ")
    return bool(t) and t not in (":", ";", "-", "—")


def strip_noise(soup):
    """Elimina <style>, <script>, inputs, comentarios HTML del soup."""
    for tag in soup.find_all(["style", "script", "input"]):
        tag.decompose()
    for comment in soup.find_all(string=lambda t: isinstance(t, Comment)):
        comment.extract()
    return soup


def get_strong_label(tag) -> str:
    """
    FIX 1: busca <strong> directo O dentro de <span> para cubrir
    patrones como <p><span lang="ES-EC"><strong>Label:</strong></span></p>
    """
    s = tag.find("strong")
    if s:
        return clean(s.get_text())
    # Fallback: texto del primer <span> que contenga strong
    for span in tag.find_all("span"):
        s2 = span.find("strong")
        if s2:
            return clean(s2.get_text())
    return ""


def _value_after_strong_p(p) -> str | None:
    """Texto del <p> sin el <strong> inicial (copia del nodo, no muta el árbol padre)."""
    mini = BeautifulSoup(str(p), "html.parser")
    q = mini.find("p") or mini
    s = q.find("strong")
    if s:
        s.decompose()
    t = clean(q.get_text())
    return t or None


def _p_value_or_next_sibling(p) -> str | None:
    """
    Valor de un <p> con etiqueta <strong> cuando el texto útil está en el <p> siguiente
    (patrón Drupal: <p><span><strong>Costo</strong>:</span></p><p>$35.</p>).
    """
    v = _value_after_strong_p(p)
    if v:
        s = v.strip().strip(":\xa0 ")
        if s and s not in (":", ";", "-", "—"):
            return v
    for sib in p.find_next_siblings("p"):
        t = clean(sib.get_text())
        if t and t.strip().strip(":\xa0 ") not in ("", ":", ";"):
            return t
    return None


def _fill_from_paragraphs(bs, result: dict) -> None:
    """Extrae modalidad, tiempo, costo y nota de cada <p> con etiqueta <strong> (bloques mezclados / sin <hr>)."""
    for p in list(bs.find_all("p")):
        lbl = clean(get_strong_label(p)).lower().rstrip(":").strip()
        if not lbl:
            continue
        txt_low = clean(p.get_text()).lower()
        val = _p_value_or_next_sibling(p)

        if lbl in LABELS_MODALIDAD and not result.get("modalidad_nivel"):
            if val:
                result["modalidad_nivel"] = val

        elif lbl in LABELS_TIEMPO and not result.get("tiempo_respuesta"):
            if val:
                result["tiempo_respuesta"] = val

        elif lbl in LABELS_COSTO and not result.get("costo"):
            if "sin costo" in (lbl + " " + txt_low) or (val and "sin costo" in val.lower()):
                result["costo"] = "Sin costo"
            elif val:
                result["costo"] = val

        elif ("sin costo" in lbl or "sin costo" in txt_low) and not result.get("costo"):
            result["costo"] = "Sin costo"

        elif lbl in LABELS_NOTA and not result.get("nota"):
            if val:
                result["nota"] = val


def extract_links(tag) -> list:
    links = []
    for a in tag.find_all("a", href=True):
        href = a["href"]
        if not href.startswith("http"):
            href = "https://portales.utpl.edu.ec" + href
        links.append({"texto": clean(a.get_text()), "url": href})
    return links


def extract_imagen(soup) -> str | None:
    img = soup.find("img")
    if img and img.get("src"):
        src = img["src"]
        if not src.startswith("http"):
            src = "https://portales.utpl.edu.ec" + src
        return src
    return None


def is_periodo_label(text: str) -> bool:
    t = text.lower().strip()
    return any(kw in t for kw in PERIODO_KEYWORDS)


def extract_solicitud_respuesta_from_li(ul_tag):
    """
    FIX 2: extrae SOLICITUD/RESPUESTA de listas <ul><li><strong>SOLICITUD:...</strong>
    Retorna dict con claves opcionales 'solicitud', 'respuesta'.
    """
    result = {}
    for li in ul_tag.find_all("li", recursive=False):
        strong = li.find("strong")
        if not strong:
            continue
        label = clean(strong.get_text()).lower().rstrip(":")
        strong.decompose()
        value = clean(li.get_text())
        if any(label.startswith(k) for k in LABELS_SOLICITUD):
            result["solicitud"] = value
        elif any(label.startswith(k) for k in LABELS_RESPUESTA):
            result["respuesta"] = value
    return result


def _li_inside_tab_content(li) -> bool:
    """True si el <li> está dentro del panel de pestañas (evita mezclar tabs)."""
    for p in li.parents:
        if getattr(p, "name", None) == "div" and "tab-content" in (p.get("class") or []):
            return True
    return False


def _normalize_href(href: str) -> str:
    if not href:
        return ""
    href = href.strip()
    if href.startswith("http"):
        return href
    return "https://portales.utpl.edu.ec" + href


def _serialize_list_node(ul_or_ol) -> list:
    """Convierte <ul>/<ol> en lista de dicts (texto, pdf, titulo+items anidados)."""
    out = []
    for li in ul_or_ol.find_all("li", recursive=False):
        out.append(_li_to_structure(li))
    return out


def _li_to_structure(li) -> dict:
    strong = li.find("strong", recursive=False)
    nested = li.find(["ul", "ol"], recursive=False)
    link = li.find("a", href=True, recursive=False)

    if link is not None and nested is None:
        return {
            "texto": clean(link.get_text()),
            "pdf": _normalize_href(link["href"]),
        }

    if strong is not None and nested is not None:
        titulo = clean(strong.get_text()).rstrip(":").strip()
        return {"titulo": titulo, "items": _serialize_list_node(nested)}

    if nested is not None:
        return {"items": _serialize_list_node(nested)}

    return {"texto": clean(li.get_text())}


def _panel_to_fragments(panel) -> list:
    """Contenido de un panel de pestaña: <p> sueltos y listas en orden."""
    parts = []
    for ch in panel.children:
        name = getattr(ch, "name", None)
        if name in ("ul", "ol"):
            parts.append({"lista": _serialize_list_node(ch)})
        elif name == "p":
            t = clean(ch.get_text())
            if t:
                parts.append({"texto": t})
    return parts


def es_servicio_util(item: dict) -> bool:
    """True si la fila del API debe incluirse en el JSON (excluye ruido Drupal)."""
    nombre = (item.get("field_nombre_servicio") or "").strip()
    html = (item.get("field_descripcion_servicio") or "").strip()
    if not nombre or nombre.lower() == "disableblock":
        return False
    if RUIDO_NOMBRE_RX.match(nombre):
        return False
    text = re.sub(r"<[^>]+>", "", html).strip().strip(":\xa0 ").lower()
    if text in ("", "hello"):
        return bool(re.search(r"<a[^>]+href", html, re.I))
    return True


def _parse_requisitos_pestanas(bs) -> list | None:
    """
    FIX 5: HTML con .tab-content (varios servicios UTPL). Devuelve una lista
    ordenada de {pestaña, contenido} o None si no aplica.
    """
    tab_content = bs.find("div", class_="tab-content")
    if tab_content is None:
        return None

    container = tab_content.parent
    if container is None:
        return None

    tab_names: dict[int, str] = {}
    controls = container.find(class_="tab-controls")
    if controls:
        for lbl in controls.find_all("label", attrs={"for": True}):
            m = re.search(r"(\d+)$", lbl["for"])
            if m:
                tab_names[int(m.group(1))] = clean(lbl.get_text())

    pestañas: list[dict] = []
    for panel in tab_content.find_all("div", recursive=False):
        if getattr(panel, "name", None) != "div":
            continue
        pid = panel.get("id") or ""
        m = re.search(r"(\d+)\s*$", pid)
        if not m:
            continue
        idx = int(m.group(1))
        pestañas.append({
            "orden": idx,
            "pestaña": tab_names.get(idx, f"Pestaña {idx}"),
            "contenido": _panel_to_fragments(panel),
        })

    pestañas.sort(key=lambda x: x["orden"])
    for p in pestañas:
        del p["orden"]
    return pestañas or None


# ─────────────────────────────────────────────────────────────────────────────
# Parser de HTML de descripción
# ─────────────────────────────────────────────────────────────────────────────

def parse_descripcion_html(html: str) -> dict:
    if not html or not html.strip():
        return {}

    soup = BeautifulSoup(html, "html.parser")
    strip_noise(soup)   # FIX 4: elimina <style>, inputs, etc.

    result = {
        "imagen":           None,
        "descripcion":      None,
        "modalidad_nivel":  None,
        "tiempo_respuesta": None,
        "requisitos":       None,
        "costo":            None,
        "periodos":         [],
        "manual":           [],
        "nota":             None,
        "importante":       None,
    }

    result["imagen"] = extract_imagen(soup)

    # ── Dividir en bloques por <hr> ───────────────────────────────────────────
    bloques, bloque_actual = [], []
    for node in soup.children:
        name = getattr(node, "name", None)
        if name == "hr":
            if bloque_actual:
                bloques.append(bloque_actual)
                bloque_actual = []
        elif name or (isinstance(node, NavigableString) and node.strip()):
            bloque_actual.append(node)
    if bloque_actual:
        bloques.append(bloque_actual)

    for bloque in bloques:
        bloque_html = "".join(str(n) for n in bloque)
        bs = BeautifulSoup(bloque_html, "html.parser")
        strip_noise(bs)

        bloque_text = clean(bs.get_text(" "))
        label = clean(get_strong_label(bs)).lower().rstrip(":").strip()

        _fill_from_paragraphs(bs, result)

        # ── FIX 3: un bloque puede contener VARIOS períodos consecutivos ──────
        # Primero intentamos dividir el bloque internamente si detectamos
        # múltiples encabezados de período dentro del mismo bloque.
        periodo_ps = [
            p for p in bs.find_all("p")
            if is_periodo_label(clean(get_strong_label(p)).lower())
               and get_strong_label(p)  # tiene un strong con texto de período
        ]

        if len(periodo_ps) > 1 or (len(periodo_ps) == 1 and is_periodo_label(label)):
            # Tratar todo el bloque como zona de períodos
            _parse_periodo_block(bs, result)
            continue

        # ── Clasificar bloque por su label principal ──────────────────────────
        if label in LABELS_DESCRIPCION:
            partes = []
            for p in bs.find_all("p"):
                lbl_p = clean(get_strong_label(p)).lower().rstrip(":")
                if lbl_p in _SKIP_DESCR_P or lbl_p.startswith("sin costo"):
                    continue
                if lbl_p in LABELS_DESCRIPCION:
                    # quitar el strong-label pero conservar el resto del p
                    s = p.find("strong")
                    if s:
                        s.decompose()
                txt = clean(p.get_text())
                if txt:
                    partes.append(txt)
            result["descripcion"] = " ".join(partes) or bloque_text

        elif label in LABELS_MODALIDAD:
            p0 = bs.find("p")
            v = _p_value_or_next_sibling(p0) if p0 else None
            if v and _texto_util(v):
                result["modalidad_nivel"] = v

        elif label in LABELS_TIEMPO:
            # Mismo patrón que _fill: etiqueta en un <p> y valor en el siguiente (no mutar antes de leer).
            p0 = bs.find("p")
            v = _p_value_or_next_sibling(p0) if p0 else None
            if v and _texto_util(v):
                result["tiempo_respuesta"] = v

        elif label in LABELS_REQUISITOS:
            pestañas = _parse_requisitos_pestanas(bs)
            if pestañas is not None:
                # Listas generales fuera de los paneles (evita mezclar Distancia/Presencial/TEC)
                general = []
                for li in bs.find_all("li"):
                    if _li_inside_tab_content(li):
                        continue
                    if li.find(["ul", "ol"], recursive=False):
                        continue
                    t = clean(li.get_text())
                    if t:
                        general.append(t)
                result["requisitos"] = general or None
                result["requisitos_pestanas"] = pestañas
            else:
                items = bs.find_all("li")
                if items:
                    result["requisitos"] = [
                        clean(li.get_text()) for li in items if clean(li.get_text())
                    ]
                else:
                    p = bs.find("p")
                    if p:
                        s = p.find("strong")
                        if s:
                            s.decompose()
                        result["requisitos"] = clean(p.get_text()) or None

        elif label in LABELS_COSTO or "sin costo" in label or "sin costo" in bloque_text.lower():
            if "sin costo" in label or "sin costo" in bloque_text.lower():
                result["costo"] = "Sin costo"
            else:
                p0 = bs.find("p")
                v = _p_value_or_next_sibling(p0) if p0 else None
                if v and _texto_util(v):
                    result["costo"] = v

        elif label in LABELS_MANUAL:
            links = extract_links(bs)
            if links:
                result["manual"] = links
            else:
                txt = bloque_text.replace("Manual:", "").replace("Manual", "").strip()
                result["manual"] = txt or None

        elif label in LABELS_NOTA:
            p = bs.find("p")
            if p:
                s = p.find("strong")
                if s: s.decompose()
                result["nota"] = clean(p.get_text()) or None

        elif label in LABELS_IMPORTANTE or label.startswith("importante"):
            items = bs.find_all("li")
            if items:
                result["importante"] = [clean(li.get_text()) for li in items if clean(li.get_text())]
            else:
                p = bs.find("p")
                if p:
                    s = p.find("strong")
                    if s: s.decompose()
                    result["importante"] = clean(p.get_text()) or None

        elif is_periodo_label(label) or is_periodo_label(bloque_text[:80]):
            _parse_periodo_block(bs, result)

    result["periodos"] = [
        p for p in result["periodos"]
        if p.get("nombre") and p.get("modalidades")
    ] or None

    if not result["manual"]:
        fb = extract_links(soup)
        if 0 < len(fb) <= 3:
            result["manual"] = fb

    result["manual"] = result["manual"] or None

    return result


def _parse_periodo_block(bs, result):
    """
    FIX 2+3: extrae períodos de un bloque que puede contener uno o varios.
    Soporta SOLICITUD/RESPUESTA tanto en <p> como en <li>.
    """
    periodo_actual = None
    modalidad_actual = None
    solicitud_txt = None
    respuesta_txt = None

    def flush_modalidad():
        nonlocal modalidad_actual, solicitud_txt, respuesta_txt
        if modalidad_actual is not None and periodo_actual is not None:
            entry = {"modalidad": modalidad_actual}
            if solicitud_txt: entry["solicitud"] = solicitud_txt
            if respuesta_txt: entry["respuesta"] = respuesta_txt
            periodo_actual["modalidades"].append(entry)
        modalidad_actual = None
        solicitud_txt = None
        respuesta_txt = None

    def flush_periodo():
        nonlocal periodo_actual
        flush_modalidad()
        if periodo_actual and periodo_actual.get("nombre"):
            result["periodos"].append(periodo_actual)
        periodo_actual = None

    for node in bs.children:
        tag_name = getattr(node, "name", None)
        if not tag_name:
            continue

        # Acordeones / bloques embebidos (no son modalidades de calendario)
        if tag_name == "div":
            cls = " ".join(node.get("class") or []).lower()
            nid = (node.get("id") or "").lower()
            if "accordion-evalexp" in cls or "accordion-evalexp" in nid:
                continue
        if tag_name == "h5":
            t = clean(node.get_text(" "))
            if "facultad" in t.lower():
                continue

        node_text = clean(node.get_text(" "))
        strongs = node.find_all("strong")
        strong_text = clean(" ".join(s.get_text() for s in strongs)) if strongs else ""
        strong_lower = strong_text.lower().rstrip(":").strip()

        if tag_name in ("p", "h2", "h3", "h4", "h5", "h6"):
            if not strong_text:
                continue

            # ¿Es un encabezado de período?
            if is_periodo_label(strong_lower):
                flush_periodo()
                periodo_actual = {"nombre": strong_text.rstrip(":"), "modalidades": []}
                continue

            # NOTA / IMPORTANTE dentro de un bloque «Calendario»: no es una modalidad
            if periodo_actual is not None and (
                any(strong_lower.startswith(k) for k in LABELS_NOTA)
                or any(strong_lower.startswith(k) for k in LABELS_IMPORTANTE)
            ):
                flush_modalidad()
                continue

            # ¿Es un encabezado de modalidad?
            if periodo_actual is not None and not any(
                strong_lower.startswith(k) for k in LABELS_SOLICITUD | LABELS_RESPUESTA
            ):
                flush_modalidad()
                modalidad_actual = strong_text.rstrip(":")
                continue

            # ¿Es SOLICITUD o RESPUESTA en <p>?
            if any(strong_lower.startswith(k) for k in LABELS_SOLICITUD):
                for s in strongs: s.decompose()
                val = clean(node.get_text())
                if modalidad_actual is None:
                    modalidad_actual = "General"
                solicitud_txt = val
                continue

            if any(strong_lower.startswith(k) for k in LABELS_RESPUESTA):
                for s in strongs: s.decompose()
                respuesta_txt = clean(node.get_text())
                continue

        elif tag_name == "ul":
            # FIX 2: SOLICITUD/RESPUESTA en <li>
            sr = extract_solicitud_respuesta_from_li(node)
            if sr:
                if modalidad_actual is None:
                    modalidad_actual = "General"
                if "solicitud" in sr:
                    solicitud_txt = sr["solicitud"]
                if "respuesta" in sr:
                    respuesta_txt = sr["respuesta"]
            # Si la UL no tenía sol/resp, puede ser lista de sub-ítems de modalidad → ignorar

    flush_periodo()


# ─────────────────────────────────────────────────────────────────────────────
# Construcción de jerarquía
# ─────────────────────────────────────────────────────────────────────────────

def fetch_servicios() -> list:
    print(f"Consultando {URL} ...")
    resp = requests.get(URL, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    print(f"  ✓ {len(data)} registros recibidos\n")
    return data


def construir_jerarquia(raw: list) -> dict:
    estructura = defaultdict(lambda: defaultdict(list))
    descartados = 0

    for i, item in enumerate(raw, 1):
        if not es_servicio_util(item):
            descartados += 1
            continue

        tipos = [
            t.strip()
            for t in item.get("field_tipo_estudiante", "").split(",")
            if t.strip()
        ]
        if not tipos:
            tipos = [TIPO_ESTUDIANTE_FALLBACK]
        categoria = item.get("field_categoria_servicio", "").strip()
        nombre    = item.get("field_nombre_servicio", "").strip()
        html      = item.get("field_descripcion_servicio", "") or ""

        campos = parse_descripcion_html(html)

        servicio = {
            "nombre":               nombre,
            "descripcion":          campos.get("descripcion"),
            "imagen":               campos.get("imagen"),
            "modalidad_nivel":      campos.get("modalidad_nivel"),
            "tiempo_respuesta":     campos.get("tiempo_respuesta"),
            "requisitos":           campos.get("requisitos"),
            "requisitos_pestanas":  campos.get("requisitos_pestanas"),
            "costo":                campos.get("costo"),
            "periodos":             campos.get("periodos"),
            "manual":               campos.get("manual"),
            "nota":                 campos.get("nota"),
            "importante":           campos.get("importante"),
        }
        def _omit_service_value(v):
            if v is None or v == []:
                return True
            if isinstance(v, str):
                s = v.strip().strip(":\xa0 ")
                return not s or s in {":", ";", "-", "—"}
            return False

        servicio = {k: v for k, v in servicio.items() if not _omit_service_value(v)}

        for tipo in tipos:
            estructura[tipo][categoria].append(servicio)

        if i % 20 == 0:
            print(f"  Procesados {i}/{len(raw)}...")

    print(f"  · descartados como ruido: {descartados}")

    tipos_lista = []
    for tipo in sorted(estructura):
        cats = [
            {"nombre": cat, "servicios": estructura[tipo][cat]}
            for cat in sorted(estructura[tipo])
        ]
        tipos_lista.append({
            "tipo":             tipo,
            "total_categorias": len(cats),
            "total_servicios":  sum(len(c["servicios"]) for c in cats),
            "categorias":       cats,
        })

    return {
        "fuente":              URL,
        "total_tipos":         len(tipos_lista),
        "total_servicios":     sum(t["total_servicios"] for t in tipos_lista),
        "tipos_de_estudiante": tipos_lista,
        "metadata": {
            "tipos_de_estudiante": {
                "ALUMNI": "Egresados / graduados",
                "CONTINUO": "Estudiantes actualmente matriculados",
                "NUEVO": "Estudiantes recién matriculados",
                "POSTULANTE": "Aspirantes",
                "SIN_TIPO_EN_API": (
                    "El registro Drupal no asigna tipo; tratar como aplicable a todos los perfiles"
                ),
            },
            "esquema": {
                "requisitos": "lista[str] de requisitos generales",
                "requisitos_pestanas": (
                    "lista[{pestaña, contenido[]}] cuando el HTML usa pestañas (tabs)"
                ),
                "periodos": (
                    "lista[{nombre, modalidades:[{modalidad, solicitud?, respuesta?}]}]"
                ),
                "manual": "lista[{texto, url}] (PDFs/videos relacionados)",
            },
            "notas_parser": [
                "El parser descarta filas Drupal 'disableblock' y encabezados "
                "'SERVICIOS DE …' por carecer de contenido útil.",
                "Cuando el HTML mezcla 'Tiempo de respuesta' y 'Costo' en un mismo bloque "
                "entre <hr>, se enrutan ambos campos analizando cada <p> con <strong>.",
            ],
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    OUT = "servicios_utpl_jerarquico.json"

    raw       = fetch_servicios()
    jerarquia = construir_jerarquia(raw)

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(jerarquia, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*55}")
    print(f"  Tipos de estudiante : {jerarquia['total_tipos']}")
    print(f"  Total servicios     : {jerarquia['total_servicios']}")
    for t in jerarquia["tipos_de_estudiante"]:
        print(f"\n  🎓 {t['tipo']}")
        for c in t["categorias"]:
            print(f"     📁 {c['nombre']} ({len(c['servicios'])} servicios)")
    print(f"\n✓ Guardado en: {OUT}")


if __name__ == "__main__":
    main()
