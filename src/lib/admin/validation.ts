import { z } from 'zod'

export const editorialStatusSchema = z.enum([
  'ingest_draft',
  'editorial_draft',
  'review',
  'approved',
  'published',
  'archived',
])

export const sectionCodeSchema = z.enum(['general_info', 'faq'])

export const contentTypeSchema = z.enum(['faq', 'service', 'incident', 'calendar', 'guide'])

export const stringArraySchema = z.array(z.string().trim().min(1)).default([])

export const createCategorySchema = z.object({
  domainId: z.uuid(),
  name: z.string().trim().min(1).max(500),
  slug: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  sortOrder: z.number().int().min(0).optional(),
})

export const patchCategorySchema = createCategorySchema
  .partial()
  .extend({ id: z.uuid() })
  .required({ id: true })

export const createSubcategorySchema = z.object({
  categoryId: z.uuid(),
  name: z.string().trim().min(1).max(500),
  slug: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  sortOrder: z.number().int().min(0).optional(),
})

export const patchSubcategorySchema = createSubcategorySchema
  .partial()
  .extend({ id: z.uuid() })
  .required({ id: true })

export const createElementSchema = z.object({
  subcategoryId: z.uuid(),
  name: z.string().trim().min(1).max(500),
  slug: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  elementType: z.string().trim().max(100).optional(),
})

export const patchElementSchema = createElementSchema
  .partial()
  .extend({ id: z.uuid() })
  .required({ id: true })

export const audienceInputSchema = z.object({
  profileCode: z.string().trim().min(1).default('student'),
  profileTypeCode: z.string().trim().optional().nullable(),
  programLevelCode: z.string().trim().optional().nullable(),
  studentTypeCode: z.string().trim().optional().nullable(),
  priority: z.number().int().min(0).optional(),
})

export const createItemSchema = z
  .object({
    kbElementId: z.uuid(),
    domainId: z.uuid(),
    sectionCode: sectionCodeSchema.default('faq'),
    contentType: contentTypeSchema.default('faq'),
    title: z.string().trim().min(1).max(1000),
    canonicalSlug: z.string().trim().min(1).max(300).optional(),
    /** Subtítulo (documentos) o pregunta (FAQ). */
    questionText: z.string().trim().optional().default(''),
    answerText: z.string().trim().min(1),
    searchForms: stringArraySchema.optional().default([]),
    phrases: stringArraySchema.optional().default([]),
    synonyms: stringArraySchema.optional().default([]),
    periodLabel: z.string().trim().max(200).optional(),
    responsibleName: z.string().trim().optional(),
    editorialStatus: editorialStatusSchema.default('editorial_draft'),
    validFrom: z.string().date().optional().nullable(),
    validTo: z.string().date().optional().nullable(),
    audiences: z.array(audienceInputSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.sectionCode === 'faq' && !data.questionText?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['questionText'],
        message: 'La pregunta es obligatoria en preguntas frecuentes.',
      })
    }
  })

/** Alta simplificada desde asesores: Dominio → Categoría → Subcategoría (ancla General). */
export const advisorCreateItemSchema = z
  .object({
    sectionCode: sectionCodeSchema,
    domainId: z.uuid(),
    subcategoryId: z.uuid(),
    title: z.string().trim().max(1000).optional(),
    questionText: z.string().trim().optional().default(''),
    answerText: z.string().trim().min(1, 'El contenido es obligatorio'),
  })
  .superRefine((data, ctx) => {
    if (data.sectionCode === 'faq') {
      if (!data.questionText?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['questionText'],
          message: 'La pregunta es obligatoria.',
        })
      } else if (data.questionText.trim().length < 10) {
        ctx.addIssue({
          code: 'custom',
          path: ['questionText'],
          message: 'La pregunta debe tener al menos 10 caracteres.',
        })
      }
      if (data.answerText.trim().length < 10) {
        ctx.addIssue({
          code: 'custom',
          path: ['answerText'],
          message: 'La respuesta debe tener al menos 10 caracteres.',
        })
      }
    } else {
      if (!data.title?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['title'],
          message: 'El título es obligatorio.',
        })
      }
      if (data.answerText.trim().length < 10) {
        ctx.addIssue({
          code: 'custom',
          path: ['answerText'],
          message: 'El contenido debe tener al menos 10 caracteres.',
        })
      }
    }
  })

export const patchItemSchema = z.object({
  sectionCode: sectionCodeSchema.optional(),
  contentType: contentTypeSchema.optional(),
  title: z.string().trim().min(1).max(1000).optional(),
  editorialStatus: editorialStatusSchema.optional(),
  isActive: z.boolean().optional(),
  validFrom: z.string().date().optional().nullable(),
  validTo: z.string().date().optional().nullable(),
  periodLabel: z.string().trim().max(200).optional().nullable(),
  reviewPolicy: z.string().trim().max(500).optional().nullable(),
})

export const createVersionSchema = z.object({
  questionText: z.string().trim().optional().default(''),
  answerText: z.string().trim().min(1),
  searchForms: stringArraySchema.optional().default([]),
  phrases: stringArraySchema.optional().default([]),
  synonyms: stringArraySchema.optional().default([]),
  changeSummary: z.string().trim().max(500).optional(),
})

export const importDocumentInputSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive().max(20 * 1024 * 1024),
  mimeType: z.literal('application/pdf'),
})

const geminiTaxonomySelectionSchema = z.object({
  domainCode: z.string().trim().min(1),
  categorySlug: z.string().trim().min(1),
  subcategorySlug: z.string().trim().min(1),
  elementSlug: z.string().trim().min(1),
})

const geminiAudienceSelectionSchema = z.object({
  profileTypeCode: z.string().trim().min(1).optional(),
  studentTypeCode: z.string().trim().min(1).optional(),
})

const geminiFaqBlockSchema = z.object({
  sectionCode: z.literal('faq'),
  taxonomy: geminiTaxonomySelectionSchema,
  audience: geminiAudienceSelectionSchema.optional(),
  title: z.string().trim().min(1).max(1000),
  questionText: z.string().trim().min(1),
  answerText: z.string().trim().min(1),
})

const geminiInfoBlockSchema = z.object({
  sectionCode: z.literal('general_info'),
  taxonomy: geminiTaxonomySelectionSchema,
  audience: geminiAudienceSelectionSchema.optional(),
  title: z.string().trim().min(1).max(1000),
  subtitle: z.string().trim().max(1000).optional(),
  periodCode: z.string().trim().min(1).optional(),
  validFrom: z.string().date().optional(),
  validTo: z.string().date().optional(),
  answerText: z.string().trim().min(1),
})

export const geminiImportBlockSchema = z.discriminatedUnion('sectionCode', [
  geminiFaqBlockSchema,
  geminiInfoBlockSchema,
])

export const geminiImportResultSchema = z.object({
  blocks: z.array(geminiImportBlockSchema).min(1),
})

export const listItemsQuerySchema = z.object({
  q: z.string().optional(),
  domainCode: z.string().optional(),
  categorySlug: z.string().optional(),
  editorialStatus: editorialStatusSchema.optional(),
  sectionCode: sectionCodeSchema.optional(),
  profileTypeCode: z.string().trim().min(1).optional(),
  studentTypeCode: z.string().trim().min(1).optional(),
  periodLabel: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

const catalogCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z][a-z0-9_]*$/i, 'Use solo letras, números y guión bajo.')

export const createDomainSchema = z.object({
  code: catalogCodeSchema.optional(),
  name: z.string().trim().min(1).max(500),
  description: z.string().trim().max(2000).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

export const patchDomainSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(500).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .required({ id: true })

export const createProfileTypeSchema = z.object({
  typeCode: catalogCodeSchema.optional(),
  name: z.string().trim().min(1).max(500),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

export const patchProfileTypeSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(500).optional(),
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .required({ id: true })

const studentTypeCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[A-Z][A-Z0-9_]*$/, 'Use mayúsculas y guión bajo (ej. NUEVO).')

export const createStudentTypeSchema = z.object({
  code: studentTypeCodeSchema.optional(),
  name: z.string().trim().min(1).max(500),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

export const patchStudentTypeSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(500).optional(),
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .required({ id: true })

export const createAdvisorSectionSchema = z.object({
  code: catalogCodeSchema.optional(),
  name: z.string().trim().min(1).max(500),
  hint: z.string().trim().max(2000).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

export const patchAdvisorSectionSchema = z
  .object({
    code: catalogCodeSchema,
    name: z.string().trim().min(1).max(500).optional(),
    hint: z.string().trim().max(2000).optional().nullable(),
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .required({ code: true })

export const createEditorialStatusSchema = z.object({
  code: catalogCodeSchema.optional(),
  name: z.string().trim().min(1).max(500),
  description: z.string().trim().max(2000).optional(),
  sortOrder: z.number().int().min(0).optional(),
  showInFilter: z.boolean().optional(),
  showInForm: z.boolean().optional(),
})

export const patchEditorialStatusSchema = z
  .object({
    code: catalogCodeSchema,
    name: z.string().trim().min(1).max(500).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    showInFilter: z.boolean().optional(),
    showInForm: z.boolean().optional(),
  })
  .required({ code: true })

/** Códigos UTPL de periodo (p. ej. 202630) o slug alfabético. */
const cyclePeriodCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9_-]*$/i, 'Use letras, números, guión o guión bajo.')

export const createCyclePeriodSchema = z
  .object({
    code: cyclePeriodCodeSchema.optional(),
    name: z.string().trim().min(1).max(500),
    startsOn: z.string().date().optional().nullable(),
    endsOn: z.string().date().optional().nullable(),
    academicYear: z.number().int().min(2000).max(2100).optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (!data.startsOn || !data.endsOn) return true
      return data.startsOn <= data.endsOn
    },
    { message: 'La fecha de fin debe ser posterior o igual a la de inicio.', path: ['endsOn'] },
  )

export const patchCyclePeriodSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(500).optional(),
    startsOn: z.string().date().optional().nullable(),
    endsOn: z.string().date().optional().nullable(),
    academicYear: z.number().int().min(2000).max(2100).optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .required({ id: true })

export const calendarEventScopeSchema = z.object({
  domainCode: z.string().trim().min(1).max(80),
  profileTypeCode: z.string().trim().min(1).max(80),
  studentTypeCode: z.string().trim().min(1).max(80),
  periodLabel: z.string().trim().min(1).max(200),
  periodValidFrom: z.string().date().optional(),
  periodValidTo: z.string().date().optional(),
  periodCode: z.string().trim().min(1).max(80).optional(),
  source: z.string().trim().min(1).max(80).optional(),
  editorialStatus: z.enum(['review', 'published']).optional(),
})

export const createCalendarEventSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    eventType: z.string().trim().min(1).max(120),
    startsOn: z.string().date(),
    endsOn: z.string().date(),
    scope: calendarEventScopeSchema,
  })
  .refine((data) => data.startsOn <= data.endsOn, {
    message: 'La fecha de fin debe ser igual o posterior a la de inicio.',
    path: ['endsOn'],
  })

export const patchCalendarEventSchema = z
  .object({
    title: z.string().trim().min(1).max(500).optional(),
    eventType: z.string().trim().min(1).max(120).optional(),
    startsOn: z.string().date().optional(),
    endsOn: z.string().date().optional(),
    scope: calendarEventScopeSchema.optional(),
  })
  .refine(
    (data) => {
      if (data.startsOn && data.endsOn) return data.startsOn <= data.endsOn
      return true
    },
    { message: 'La fecha de fin debe ser igual o posterior a la de inicio.', path: ['endsOn'] },
  )

export const listCalendarEventsQuerySchema = z.object({
  domainCode: z.string().trim().min(1).optional(),
  profileTypeCode: z.string().trim().min(1).optional(),
  studentTypeCode: z.string().trim().min(1).optional(),
  periodLabel: z.string().trim().min(1).max(200).optional(),
  periodValidFrom: z.string().date().optional(),
  periodValidTo: z.string().date().optional(),
  includePast: z
    .enum(['1', '0', 'true', 'false'])
    .optional()
    .transform((v) => v === '1' || v === 'true'),
})
