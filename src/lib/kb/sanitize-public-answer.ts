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
