import fs from 'node:fs'
import path from 'node:path'

import { createPartFromBase64, GoogleGenAI, type Part } from '@google/genai'

import type { CanonicalServiceRecord, PdfRef } from '@/lib/types'

const ALLOWED_PDF_HOSTS = new Set(['portales.utpl.edu.ec', 'www.utpl.edu.ec'])
const MAX_PDF_BYTES = 20 * 1024 * 1024
const FETCH_TIMEOUT_MS = 60_000

export async function loadPdfBytes(ref: PdfRef, cwd: string): Promise<Buffer> {
  const absLocal = path.isAbsolute(ref.localPath) ? ref.localPath : path.join(cwd, ref.localPath)
  try {
    if (fs.existsSync(absLocal)) {
      const buf = fs.readFileSync(absLocal)
      if (buf.length > MAX_PDF_BYTES) {
        throw new Error(`El PDF local supera el tamaño máximo permitido (${ref.label}).`)
      }
      return buf
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('supera')) throw e
  }

  let hostname: string
  try {
    hostname = new URL(ref.url).hostname
  } catch {
    throw new Error(`URL de PDF inválida: ${ref.label}`)
  }

  if (!ALLOWED_PDF_HOSTS.has(hostname)) {
    throw new Error(`Dominio de PDF no permitido (${hostname}).`)
  }

  const res = await fetch(ref.url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) {
    throw new Error(`No se pudo descargar el PDF «${ref.label}» (${res.status}).`)
  }

  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > MAX_PDF_BYTES) {
    throw new Error(`El PDF descargado supera el tamaño máximo permitido (${ref.label}).`)
  }
  return buf
}

function buildServiceContextText(service: CanonicalServiceRecord): string {
  const p = service.jsonPayload
  const lines = [
    `Servicio: ${service.serviceName}`,
    `Categoría: ${service.category}`,
    typeof p.descripcion === 'string' && p.descripcion.trim() ? `Descripción: ${p.descripcion.trim()}` : null,
    typeof p.modalidad_nivel === 'string' && p.modalidad_nivel.trim()
      ? `Modalidad / nivel: ${p.modalidad_nivel.trim()}`
      : null,
    typeof p.costo === 'string' && p.costo.trim() ? `Costo: ${p.costo.trim()}` : null,
    typeof p.tiempo_respuesta === 'string' && p.tiempo_respuesta.trim()
      ? `Tiempo de respuesta: ${p.tiempo_respuesta.trim()}`
      : null,
    typeof p.nota === 'string' && p.nota.trim() ? `Nota: ${p.nota.trim()}` : null,
  ].filter(Boolean)
  return lines.join('\n')
}

export async function generateServiceAnswerWithGemini(input: {
  question: string
  service: CanonicalServiceRecord
  pdfRefs: PdfRef[]
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('Falta la variable de entorno GEMINI_API_KEY.')
  }

  const model =
    process.env.GEMINI_CHAT_MODEL?.trim() || process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash'

  const ai = new GoogleGenAI({ apiKey })
  const ctx = buildServiceContextText(input.service)

  const parts: Part[] = [
    {
      text: [
        'Eres un asistente para trámites de la UTPL.',
        'Responde en español, con tono claro y profesional.',
        'Basa la respuesta únicamente en los PDFs adjuntos y en el resumen del trámite.',
        'Si la información no aparece en esos documentos, dilo explícitamente.',
        'No repitas al final un resumen de modalidad, nivel, costo, tiempo de respuesta ni listas de requisitos generales, salvo que la pregunta lo pida de forma explícita.',
        'No cierres con frases formulaicas (por ejemplo «espero que esta información sea de utilidad» ni similares).',
        'Responde de forma directa a la pregunta, sin reinyectar bloques de metadatos del trámite.',
        '',
        '--- Resumen del trámite ---',
        ctx,
        '',
        'A continuación se adjuntan uno o más PDFs oficiales.',
      ].join('\n'),
    } as Part,
  ]

  const cwd = process.cwd()
  for (const ref of input.pdfRefs) {
    const buf = await loadPdfBytes(ref, cwd)
    parts.push({ text: `\n[PDF: ${ref.label}]\n` } as Part)
    parts.push(createPartFromBase64(buf.toString('base64'), 'application/pdf'))
  }

  parts.push({
    text: `\n--- Pregunta del usuario ---\n${input.question.trim()}\n`,
  } as Part)

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts,
      },
    ],
  })

  const text = typeof response.text === 'string' ? response.text.trim() : ''
  if (!text) {
    throw new Error('Gemini no devolvió texto utilizable.')
  }
  return text
}
