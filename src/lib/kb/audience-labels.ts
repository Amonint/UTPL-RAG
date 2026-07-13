export type AudienceMeta = {
  modality?: string | null
  modalityLabel?: string | null
  programLevel?: string | null
  programLevelLabel?: string | null
  studentLifecycle?: string | null
  studentLifecycleLabel?: string | null
  sectionCode?: string | null
  domainCode?: string | null
  appliesToAll?: boolean
}

export type KnowledgeScopeInput = {
  payload?: Record<string, unknown>
  studentTypes?: string[]
}

const MODALITY_LABELS: Record<string, string> = {
  presencial: 'Presencial',
  distancia: 'Distancia',
  en_linea: 'En línea',
  hibrida: 'Híbrida',
  sin_tipo: 'Todas las modalidades',
}

const LEVEL_LABELS: Record<string, string> = {
  grado: 'Grado',
  posgrado: 'Posgrado',
  tec: 'TEC',
  competencias_especificas: 'Competencias específicas',
  general: 'Todos los niveles',
}

const LIFECYCLE_LABELS: Record<string, string> = {
  NUEVO: 'Nuevo',
  CONTINUO: 'Continuo',
  POSTULANTE: 'Postulante',
  ALUMNI: 'Alumni',
  SIN_TIPO_EN_API: 'Todos los tipos',
}

const SECTION_LABELS: Record<string, string> = {
  general_info: 'Información',
  faq: 'FAQ',
  calendar: 'Fechas',
}

export function labelModality(code: string | null | undefined): string {
  if (!code || code === 'sin_tipo') return 'Todas las modalidades'
  return MODALITY_LABELS[code] ?? code
}

export function labelProgramLevel(code: string | null | undefined): string {
  if (!code || code === 'general') return 'Todos los niveles'
  return LEVEL_LABELS[code] ?? code
}

export function labelLifecycle(code: string | null | undefined): string {
  if (!code) return 'Todos los tipos'
  return LIFECYCLE_LABELS[code] ?? code
}

function readPayloadText(payload: Record<string, unknown> | undefined, key: string): string {
  const value = payload?.[key]
  return typeof value === 'string' ? value.trim() : ''
}

/** Línea de alcance: sección · área · modalidad · tipo de estudiante · periodo (si existe). */
export function buildKnowledgeScopeParts(input: KnowledgeScopeInput = {}): string[] {
  const payload = input.payload
  const meta = parseAudienceFromPayload(payload)
  const section = labelSection(meta.sectionCode)
  const area =
    readPayloadText(payload, 'domain_name') ||
    readPayloadText(payload, 'domain') ||
    readPayloadText(payload, 'category') ||
    ''
  const modality = meta.appliesToAll ? labelModality('sin_tipo') : labelModality(meta.modality)
  const studentType =
    input.studentTypes && input.studentTypes.length > 0
      ? input.studentTypes.map((code) => labelLifecycle(code)).join(', ')
      : meta.studentLifecycle
        ? labelLifecycle(meta.studentLifecycle)
        : 'Todos los tipos'
  const period = readPayloadText(payload, 'period_label')

  const parts: string[] = []
  if (section) parts.push(section)
  if (area) parts.push(area)
  if (modality) parts.push(modality)
  if (studentType) parts.push(studentType)
  if (period) parts.push(period)
  return parts
}

export function formatKnowledgeScopeLine(input: KnowledgeScopeInput = {}): string | null {
  const parts = buildKnowledgeScopeParts(input)
  return parts.length > 0 ? parts.join(' · ') : null
}

export function labelSection(sectionCode: string | null | undefined): string {
  if (!sectionCode) return ''
  return SECTION_LABELS[sectionCode] ?? sectionCode
}

export function parseAudienceFromPayload(payload: Record<string, unknown> | undefined): AudienceMeta {
  if (!payload) return { appliesToAll: true }
  const modality = typeof payload.modality === 'string' ? payload.modality : null
  const programLevel = typeof payload.program_level === 'string' ? payload.program_level : null
  const studentLifecycle =
    typeof payload.student_lifecycle === 'string' ? payload.student_lifecycle : null
  const appliesToAll =
    payload.applies_to_all === true ||
    ((!modality || modality === 'sin_tipo') &&
      (!programLevel || programLevel === 'general') &&
      !studentLifecycle)

  return {
    modality,
    modalityLabel: labelModality(modality),
    programLevel,
    programLevelLabel: labelProgramLevel(programLevel),
    studentLifecycle,
    studentLifecycleLabel: labelLifecycle(studentLifecycle),
    sectionCode: typeof payload.section_code === 'string' ? payload.section_code : null,
    domainCode: typeof payload.domain_code === 'string' ? payload.domain_code : null,
    appliesToAll,
  }
}

export function documentationDetailTitle(input: {
  sectionCode?: string | null
  elementName?: string | null
  serviceName?: string | null
}): string {
  const element = input.elementName?.trim() || input.serviceName?.trim()
  if (input.sectionCode === 'general_info' && element) {
    return `Información de ${element} para los diferentes perfiles`
  }
  return input.serviceName?.trim() || element || 'Contenido'
}
