import type { PoolClient } from 'pg'

import {
  catalogCodeFromName,
  studentTypeCodeFromName,
  uniqueCatalogCode,
} from '@/lib/admin/slugify'
import { dbQuery } from '@/lib/db/postgres'
import { dbQueryClient } from '@/lib/db/transaction'

export interface AdminDomainRow {
  id: string
  code: string
  name: string
  description: string | null
  sortOrder: number
  isActive: boolean
}

export interface AdminProfileTypeRow {
  id: string
  profileCode: string
  typeCode: string
  name: string
  sortOrder: number
  isActive: boolean
}

export interface AdminStudentTypeRow {
  id: string
  code: string
  name: string
  sortOrder: number
  isActive: boolean
}

async function defaultStudentRootId(client?: PoolClient): Promise<string> {
  const run = client
    ? (text: string) => dbQueryClient<{ id: string }>(client, text)
    : (text: string) => dbQuery<{ id: string }>(text)
  const { rows } = await run(`
    select id::text
    from student_root
    where is_active
    order by created_at asc
    limit 1
  `)
  if (!rows[0]?.id) {
    throw new Error('No hay configuración de estudiante (student_root) en la base de datos.')
  }
  return rows[0].id
}

export async function fetchDomains() {
  const { rows } = await dbQuery<{
    id: string
    code: string
    name: string
  }>(`
    select id::text, code, name
    from domains
    where is_active
    order by sort_order asc, name asc
  `)
  return rows.map((r) => ({ id: r.id, code: r.code, name: r.name }))
}

export async function fetchProfileTypes() {
  const { rows } = await dbQuery<{
    id: string
    profile_code: string
    type_code: string
    name: string
  }>(`
    select id::text, profile_code, type_code, name
    from profile_type_catalog
    where is_active
    order by profile_code asc, sort_order asc, name asc
  `)
  return rows.map((r) => ({
    id: r.id,
    profileCode: r.profile_code,
    typeCode: r.type_code,
    name: r.name,
  }))
}

export async function fetchProgramLevels() {
  const { rows } = await dbQuery<{ code: string; name: string }>(`
    select code, name
    from program_level_catalog
    where is_active
    order by sort_order asc, name asc
  `)
  return rows.map((r) => ({ code: r.code, name: r.name }))
}

export async function fetchStudentTypes() {
  const { rows } = await dbQuery<{ id: string; code: string; name: string }>(`
    select id::text, code, name
    from student_types
    where is_active
    order by sort_order asc, name asc
  `)
  return rows.map((r) => ({ id: r.id, code: r.code, name: r.name }))
}

export async function resolveProfileTypeId(
  profileCode: string,
  profileTypeCode: string | null | undefined,
): Promise<string | null> {
  if (!profileTypeCode || profileTypeCode === 'sin_tipo') {
    const { rows } = await dbQuery<{ id: string }>(
      `
        select id::text
        from profile_type_catalog
        where profile_code = $1 and type_code = 'sin_tipo'
        limit 1
      `,
      [profileCode],
    )
    return rows[0]?.id ?? null
  }
  const { rows } = await dbQuery<{ id: string }>(
    `
      select id::text
      from profile_type_catalog
      where profile_code = $1 and type_code = $2
      limit 1
    `,
    [profileCode, profileTypeCode],
  )
  return rows[0]?.id ?? null
}

export async function resolveStudentTypeId(code: string | null | undefined): Promise<string | null> {
  if (!code) return null
  const { rows } = await dbQuery<{ id: string }>(
    `select id::text from student_types where code = $1 limit 1`,
    [code],
  )
  return rows[0]?.id ?? null
}

export async function fetchDomainsForAdmin(): Promise<AdminDomainRow[]> {
  const { rows } = await dbQuery<{
    id: string
    code: string
    name: string
    description: string | null
    sort_order: number
    is_active: boolean
  }>(`
    select id::text, code, name, description, sort_order, is_active
    from domains
    order by sort_order asc, name asc
  `)
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description,
    sortOrder: r.sort_order,
    isActive: r.is_active,
  }))
}

async function resolveDomainCode(
  client: PoolClient,
  studentRootId: string,
  name: string,
  explicitCode?: string,
): Promise<string> {
  const { rows } = await dbQueryClient<{ code: string }>(
    client,
    `select code from domains where student_root_id = $1`,
    [studentRootId],
  )
  const base = (explicitCode?.trim() || catalogCodeFromName(name)).toLowerCase()
  return uniqueCatalogCode(base, rows.map((r) => r.code))
}

export async function createDomain(
  client: PoolClient,
  input: {
    code?: string
    name: string
    description?: string
    sortOrder?: number
    isActive?: boolean
  },
): Promise<string> {
  const studentRootId = await defaultStudentRootId(client)
  const code = await resolveDomainCode(client, studentRootId, input.name, input.code)
  const { rows } = await dbQueryClient<{ id: string }>(
    client,
    `
      insert into domains (student_root_id, code, name, description, sort_order, is_active)
      values ($1, $2, $3, $4, coalesce($5, 0), coalesce($6, true))
      returning id::text
    `,
    [
      studentRootId,
      code,
      input.name,
      input.description ?? null,
      input.sortOrder ?? 0,
      input.isActive ?? true,
    ],
  )
  return rows[0].id
}

export async function patchDomain(
  client: PoolClient,
  id: string,
  input: Partial<{ name: string; description: string | null; sortOrder: number; isActive: boolean }>,
): Promise<void> {
  const sets: string[] = ['updated_at = now()']
  const values: unknown[] = []
  if (input.name !== undefined) {
    values.push(input.name)
    sets.push(`name = $${values.length}`)
  }
  if (input.description !== undefined) {
    values.push(input.description)
    sets.push(`description = $${values.length}`)
  }
  if (input.sortOrder !== undefined) {
    values.push(input.sortOrder)
    sets.push(`sort_order = $${values.length}`)
  }
  if (input.isActive !== undefined) {
    values.push(input.isActive)
    sets.push(`is_active = $${values.length}`)
  }
  values.push(id)
  await dbQueryClient(client, `update domains set ${sets.join(', ')} where id = $${values.length}`, values)
}

export async function fetchStudentProfileTypesForAdmin(): Promise<AdminProfileTypeRow[]> {
  const { rows } = await dbQuery<{
    id: string
    profile_code: string
    type_code: string
    name: string
    sort_order: number
    is_active: boolean
  }>(`
    select id::text, profile_code, type_code, name, sort_order, is_active
    from profile_type_catalog
    where profile_code = 'student'
    order by sort_order asc, name asc
  `)
  return rows.map((r) => ({
    id: r.id,
    profileCode: r.profile_code,
    typeCode: r.type_code,
    name: r.name,
    sortOrder: r.sort_order,
    isActive: r.is_active,
  }))
}

async function resolveProfileTypeCode(
  client: PoolClient,
  name: string,
  explicitTypeCode?: string,
): Promise<string> {
  const { rows } = await dbQueryClient<{ type_code: string }>(
    client,
    `select type_code from profile_type_catalog where profile_code = 'student'`,
  )
  const base = (explicitTypeCode?.trim() || catalogCodeFromName(name)).toLowerCase()
  return uniqueCatalogCode(base, rows.map((r) => r.type_code))
}

export async function createStudentProfileType(
  client: PoolClient,
  input: { typeCode?: string; name: string; sortOrder?: number; isActive?: boolean },
): Promise<string> {
  const typeCode = await resolveProfileTypeCode(client, input.name, input.typeCode)
  const { rows } = await dbQueryClient<{ id: string }>(
    client,
    `
      insert into profile_type_catalog (profile_code, type_code, name, sort_order, is_active)
      values ('student', $1, $2, coalesce($3, 0), coalesce($4, true))
      returning id::text
    `,
    [typeCode, input.name, input.sortOrder ?? 0, input.isActive ?? true],
  )
  return rows[0].id
}

export async function patchStudentProfileType(
  client: PoolClient,
  id: string,
  input: Partial<{ name: string; sortOrder: number; isActive: boolean }>,
): Promise<void> {
  const sets: string[] = []
  const values: unknown[] = []
  if (input.name !== undefined) {
    values.push(input.name)
    sets.push(`name = $${values.length}`)
  }
  if (input.sortOrder !== undefined) {
    values.push(input.sortOrder)
    sets.push(`sort_order = $${values.length}`)
  }
  if (input.isActive !== undefined) {
    values.push(input.isActive)
    sets.push(`is_active = $${values.length}`)
  }
  if (sets.length === 0) return
  values.push(id)
  await dbQueryClient(
    client,
    `update profile_type_catalog set ${sets.join(', ')} where id = $${values.length} and profile_code = 'student'`,
    values,
  )
}

export async function fetchStudentTypesForAdmin(): Promise<AdminStudentTypeRow[]> {
  const { rows } = await dbQuery<{
    id: string
    code: string
    name: string
    sort_order: number
    is_active: boolean
  }>(`
    select id::text, code, name, sort_order, is_active
    from student_types
    order by sort_order asc, name asc
  `)
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    sortOrder: r.sort_order,
    isActive: r.is_active,
  }))
}

async function resolveStudentTypeCode(
  client: PoolClient,
  name: string,
  explicitCode?: string,
): Promise<string> {
  const { rows } = await dbQueryClient<{ code: string }>(
    client,
    `select code from student_types`,
  )
  const base = (explicitCode?.trim() || studentTypeCodeFromName(name)).toUpperCase()
  return uniqueCatalogCode(base, rows.map((r) => r.code))
}

export async function createStudentType(
  client: PoolClient,
  input: { code?: string; name: string; sortOrder?: number; isActive?: boolean },
): Promise<string> {
  const code = await resolveStudentTypeCode(client, input.name, input.code)
  const { rows } = await dbQueryClient<{ id: string }>(
    client,
    `
      insert into student_types (code, name, sort_order, is_active)
      values ($1, $2, coalesce($3, 0), coalesce($4, true))
      returning id::text
    `,
    [code, input.name, input.sortOrder ?? 0, input.isActive ?? true],
  )
  return rows[0].id
}

export async function patchStudentType(
  client: PoolClient,
  id: string,
  input: Partial<{ name: string; sortOrder: number; isActive: boolean }>,
): Promise<void> {
  const sets: string[] = []
  const values: unknown[] = []
  if (input.name !== undefined) {
    values.push(input.name)
    sets.push(`name = $${values.length}`)
  }
  if (input.sortOrder !== undefined) {
    values.push(input.sortOrder)
    sets.push(`sort_order = $${values.length}`)
  }
  if (input.isActive !== undefined) {
    values.push(input.isActive)
    sets.push(`is_active = $${values.length}`)
  }
  if (sets.length === 0) return
  values.push(id)
  await dbQueryClient(client, `update student_types set ${sets.join(', ')} where id = $${values.length}`, values)
}

export async function countAudienceUsageForProfileType(profileTypeId: string): Promise<number> {
  const { rows } = await dbQuery<{ count: string }>(
    `
      select count(*)::text as count
      from knowledge_item_audiences
      where profile_type_id = $1::uuid
    `,
    [profileTypeId],
  )
  return Number(rows[0]?.count ?? 0)
}

export async function countAudienceUsageForStudentType(studentTypeId: string): Promise<number> {
  const { rows } = await dbQuery<{ count: string }>(
    `
      select count(*)::text as count
      from knowledge_item_audiences
      where student_type_id = $1::uuid
    `,
    [studentTypeId],
  )
  return Number(rows[0]?.count ?? 0)
}

export interface AdminSectionRow {
  code: string
  name: string
  hint: string | null
  sortOrder: number
  isActive: boolean
  isSystem: boolean
}

export interface AdminEditorialStatusRow {
  code: string
  name: string
  description: string | null
  sortOrder: number
  isActive: boolean
  showInFilter: boolean
  showInForm: boolean
  isSystem: boolean
}

export interface AdminCyclePeriodRow {
  id: string
  code: string
  name: string
  startsOn: string | null
  endsOn: string | null
  academicYear: number | null
  isActive: boolean
}

export async function fetchAdvisorSections(activeOnly = false) {
  const { rows } = await dbQuery<{ code: string; name: string; hint: string | null }>(`
    select code, name, hint
    from advisor_section_catalog
    where ${activeOnly ? 'is_active' : 'true'}
    order by sort_order asc, name asc
  `)
  return rows.map((r) => ({ code: r.code, name: r.name, hint: r.hint }))
}

export async function fetchSectionsForAdmin(): Promise<AdminSectionRow[]> {
  const { rows } = await dbQuery<{
    code: string
    name: string
    hint: string | null
    sort_order: number
    is_active: boolean
  }>(`
    select code, name, hint, sort_order, is_active
    from advisor_section_catalog
    order by sort_order asc, name asc
  `)
  return rows.map((r) => ({
    code: r.code,
    name: r.name,
    hint: r.hint,
    sortOrder: r.sort_order,
    isActive: r.is_active,
    isSystem: r.code === 'faq' || r.code === 'general_info',
  }))
}

async function resolveSectionCode(
  client: PoolClient,
  name: string,
  explicitCode?: string,
): Promise<string> {
  const { rows } = await dbQueryClient<{ code: string }>(
    client,
    `select code from advisor_section_catalog`,
  )
  const base = (explicitCode?.trim() || catalogCodeFromName(name)).toLowerCase()
  return uniqueCatalogCode(base, rows.map((r) => r.code))
}

export async function createAdvisorSection(
  client: PoolClient,
  input: { code?: string; name: string; hint?: string; sortOrder?: number; isActive?: boolean },
): Promise<string> {
  const code = await resolveSectionCode(client, input.name, input.code)
  await dbQueryClient(
    client,
    `
      insert into advisor_section_catalog (code, name, hint, sort_order, is_active)
      values ($1, $2, $3, coalesce($4, 0), coalesce($5, true))
    `,
    [code, input.name, input.hint ?? null, input.sortOrder ?? 0, input.isActive ?? true],
  )
  return code
}

export async function patchAdvisorSection(
  client: PoolClient,
  code: string,
  input: Partial<{ name: string; hint: string | null; sortOrder: number; isActive: boolean }>,
): Promise<void> {
  const sets: string[] = ['updated_at = now()']
  const values: unknown[] = []
  if (input.name !== undefined) {
    values.push(input.name)
    sets.push(`name = $${values.length}`)
  }
  if (input.hint !== undefined) {
    values.push(input.hint)
    sets.push(`hint = $${values.length}`)
  }
  if (input.sortOrder !== undefined) {
    values.push(input.sortOrder)
    sets.push(`sort_order = $${values.length}`)
  }
  if (input.isActive !== undefined) {
    values.push(input.isActive)
    sets.push(`is_active = $${values.length}`)
  }
  values.push(code)
  await dbQueryClient(
    client,
    `update advisor_section_catalog set ${sets.join(', ')} where code = $${values.length}`,
    values,
  )
}

export async function fetchEditorialStatuses(activeOnly = false, forFilter = false) {
  const clauses = [activeOnly ? 'is_active' : 'true']
  if (forFilter) clauses.push('show_in_filter')
  const { rows } = await dbQuery<{
    code: string
    name: string
    show_in_form: boolean
  }>(`
    select code, name, show_in_form
    from editorial_status_catalog
    where ${clauses.join(' and ')}
    order by sort_order asc, name asc
  `)
  return rows.map((r) => ({
    code: r.code,
    name: r.name,
    showInForm: r.show_in_form,
  }))
}

export async function fetchEditorialStatusesForAdmin(): Promise<AdminEditorialStatusRow[]> {
  const { rows } = await dbQuery<{
    code: string
    name: string
    description: string | null
    sort_order: number
    is_active: boolean
    show_in_filter: boolean
    show_in_form: boolean
    is_system: boolean
  }>(`
    select code, name, description, sort_order, is_active, show_in_filter, show_in_form, is_system
    from editorial_status_catalog
    order by sort_order asc, name asc
  `)
  return rows.map((r) => ({
    code: r.code,
    name: r.name,
    description: r.description,
    sortOrder: r.sort_order,
    isActive: r.is_active,
    showInFilter: r.show_in_filter,
    showInForm: r.show_in_form,
    isSystem: r.is_system,
  }))
}

async function resolveEditorialStatusCode(
  client: PoolClient,
  name: string,
  explicitCode?: string,
): Promise<string> {
  const { rows } = await dbQueryClient<{ code: string }>(
    client,
    `select code from editorial_status_catalog`,
  )
  const base = explicitCode?.trim() || catalogCodeFromName(name)
  return uniqueCatalogCode(base, rows.map((r) => r.code))
}

export async function createEditorialStatus(
  client: PoolClient,
  input: {
    code?: string
    name: string
    description?: string
    sortOrder?: number
    showInFilter?: boolean
    showInForm?: boolean
  },
): Promise<string> {
  const code = await resolveEditorialStatusCode(client, input.name, input.code)
  await dbQueryClient(
    client,
    `
      insert into editorial_status_catalog (
        code, name, description, sort_order, is_active, show_in_filter, show_in_form, is_system
      )
      values ($1, $2, $3, coalesce($4, 0), true, coalesce($5, true), coalesce($6, true), false)
    `,
    [
      code,
      input.name,
      input.description ?? null,
      input.sortOrder ?? 0,
      input.showInFilter ?? true,
      input.showInForm ?? true,
    ],
  )
  return code
}

export async function patchEditorialStatus(
  client: PoolClient,
  code: string,
  input: Partial<{
    name: string
    description: string | null
    sortOrder: number
    isActive: boolean
    showInFilter: boolean
    showInForm: boolean
  }>,
): Promise<void> {
  const sets: string[] = ['updated_at = now()']
  const values: unknown[] = []
  if (input.name !== undefined) {
    values.push(input.name)
    sets.push(`name = $${values.length}`)
  }
  if (input.description !== undefined) {
    values.push(input.description)
    sets.push(`description = $${values.length}`)
  }
  if (input.sortOrder !== undefined) {
    values.push(input.sortOrder)
    sets.push(`sort_order = $${values.length}`)
  }
  if (input.isActive !== undefined) {
    values.push(input.isActive)
    sets.push(`is_active = $${values.length}`)
  }
  if (input.showInFilter !== undefined) {
    values.push(input.showInFilter)
    sets.push(`show_in_filter = $${values.length}`)
  }
  if (input.showInForm !== undefined) {
    values.push(input.showInForm)
    sets.push(`show_in_form = $${values.length}`)
  }
  values.push(code)
  await dbQueryClient(
    client,
    `update editorial_status_catalog set ${sets.join(', ')} where code = $${values.length}`,
    values,
  )
}

export async function fetchCyclePeriods(activeOnly = false) {
  const { rows } = await dbQuery<{
    id: string
    code: string
    name: string
    starts_on: string | null
    ends_on: string | null
  }>(`
    select id::text, code, name, starts_on::text, ends_on::text
    from cycle_periods
    where ${activeOnly ? 'is_active' : 'true'}
    order by starts_on desc nulls last, name asc
  `)
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
  }))
}

export async function fetchCyclePeriodsForAdmin(): Promise<AdminCyclePeriodRow[]> {
  const { rows } = await dbQuery<{
    id: string
    code: string
    name: string
    starts_on: string | null
    ends_on: string | null
    academic_year: number | null
    is_active: boolean
  }>(`
    select id::text, code, name, starts_on::text, ends_on::text, academic_year, is_active
    from cycle_periods
    order by starts_on desc nulls last, name asc
  `)
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    academicYear: r.academic_year,
    isActive: r.is_active,
  }))
}

async function resolveCyclePeriodCode(
  client: PoolClient,
  name: string,
  explicitCode?: string,
): Promise<string> {
  const { rows } = await dbQueryClient<{ code: string }>(client, `select code from cycle_periods`)
  const base = explicitCode?.trim() || catalogCodeFromName(name)
  return uniqueCatalogCode(base, rows.map((r) => r.code))
}

export async function createCyclePeriod(
  client: PoolClient,
  input: {
    code?: string
    name: string
    startsOn?: string | null
    endsOn?: string | null
    academicYear?: number | null
    isActive?: boolean
  },
): Promise<string> {
  const code = await resolveCyclePeriodCode(client, input.name, input.code)
  const { rows } = await dbQueryClient<{ id: string }>(
    client,
    `
      insert into cycle_periods (code, name, starts_on, ends_on, academic_year, is_active)
      values ($1, $2, $3, $4, $5, coalesce($6, true))
      returning id::text
    `,
    [
      code,
      input.name,
      input.startsOn ?? null,
      input.endsOn ?? null,
      input.academicYear ?? null,
      input.isActive ?? true,
    ],
  )
  return rows[0].id
}

export async function patchCyclePeriod(
  client: PoolClient,
  id: string,
  input: Partial<{
    name: string
    startsOn: string | null
    endsOn: string | null
    academicYear: number | null
    isActive: boolean
  }>,
): Promise<void> {
  const sets: string[] = ['updated_at = now()']
  const values: unknown[] = []
  if (input.name !== undefined) {
    values.push(input.name)
    sets.push(`name = $${values.length}`)
  }
  if (input.startsOn !== undefined) {
    values.push(input.startsOn)
    sets.push(`starts_on = $${values.length}`)
  }
  if (input.endsOn !== undefined) {
    values.push(input.endsOn)
    sets.push(`ends_on = $${values.length}`)
  }
  if (input.academicYear !== undefined) {
    values.push(input.academicYear)
    sets.push(`academic_year = $${values.length}`)
  }
  if (input.isActive !== undefined) {
    values.push(input.isActive)
    sets.push(`is_active = $${values.length}`)
  }
  values.push(id)
  await dbQueryClient(client, `update cycle_periods set ${sets.join(', ')} where id = $${values.length}`, values)
}

export async function countKnowledgeItemsBySection(sectionCode: string): Promise<number> {
  const { rows } = await dbQuery<{ count: string }>(
    `select count(*)::text as count from knowledge_items where section_code = $1`,
    [sectionCode],
  )
  return Number(rows[0]?.count ?? 0)
}

export async function countKnowledgeItemsByEditorialStatus(statusCode: string): Promise<number> {
  const { rows } = await dbQuery<{ count: string }>(
    `select count(*)::text as count from knowledge_items where editorial_status = $1`,
    [statusCode],
  )
  return Number(rows[0]?.count ?? 0)
}
