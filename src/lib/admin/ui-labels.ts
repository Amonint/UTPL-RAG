/**
 * Etiquetas en español claro para el panel admin (ADR-0006).
 * Los códigos internos (faq, editorial_draft, …) no deben mostrarse sin traducir.
 */

export type SectionCode = 'faq' | 'general_info'
export type ContentTypeCode = 'faq' | 'service' | 'incident' | 'calendar' | 'guide'
export type EditorialStatusCode =
  | 'ingest_draft'
  | 'editorial_draft'
  | 'review'
  | 'approved'
  | 'published'
  | 'archived'

export const SECTION_LABELS: Record<SectionCode, string> = {
  faq: 'Preguntas frecuentes',
  general_info: 'Información',
}

export const SECTION_OPTIONS: Array<{ value: SectionCode; label: string; hint: string }> = [
  {
    value: 'faq',
    label: SECTION_LABELS.faq,
    hint: 'Preguntas y respuestas que verán los asesores en la pestaña Preguntas frecuentes.',
  },
  {
    value: 'general_info',
    label: SECTION_LABELS.general_info,
    hint: 'Contenido informativo (guías, calendarios, avisos) que los asesores consultan en la pestaña Información.',
  },
]

export const CONTENT_TYPE_LABELS: Record<ContentTypeCode, string> = {
  faq: 'Pregunta frecuente',
  service: 'Servicio o trámite',
  incident: 'Incidencia',
  calendar: 'Calendario',
  guide: 'Guía informativa',
}

export const CONTENT_TYPES_BY_SECTION: Record<SectionCode, ContentTypeCode[]> = {
  faq: ['faq', 'service', 'incident'],
  general_info: ['guide', 'calendar'],
}

export const EDITORIAL_STATUS_LABELS: Record<EditorialStatusCode, string> = {
  ingest_draft: 'Borrador de carga (sistema)',
  editorial_draft: 'Borrador',
  review: 'En revisión',
  approved: 'Aprobado',
  published: 'Publicado',
  archived: 'Archivado',
}

/** Estados que administración puede elegir al crear o editar. */
export const EDITORIAL_STATUS_FORM_OPTIONS: EditorialStatusCode[] = [
  'editorial_draft',
  'review',
  'approved',
  'published',
  'archived',
]

/** Filtro en listado (incluye borrador de carga para soporte). */
export const EDITORIAL_STATUS_FILTER_OPTIONS: EditorialStatusCode[] = [
  ...EDITORIAL_STATUS_FORM_OPTIONS,
  'ingest_draft',
]

const DOMAIN_LABELS: Record<string, string> = {
  academic: 'Académico',
  financial: 'Financiero',
  foreign_language: 'Lengua extranjera',
  calendar: 'Calendarios',
  services: 'Servicios',
}

export function labelSection(code: string | null | undefined): string {
  if (!code) return '—'
  return SECTION_LABELS[code as SectionCode] ?? code
}

export function labelContentType(code: string | null | undefined): string {
  if (!code) return '—'
  return CONTENT_TYPE_LABELS[code as ContentTypeCode] ?? code
}

export function labelEditorialStatus(code: string | null | undefined): string {
  if (!code) return '—'
  return EDITORIAL_STATUS_LABELS[code as EditorialStatusCode] ?? code
}

const EDITORIAL_STATUS_BADGE_TONE: Record<EditorialStatusCode, string> = {
  ingest_draft: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200/80',
  editorial_draft: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200/80',
  review: 'bg-amber-50 text-amber-950 ring-1 ring-inset ring-amber-200',
  approved: 'bg-sky-50 text-sky-950 ring-1 ring-inset ring-sky-200',
  published: 'bg-emerald-50 text-emerald-950 ring-1 ring-inset ring-emerald-200',
  archived: 'bg-red-50 text-red-900 ring-1 ring-inset ring-red-200',
}

/** Clases Tailwind para la pastilla de estado en listados admin. */
export function editorialStatusBadgeClass(code: string | null | undefined): string {
  const base = 'inline-flex rounded-full px-2 py-0.5 text-xs font-medium'
  if (!code) return `${base} bg-chalk text-obsidian`
  const tone =
    EDITORIAL_STATUS_BADGE_TONE[code as EditorialStatusCode] ??
    'bg-chalk text-obsidian ring-1 ring-inset ring-chalk'
  return `${base} ${tone}`
}

export function labelDomain(code: string | null | undefined): string {
  if (!code) return '—'
  return DOMAIN_LABELS[code] ?? code
}

export function formatMenuPath(parts: {
  category?: string | null
  subcategory?: string | null
  element?: string | null
}): string {
  const leaf =
    parts.element && parts.element.trim().toLowerCase() !== 'general' ? parts.element : null
  return [parts.category, parts.subcategory, leaf].filter(Boolean).join(' › ') || '—'
}

/** Vista previa del menú lateral del asesor (pestaña + niveles del árbol). */
export function formatAdvisorMenuPreview(
  section: SectionCode,
  parts: {
    category?: string | null
    subcategory?: string | null
    element?: string | null
  },
): string | null {
  const path = formatMenuPath(parts)
  if (!path || path === '—') return null
  return `${SECTION_LABELS[section]} › ${path}`
}

export const ADVISOR_MENU_PREVIEW_CAPTION = 'Así lo verá un asesor en el menú'

export function defaultContentTypeForSection(section: SectionCode): ContentTypeCode {
  return section === 'general_info' ? 'guide' : 'faq'
}

export function editorPageTitle(isNew: boolean, section: SectionCode): string {
  if (!isNew) return 'Editar entrada'
  return section === 'general_info' ? 'Nueva información' : 'Nueva pregunta frecuente'
}

export function editorPageIntro(section: SectionCode): string {
  if (section === 'general_info') {
    return 'Indique dónde aparecerá en el menú de Información y escriba el contenido que verán los asesores. El tipo (guía o calendario) se asigna automáticamente.'
  }
  return 'Indique dónde aparecerá en el menú de Preguntas frecuentes y escriba la pregunta y la respuesta que verán los asesores.'
}

/** Texto del botón para crear una entrada en una sección. */
export function newItemButtonLabel(section: SectionCode): string {
  return editorPageTitle(true, section)
}

/** Ayuda del selector de estado editorial en el editor. */
export const EDITORIAL_STATUS_FIELD_HINT =
  'Controla si los asesores ven esta información en su menú. Elija «Publicado» cuando esté lista para consulta.'

const ADVISOR_VISIBLE_STATUSES = new Set<EditorialStatusCode>(['published', 'approved'])

export function isVisibleToAdvisor(
  editorialStatus: string,
  isActive = true,
): boolean {
  return isActive && ADVISOR_VISIBLE_STATUSES.has(editorialStatus as EditorialStatusCode)
}

export function advisorVisibilityLabel(editorialStatus: string, isActive = true): string {
  return isVisibleToAdvisor(editorialStatus, isActive)
    ? 'Visible para asesores'
    : 'Oculto para asesores'
}

export function advisorVisibilityBadgeClass(editorialStatus: string, isActive = true): string {
  return isVisibleToAdvisor(editorialStatus, isActive)
    ? 'inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-900'
    : 'inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900'
}

export const ADVISOR_VISIBILITY_HIDDEN_BANNER =
  'Los asesores no verán esta entrada hasta que el estado sea Publicado o Aprobado.'

export const TAXONOMY_EMPTY_ELEMENT_HINT =
  'Sin contenido publicado — no aparece en el menú del asesor.'

/** Etiqueta del cuarto nivel cuando hay más de un tema bajo la misma subcategoría. */
export const MENU_TOPIC_LABEL = 'Tema en el menú'
export const MENU_TOPIC_HINT =
  'Solo elija un tema si hay varios bajo la misma subcategoría. Si hay uno solo, se asigna automáticamente.'

const MODALITY_LABELS: Record<string, string> = {
  presencial: 'Presencial',
  distancia: 'En línea y Distancia',
  en_linea: 'En línea y Distancia',
  hibrida: 'Híbrida',
  sin_tipo: 'Todas las modalidades',
}

const STUDENT_TYPE_LABELS: Record<string, string> = {
  NUEVO: 'ESTUDIANTE NUEVO',
  CONTINUO: 'ESTUDIANTE CONTINUO',
  ALUMNI: 'ESTUDIANTE ALUMNI',
  POSTULANTE: 'ESTUDIANTE POSTULANTE',
  SIN_TIPO_EN_API: 'Sin tipo definido',
}

export type AudienceSummary = {
  profileTypeCode: string | null
  profileTypeName: string | null
  studentTypeCode: string | null
  studentTypeName: string | null
}

export function labelModality(code: string | null | undefined, displayName?: string | null): string {
  if (displayName?.trim()) return displayName.trim()
  if (!code) return 'Todas las modalidades'
  return MODALITY_LABELS[code] ?? code
}

export function labelStudentType(code: string | null | undefined, displayName?: string | null): string {
  if (displayName?.trim()) return displayName.trim()
  if (!code) return ''
  return STUDENT_TYPE_LABELS[code] ?? code
}

/** Chips cortos para listado admin («Aplica a»). */
export function audienceChipLabels(audiences: AudienceSummary[]): string[] {
  if (audiences.length === 0) {
    return ['Sin audiencia definida']
  }

  const chips = new Set<string>()
  let hasOpenModality = false

  for (const row of audiences) {
    const modality = row.profileTypeCode
    if (!modality || modality === 'sin_tipo') {
      hasOpenModality = true
    } else {
      chips.add(labelModality(modality, row.profileTypeName))
    }
    if (row.studentTypeCode) {
      chips.add(labelStudentType(row.studentTypeCode, row.studentTypeName))
    }
  }

  if (hasOpenModality && chips.size === 0) {
    return ['Todas las modalidades']
  }
  if (hasOpenModality) {
    chips.add('Otras modalidades')
  }

  return chips.size > 0 ? [...chips] : ['Todas las modalidades']
}

export function formatAdminDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })
}
