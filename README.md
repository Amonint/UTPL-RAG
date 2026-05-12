# UTPL — extracción de calendario desde PDF

Herramientas en Node/TypeScript para:

- Extraer texto de PDFs en `doop/` con **pdf-parse** o **Google Cloud Vision** (OCR asíncrono vía GCS).
- Extraer tablas y layout con **Amazon Textract** (subida a S3 + análisis asíncrono) y guardar JSON crudo en `data/derived/textract-raw/`.
- Parsear filas de calendario UTPL (`dd/mm/yyyy | dd/mm/yyyy`) y enriquecer con categoría y modalidad inferidas.
- Validar el dataset `src/data/academic-calendar-events.ts` frente a los PDF.

## Scripts

```bash
npm install
npm run validate:calendar-pdfs   # informe en data/derived/
npm run extract:calendar-vision  # --force-vision | --use-gemini (Files API + GEMINI_API_KEY)
npm test
```

### Amazon Textract (calendario `doop/`)

Requisitos: bucket S3, credenciales IAM con `s3:PutObject`, `textract:StartDocumentAnalysis`, `textract:GetDocumentAnalysis`. Variables en [.env.example](.env.example).

```bash
# Listar PDFs sin llamar a AWS
npm run extract:doop-textract -- --dry-run

# Procesar (sube cada PDF al bucket y espera el job de Textract)
npm run extract:doop-textract -- --limit=3

# Opciones: --doop=./doop --glob=subcadena --force

# Tras tener JSON en data/derived/textract-raw/: candidatos + informe vs EVENTS
npm run process:textract-calendar

# Un solo JSON con todos los PDF ya extraídos por Textract (nombre fijo)
npm run bundle:extraccion-utpl-v1
# (Opcional) extraer todos los PDF y empaquetar en un paso:
npm run extraccion:utpl-v1
```

Salida de la fase 2: `data/derived/textract-calendar-candidates.json` y `data/derived/textract-vs-events.md` (no sobrescribe `academic-calendar-events.ts`).

**Bundle v1:** `data/derived/EXTRACION UTPL VERSION 1.json` contiene todos los `documentos` (bloques Textract por PDF).

**Calendario en la app:** tras `process:textract-calendar`, regenera el JSON **solo desde Textract** (sin mezclar `academic-calendar-events.ts`):

```bash
npm run calendar:emit-from-textract
```

Eso escribe `src/data/calendar-events-active.json`; el calendario importa [`src/data/calendar-events-active.ts`](src/data/calendar-events-active.ts).

Variables: [.env.example](.env.example) (Vision/GCS, Gemini opcional, AWS Textract).
