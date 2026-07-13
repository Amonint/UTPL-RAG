import { describe, expect, it } from 'vitest'

import { listItemsQuerySchema } from '@/lib/admin/validation'
import {
  audienceChipLabels,
  editorPageTitle,
  formatAdvisorMenuPreview,
  formatMenuPath,
  editorialStatusBadgeClass,
  labelEditorialStatus,
  labelSection,
  SECTION_LABELS,
} from '@/lib/admin/ui-labels'

describe('admin ui-labels', () => {
  it('traduce secciones sin mostrar códigos internos', () => {
    expect(labelSection('faq')).toBe('Preguntas frecuentes')
    expect(labelSection('general_info')).toBe('Información')
    expect(SECTION_LABELS.faq).not.toContain('faq')
  })

  it('traduce estados editoriales', () => {
    expect(labelEditorialStatus('published')).toBe('Publicado')
    expect(labelEditorialStatus('editorial_draft')).toBe('Borrador')
  })

  it('asigna color semántico a la pastilla de estado', () => {
    expect(editorialStatusBadgeClass('published')).toContain('emerald')
    expect(editorialStatusBadgeClass('review')).toContain('amber')
    expect(editorialStatusBadgeClass('archived')).toContain('red')
    expect(editorialStatusBadgeClass('editorial_draft')).toContain('slate')
  })

  it('titula el editor según sección al crear', () => {
    expect(editorPageTitle(true, 'general_info')).toBe('Nueva información')
    expect(editorPageTitle(true, 'faq')).toBe('Nueva pregunta frecuente')
    expect(editorPageTitle(false, 'faq')).toBe('Editar entrada')
  })

  it('formatea ruta del menú', () => {
    expect(
      formatMenuPath({
        category: 'Matrícula',
        subcategory: 'Presencial',
        element: 'Fechas',
      }),
    ).toBe('Matrícula › Presencial › Fechas')
  })

  it('omite el ancla General en la ruta del menú', () => {
    expect(
      formatMenuPath({
        category: 'Pagos y descuentos',
        subcategory: 'Matrícula',
        element: 'General',
      }),
    ).toBe('Pagos y descuentos › Matrícula')
  })

  it('previsualiza el menú como lo ve el asesor', () => {
    expect(
      formatAdvisorMenuPreview('general_info', {
        category: 'Calendarios',
        subcategory: 'Académico',
        element: 'Fechas de matrícula',
      }),
    ).toBe('Información › Calendarios › Académico › Fechas de matrícula')
  })

  it('genera chips de audiencia legibles', () => {
    const chips = audienceChipLabels([
      {
        profileTypeCode: 'presencial',
        profileTypeName: 'Presencial',
        studentTypeCode: 'CONTINUO',
        studentTypeName: 'Continuo',
      },
    ])
    expect(chips).toContain('Presencial')
    expect(chips).toContain('Continuo')
  })

  it('acepta filtros de modalidad y tipo de estudiante en listado', () => {
    const parsed = listItemsQuerySchema.parse({
      profileTypeCode: 'presencial',
      studentTypeCode: 'NUEVO',
    })
    expect(parsed.profileTypeCode).toBe('presencial')
    expect(parsed.studentTypeCode).toBe('NUEVO')
  })
})
