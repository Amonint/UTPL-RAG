const LEAKED_METADATA_LABELS = new Set([
  'section code',
  'domain code',
  'domain name',
  'service category code',
  'modality',
  'applies to all',
])

function normalizeLabel(line: string): string {
  return line.trim().toLowerCase().replace(/\s+/g, ' ')
}

function isLeakedMetadataLabel(line: string): boolean {
  return LEAKED_METADATA_LABELS.has(normalizeLabel(line))
}

/**
 * Elimina bloques de metadatos internos que a veces llegan dentro del answer_text
 * (Section Code, Domain Code, etc.) para no mostrarlos al usuario final.
 */
export function sanitizePublicAnswerText(text: string): string {
  const raw = text.trim()
  if (!raw) return ''

  const lines = raw.split(/\r?\n/)
  const kept: string[] = []

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (!isLeakedMetadataLabel(line)) {
      kept.push(line)
      continue
    }

    // Omitir la línea-llave.
    // Omitir líneas en blanco intermedias.
    while (i + 1 < lines.length && lines[i + 1]!.trim() === '') i += 1
    // Omitir el valor inmediato (si existe).
    if (i + 1 < lines.length) i += 1
  }

  const cleaned = kept.join('\n')
  return cleaned.replace(/\n{3,}/g, '\n\n').trim()
}

export interface EmbeddedLink {
  url: string
  text: string
}

/**
 * Extrae URLs embebidas entre [ y ] del texto
 * Ejemplo: "Ver en el siguiente [https://ejemplo.com]" → { url: "https://...", text: "[https://...]" }
 */
export function extractEmbeddedLinks(text: string): EmbeddedLink[] {
  const links: EmbeddedLink[] = []
  const regex = /\[([^\]]+)\]/g
  let match

  while ((match = regex.exec(text)) !== null) {
    const content = match[1]!.trim()
    if (content.startsWith('http://') || content.startsWith('https://')) {
      links.push({
        url: content,
        text: match[0]!,
      })
    }
  }

  return links
}

/**
 * Reemplaza URLs embebidas entre [ y ] con marcadores únicos
 * Mantiene un mapa para reconstruir después
 */
export function replaceEmbeddedLinksWithPlaceholders(
  text: string,
): { text: string; links: EmbeddedLink[] } {
  const links = extractEmbeddedLinks(text)
  let result = text

  links.forEach((link, index) => {
    result = result.replace(link.text, `__EMBEDDED_LINK_${index}__`)
  })

  return { text: result, links }
}
