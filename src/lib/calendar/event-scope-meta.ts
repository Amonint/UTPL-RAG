import { z } from 'zod'

export const calendarEventScopeMetaSchema = z.object({
  domainCode: z.string().trim().min(1).optional(),
  profileTypeCode: z.string().trim().min(1).optional(),
  studentTypeCode: z.string().trim().min(1).optional(),
  periodLabel: z.string().trim().min(1).optional(),
  periodValidFrom: z.string().date().optional(),
  periodValidTo: z.string().date().optional(),
  /** Código oficial del periodo (p. ej. 202630). Evita crear slugs duplicados. */
  periodCode: z.string().trim().min(1).max(80).optional(),
  /** Origen de la carga (p. ej. cargar). */
  source: z.string().trim().min(1).max(80).optional(),
  /** review = pendiente de validación en /admin/calendar; published = visible al asesor. */
  editorialStatus: z.enum(['review', 'published']).optional(),
})

export type CalendarEventScopeMeta = z.infer<typeof calendarEventScopeMetaSchema>

export function encodeScopeMeta(meta: CalendarEventScopeMeta): string {
  return JSON.stringify(meta)
}

export function decodeScopeMeta(detailsText: string | null | undefined): CalendarEventScopeMeta | null {
  if (!detailsText?.trim()) return null
  const raw = detailsText.trim()
  if (!raw.startsWith('{')) return null
  try {
    const parsed = calendarEventScopeMetaSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export type CalendarEditorialStatus = 'review' | 'published'

export function calendarEventEditorialStatus(
  scope: CalendarEventScopeMeta | null | undefined,
): CalendarEditorialStatus {
  return scope?.editorialStatus === 'review' ? 'review' : 'published'
}

export function isCalendarEventPendingReview(scope: CalendarEventScopeMeta | null | undefined): boolean {
  return calendarEventEditorialStatus(scope) === 'review'
}

/** Modalidad de catálogo admin → código en tabla `modalities` (ETL / cronogramas). */
export const PROFILE_TYPE_TO_MODALITY_CODE: Record<string, string> = {
  presencial: 'presencial',
  /** Histórico: Distancia se unificó con En línea. */
  distancia: 'en_linea',
  en_linea: 'en_linea',
  hibrida: 'hibrida',
  sin_tipo: 'todas',
}
