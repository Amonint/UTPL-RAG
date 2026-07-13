import type { AcademicCalendarEventRecord } from '@/data/academic-calendar-events'

/** Raíz de un archivo JSON de calendario UTPL (seis fuentes). */
export type UtplCalendarSourceFile = {
  institucion?: string
  ciclo?: string
  eventos: UtplCalendarEvento[]
}

export type UtplCalendarEvento = {
  id: string
  categoria: string
  nombre: string
  modalidades: string[]
  fechas: UtplFechaItem[]
  notas?: string | null
}

export type UtplFechaItem = {
  tipo: string
  inicio: string
  fin: string
}

export type MergeCalendarSourceInput = {
  /** Nombre de archivo sin ruta (p. ej. `grado-en-linea.json`) — participa en IDs y mensajes. */
  fileName: string
  data: UtplCalendarSourceFile
}

export type MergeCalendarResult = {
  records: AcademicCalendarEventRecord[]
  warnings: string[]
  errors: string[]
}

const YMD = /^\d{4}-\d{2}-\d{2}$/

/** Mapeo `categoria` del JSON → etiqueta de UI existente (colores en `event-categories.ts`). */
export const UTPL_SOURCE_CATEGORY_TO_UI: Record<string, string> = {
  feriados: 'Feriado',
  feriados_institucionales: 'Feriado',
  vacaciones_institucionales: 'Vacaciones',
  matriculas: 'Matrículas',
  matricula: 'Matrículas',
  inscripciones: 'Matrículas',
  admision: 'Matrículas',
  becas: 'Matrículas',
  oposicion: 'Matrículas',
  paralelos_cupos_edicion_matricula: 'Matrículas',
  atraccion: 'Matrículas',
  ciclo_academico: 'Académico',
  periodo_academico: 'Académico',
  planificacion_academica: 'Académico',
  planificacion: 'Académico',
  planificacion_docente: 'Docente',
  actividades_academicas: 'Académico',
  modulos_academicos: 'Académico',
  gestion_academica: 'Académico',
  actividades_eva: 'Académico',
  canvas: 'Académico',
  practicas: 'Académico',
  elaboracion_reactivos: 'Académico',
  curso_competencias_especificas: 'CCE',
  gestion_examenes: 'Evaluación',
  evaluaciones: 'Evaluación',
  evaluacion_docente: 'Evaluación',
  calificaciones: 'Notas',
  resultados: 'Notas',
  recalificaciones: 'Trámite',
  recalificaciones_notas: 'Trámite',
  tramites: 'Trámite',
  tramites_modalidad_componentes: 'Trámite',
  retiros: 'Trámite',
  retiro_academico: 'Trámite',
  creditos_prerrequisitos_proyecciones: 'Trámite',
  legalizacion: 'Trámite',
  legalizacion_matriculas: 'Trámite',
  homologacion_externa: 'Trámite',
  impugnacion: 'Trámite',
  reconocimiento_interno: 'Trámite',
  requisitos_casos_especiales: 'Trámite',
  documentos: 'Administrativo',
  documento: 'Administrativo',
  comunicados: 'Administrativo',
  certificados_otros_servicios: 'Administrativo',
  referencia_documental: 'Administrativo',
  servicios_academicos: 'Administrativo',
  simulador_credenciales: 'Administrativo',
  gestion_reportes: 'Administrativo',
  administrativo: 'Administrativo',
  cierre: 'Administrativo',
  recursos_materiales: 'Administrativo',
  ingles: 'Inglés',
  ingles_idiomas: 'Inglés',
  ingles_validacion_general: 'Inglés',
  segunda_lengua: 'Inglés',
  validacion_general: 'Val. General',
  validacion_practicas_experiencia: 'Val. General',
  validacion_trayectorias_profesionales: 'Val. General',
  cierre_validacion: 'Val. General',
  integracion_curricular: 'UIC/UTE',
  titulacion: 'Titulación',
  egreso: 'Titulación',
  tutorias: 'Recuperación',
  capacitacion_docente: 'Docente',
  /** Variantes tal cual o tras normalizar (acentos → ASCII, espacios → _) */
  feriado: 'Feriado',
  academico: 'Académico',
  evaluacion: 'Evaluación',
  gestion_administrativa: 'Administrativo',
  validacion: 'Val. General',
  capacitacion: 'Docente',
  actividad_academica: 'Académico',
  gestion_notas: 'Notas',
  validaciones: 'Val. General',
}

/** Slugs de `modalidades` → texto para filtro (compatible con `.includes()` en lista). */
export const UTPL_MODALITY_SLUG_TO_LABEL: Record<string, string> = {
  todas: 'Todas',
  grado_distancia_en_linea: 'Grado distancia en línea',
  grado_en_linea: 'Grado en línea',
  grado_presencial: 'Grado presencial',
  grado: 'Grado',
  grado_distancia_general: 'Grado distancia (general)',
  presencial: 'Presencial',
  en_linea: 'En línea',
  distancia: 'Distancia',
  hibrida: 'Híbrida',
  mp: 'Modalidad presencial (MP)',
  posgrado: 'Posgrado',
  posgrados: 'Posgrados',
  posgrados_en_linea: 'Posgrados en línea',
  tec: 'Técnico / Tecnológico',
  tecnologias: 'Tecnologías',
  tecnologias_en_linea: 'Tecnologías en línea',
  tecnologias_presencial: 'Tecnologías presencial',
  cce: 'CCE',
  cce_en_linea: 'CCE en línea',
  uic_ut: 'UIC / UT',
  uic_ut_grado: 'UIC / UT · Grado',
  uic_ut_posgrados: 'UIC / UT · Posgrados',
  ute: 'UTE',
  ute_grado_distancia_en_linea: 'UTE · Grado distancia en línea',
  ute_mad: 'UTE · MAD',
  ute_posgrados: 'UTE · Posgrados',
  ute_presencial: 'UTE · Presencial',
  segunda_lengua_ingles: 'Segunda lengua / Inglés',
  examen_validacion_general: 'Examen validación general',
  examen_validacion_general_en_linea: 'Validación general en línea',
  examen_validacion_general_presencial: 'Validación general presencial',
  sistema_modular: 'Sistema modular',
  sistema_modular_en_linea: 'Sistema modular en línea',
  sistema_modular_presencial_tec: 'Sistema modular presencial (TEC)',
  mad: 'MAD',
  ects: 'ECTS',
  red: 'RED',
  listening_and_speaking_linea: 'Listening & Speaking en línea',
  listening_and_speaking_presencial: 'Listening & Speaking presencial',
  medicina_familiar: 'Medicina familiar',
  especialidades_medicas: 'Especialidades médicas',
  no_especificada: 'No especificada',
}

export function isValidYmd(value: string): boolean {
  if (!YMD.test(value)) return false
  const [y, m, d] = value.split('-').map((x) => parseInt(x, 10))
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/** Acentos comunes y espacios → clave al estilo `gestion_academica` para el mapa. */
function normalizeCategoryLookupKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ñ/g, 'n')
    .replace(/\s+/g, '_')
}

export function mapSourceCategoryToUi(categoria: string): string {
  const direct = UTPL_SOURCE_CATEGORY_TO_UI[categoria]
  if (direct) return direct
  const slug = normalizeCategoryLookupKey(categoria)
  return UTPL_SOURCE_CATEGORY_TO_UI[slug] ?? 'Otro'
}

export function formatModalities(modalidades: string[]): string {
  const parts = modalidades.map((slug) => {
    const key = slug.trim().toLowerCase()
    return UTPL_MODALITY_SLUG_TO_LABEL[key] ?? capitalizeSlug(slug)
  })
  const uniq = [...new Set(parts)]
  if (uniq.length === 1) return uniq[0]
  return uniq.join(' / ')
}

function capitalizeSlug(slug: string): string {
  return slug
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

/** ID estable y positivo a partir de archivo + id de evento + índice de fecha. */
export function stableCalendarRecordId(fileName: string, eventoId: string, fechaIndex: number): number {
  const s = `${fileName}|${eventoId}|${fechaIndex}`
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const n = h >>> 0
  return n === 0 ? 1 : n
}

function buildTitle(nombre: string, notas: string | null | undefined): string {
  const n = notas?.trim()
  if (!n) return nombre
  if (n.length > 180) return `${nombre} (${n.slice(0, 177)}…)`
  return `${nombre} (${n})`
}

/**
 * Fusiona varias fuentes JSON en registros listos para `EventManager` / lista académica.
 */
export function mergeUtplCalendarSources(inputs: MergeCalendarSourceInput[]): MergeCalendarResult {
  const warnings: string[] = []
  const errors: string[] = []
  const records: AcademicCalendarEventRecord[] = []

  for (const { fileName, data } of inputs) {
    if (!data.eventos || !Array.isArray(data.eventos)) {
      errors.push(`${fileName}: falta array "eventos"`)
      continue
    }

    const seenIds = new Set<string>()
    for (const ev of data.eventos) {
      if (!ev.id) {
        errors.push(`${fileName}: evento sin "id" (${ev.nombre ?? '?'})`)
        continue
      }
      if (seenIds.has(ev.id)) {
        errors.push(`${fileName}: id duplicado "${ev.id}"`)
      }
      seenIds.add(ev.id)

      const category = mapSourceCategoryToUi(ev.categoria)
      if (category === 'Otro' && ev.categoria) {
        warnings.push(`${fileName}: categoría sin mapeo "${ev.categoria}" → Otro`)
      }

      const modality = formatModalities(ev.modalidades ?? [])
      const title = buildTitle(ev.nombre ?? '', ev.notas)

      const fechas = ev.fechas ?? []
      if (fechas.length === 0) {
        warnings.push(`${fileName}: evento "${ev.id}" sin fechas, se omite`)
        continue
      }

      fechas.forEach((f, fechaIndex) => {
        const { inicio, fin } = f
        if (!isValidYmd(inicio)) {
          errors.push(`${fileName}: "${ev.id}" fecha inválida inicio="${inicio}"`)
          return
        }
        if (!isValidYmd(fin)) {
          errors.push(`${fileName}: "${ev.id}" fecha inválida fin="${fin}"`)
          return
        }
        if (inicio > fin) {
          errors.push(`${fileName}: "${ev.id}" inicio > fin (${inicio} > ${fin})`)
          return
        }

        records.push({
          id: stableCalendarRecordId(fileName, ev.id, fechaIndex),
          title,
          start: inicio,
          end: fin,
          category,
          modality,
        })
      })
    }
  }

  return { records, warnings, errors }
}
