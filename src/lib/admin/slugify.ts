export function slugify(value: string): string {
  const text = (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
  const slug = text.replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return slug || 'item'
}

/** Código estable para catálogos admin (domains, modalidades): snake_case en minúsculas. */
export function catalogCodeFromName(value: string, maxLen = 80): string {
  const text = (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
  let code = text.replace(/[^a-z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
  if (!code) code = 'item'
  if (!/^[a-z]/.test(code)) code = `x_${code}`
  return code.slice(0, maxLen)
}

/** Código para tipos de estudiante (mayúsculas, guión bajo). */
export function studentTypeCodeFromName(value: string, maxLen = 80): string {
  return catalogCodeFromName(value, maxLen).toUpperCase()
}

export function uniqueCatalogCode(base: string, taken: Iterable<string>, maxLen = 80): string {
  const used = new Set(taken)
  let candidate = base.slice(0, maxLen)
  if (!used.has(candidate)) return candidate
  for (let n = 2; n < 1000; n += 1) {
    const suffix = `_${n}`
    candidate = `${base.slice(0, maxLen - suffix.length)}${suffix}`
    if (!used.has(candidate)) return candidate
  }
  throw new Error('No se pudo generar un código único para el catálogo')
}
