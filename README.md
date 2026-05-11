# UTPL — extracción de calendario desde PDF

Herramientas en Node/TypeScript para:

- Extraer texto de PDFs en `doop/` con **pdf-parse** o **Google Cloud Vision** (OCR asíncrono vía GCS).
- Parsear filas de calendario UTPL (`dd/mm/yyyy | dd/mm/yyyy`) y enriquecer con categoría y modalidad inferidas.
- Validar el dataset `src/data/academic-calendar-events.ts` frente a los PDF.

## Scripts

```bash
npm install
npm run validate:calendar-pdfs   # informe en data/derived/
npm run extract:calendar-vision  # --force-vision | --use-gemini (Files API + GEMINI_API_KEY)
npm test
```

Variables: [.env.example](.env.example) (Vision/GCS y opcional Gemini).
