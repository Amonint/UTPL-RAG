export function contentTypeLabel(value: unknown, sectionCode?: string | null): string {
  if (value === 'calendar' || value === 'fechas') return 'FECHAS'
  if (value === 'guide' || value === 'service' || sectionCode === 'general_info') return 'INFORMACIÓN'
  if (value === 'faq') return 'FAQ'
  if (value === 'incident') return 'FAQ'
  return 'INFORMACIÓN'
}
