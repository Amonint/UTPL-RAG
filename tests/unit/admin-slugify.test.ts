import { describe, expect, it } from 'vitest'

import {
  catalogCodeFromName,
  slugify,
  studentTypeCodeFromName,
  uniqueCatalogCode,
} from '@/lib/admin/slugify'

describe('slugify', () => {
  it('normalizes accents and spaces', () => {
    expect(slugify('Matrícula Ordinaria')).toBe('matricula-ordinaria')
  })

  it('returns item for empty input', () => {
    expect(slugify('')).toBe('item')
  })
})

describe('catalogCodeFromName', () => {
  it('uses snake_case without accents', () => {
    expect(catalogCodeFromName('Lengua Extranjera')).toBe('lengua_extranjera')
    expect(catalogCodeFromName('Calendarios')).toBe('calendarios')
  })

  it('prefixes when the first char is not a letter', () => {
    expect(catalogCodeFromName('2026 Nuevo')).toBe('x_2026_nuevo')
  })
})

describe('studentTypeCodeFromName', () => {
  it('uppercases catalog code', () => {
    expect(studentTypeCodeFromName('Estudiante nuevo')).toBe('ESTUDIANTE_NUEVO')
  })
})

describe('uniqueCatalogCode', () => {
  it('appends numeric suffix on collision', () => {
    expect(uniqueCatalogCode('calendar', ['calendar', 'calendar_2'])).toBe('calendar_3')
  })
})
