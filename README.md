# UTPL RAG Demo

Demo web de precisión para consultas sobre servicios UTPL. La app no trata los PDFs como un corpus global: cada PDF se consulta solo si está ligado al servicio recuperado desde el JSON.

## Qué resuelve

- Recupera primero el registro estructurado del servicio desde `servicios_utpl_jerarquico.json`.
- Usa PDFs solo cuando están enlazados a ese mismo servicio en `pdfs_descargados/`.
- Evita mezclar evidencia entre trámites parecidos.
- Expone la evidencia usada en la interfaz.

## Stack

- `Next.js 16` + `App Router`
- `React 19`
- `Vitest`
- `Fuse.js` para candidate routing
- `@google/genai` para respuesta grounded y embeddings
- `Render` free tier para demo

## Estructura de datos

Fuente base:

- `servicios_utpl_jerarquico.json`

Fuente complementaria:

- `pdfs_descargados/*.pdf`

Artifacts derivados:

- `data/derived/services.json`
- `data/derived/chunks.jsonl`
- `data/derived/embeddings.json`

## Flujo RAG

1. El usuario pregunta por un trámite.
2. El backend enruta la consulta al servicio más probable.
3. Si hay ambigüedad, devuelve candidatos y no responde de forma automática.
4. Recupera siempre el chunk JSON del servicio.
5. Recupera chunks PDF solo de ese `serviceId`.
6. Verifica que la evidencia no incluya otros servicios.
7. Genera la respuesta con Gemini.

## Scripts

- `npm run dev`: levanta la app local.
- `npm run test`: ejecuta la suite.
- `npm run ingest`: normaliza servicios, extrae texto PDF y genera artifacts.
- `npm run build`: build de producción.

## Frontend UI

- Tailwind CSS v4 alimenta el shell del chat y el composer.
- Los primitivos UI reutilizables viven en `src/components/ui`.
- El composer actual acepta solo texto; no soporta adjuntos, imágenes ni audio.

## Desarrollo local

1. Instala dependencias:

```bash
npm install
```

2. Configura variables:

```bash
cp .env.example .env.local
```

3. Si cambió el portal, regenera el JSON:

```bash
python3 generar_json_jerarquico.py
```

4. Si cambiaron los PDFs ligados en el JSON, vuelve a descargarlos:

```bash
python3 descargar_pdfs_json.py
```

5. Genera artifacts:

```bash
npm run ingest
```

6. Levanta la app:

```bash
npm run dev
```

## Despliegue en Render

Usa el `render.yaml` incluido. En el servicio web define:

- `GEMINI_API_KEY`

El build ejecuta `npm run ingest` antes de `npm run build`, así que Render vuelve a generar artifacts durante cada deploy.

## Precisión y límites

- Si un servicio no tiene PDF, la respuesta sale solo del JSON.
- Si la consulta apunta a varios servicios cercanos, la app devuelve desambiguación.
- Si `GEMINI_API_KEY` no está configurada, la UI carga pero la generación de respuestas falla.
- Hoy el retrieval es `service-first` con fuzzy routing; la separación estricta por `serviceId` es el guardrail central del sistema.
