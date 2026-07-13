import type { PoolClient } from 'pg'

import { encodeDocumentMeta } from '@/lib/admin/document-meta'
import { slugify } from '@/lib/admin/slugify'
import type {
  audienceInputSchema,
  createItemSchema,
  createVersionSchema,
  listItemsQuerySchema,
  patchItemSchema,
} from '@/lib/admin/validation'
import type { z } from 'zod'

import {
  resolveProfileTypeId,
  resolveStudentTypeId,
} from '@/lib/db/admin/catalog-repository'
import { refreshKnowledgeItemSearchIndex } from '@/lib/db/knowledge-search-index'
import { dbQuery } from '@/lib/db/postgres'
import { dbQueryClient } from '@/lib/db/transaction'

type ListQuery = z.infer<typeof listItemsQuerySchema>
type CreateItem = z.infer<typeof createItemSchema>
type PatchItem = z.infer<typeof patchItemSchema>
type CreateVersion = z.infer<typeof createVersionSchema>
type AudienceInput = z.infer<typeof audienceInputSchema>

export interface AdminItemAudienceRow {
  profileTypeCode: string | null
  profileTypeName: string | null
  studentTypeCode: string | null
  studentTypeName: string | null
}

export interface AdminItemListRow {
  id: string
  title: string | null
  editorialStatus: string
  sectionCode: string
  contentType: string
  domainCode: string
  categoryName: string
  subcategoryName: string
  elementName: string
  questionPreview: string | null
  updatedAt: string
  isActive: boolean
  audiences: AdminItemAudienceRow[]
}

export async function listAdminKnowledgeItems(query: ListQuery): Promise<{
  items: AdminItemListRow[]
  total: number
}> {
  const limit = query.limit ?? 50
  const offset = query.offset ?? 0
  const clauses = ['1=1']
  const values: unknown[] = []

  if (query.q?.trim()) {
    values.push(`%${query.q.trim().toLowerCase()}%`)
    const p = `$${values.length}`
    clauses.push(`(
      lower(coalesce(ki.title, '')) like ${p}
      or lower(coalesce(lv.question_text, '')) like ${p}
      or lower(coalesce(lv.answer_text, '')) like ${p}
    )`)
  }
  if (query.domainCode) {
    values.push(query.domainCode)
    clauses.push(`d.code = $${values.length}`)
  }
  if (query.categorySlug) {
    values.push(query.categorySlug)
    clauses.push(`kc.slug = $${values.length}`)
  }
  if (query.editorialStatus) {
    values.push(query.editorialStatus)
    clauses.push(`ki.editorial_status = $${values.length}`)
  }
  if (query.sectionCode) {
    values.push(query.sectionCode)
    clauses.push(`ki.section_code = $${values.length}`)
  }
  if (query.profileTypeCode) {
    values.push(query.profileTypeCode)
    const p = `$${values.length}`
    clauses.push(`exists (
      select 1
      from knowledge_item_audiences kia_f
      join profile_type_catalog ptc_f on ptc_f.id = kia_f.profile_type_id
      where kia_f.knowledge_item_id = ki.id
        and kia_f.profile_code = 'student'
        and ptc_f.type_code = ${p}
    )`)
  }
  if (query.studentTypeCode) {
    values.push(query.studentTypeCode)
    const p = `$${values.length}`
    clauses.push(`exists (
      select 1
      from knowledge_item_audiences kia_s
      join student_types st_f on st_f.id = kia_s.student_type_id
      where kia_s.knowledge_item_id = ki.id
        and st_f.code = ${p}
    )`)
  }
  if (query.periodLabel?.trim()) {
    values.push(`%${query.periodLabel.trim().toLowerCase()}%`)
    const p = `$${values.length}`
    clauses.push(`(
      ki.review_policy is not null
      and ki.review_policy like 'admin_doc_meta:v1:%'
      and lower(ki.review_policy) like ${p}
    )`)
  }

  const whereSql = clauses.join(' and ')

  const countSql = `
    with latest_versions as (
      select distinct on (v.knowledge_item_id)
        v.knowledge_item_id,
        v.question_text,
        v.answer_text
      from knowledge_item_versions v
      order by v.knowledge_item_id, v.version_number desc
    )
    select count(*)::text as total
    from knowledge_items ki
    join kb_elements ke on ke.id = ki.kb_element_id
    join kb_subcategories ks on ks.id = ke.kb_subcategory_id
    join kb_categories kc on kc.id = ks.kb_category_id
    join domains d on d.id = ki.domain_id
    left join latest_versions lv on lv.knowledge_item_id = ki.id
    where ${whereSql}
  `
  const { rows: countRows } = await dbQuery<{ total: string }>(countSql, values)
  const total = Number(countRows[0]?.total) || 0

  values.push(limit, offset)
  const limitParam = `$${values.length - 1}`
  const offsetParam = `$${values.length}`

  const listSql = `
    with latest_versions as (
      select distinct on (v.knowledge_item_id)
        v.knowledge_item_id,
        v.question_text,
        v.answer_text
      from knowledge_item_versions v
      order by v.knowledge_item_id, v.version_number desc
    )
    select
      ki.id::text as id,
      ki.title,
      ki.editorial_status,
      ki.section_code,
      ki.content_type,
      d.code as domain_code,
      kc.name as category_name,
      ks.name as subcategory_name,
      ke.name as element_name,
      lv.question_text as question_preview,
      ki.updated_at::text as updated_at,
      ki.is_active,
      coalesce(aud.audiences_json, '[]'::json) as audiences_json
    from knowledge_items ki
    join kb_elements ke on ke.id = ki.kb_element_id
    join kb_subcategories ks on ks.id = ke.kb_subcategory_id
    join kb_categories kc on kc.id = ks.kb_category_id
    join domains d on d.id = ki.domain_id
    left join latest_versions lv on lv.knowledge_item_id = ki.id
    left join lateral (
      select json_agg(
        json_build_object(
          'profileTypeCode', ptc.type_code,
          'profileTypeName', ptc.name,
          'studentTypeCode', st.code,
          'studentTypeName', st.name
        )
        order by kia.priority asc, kia.created_at asc
      ) as audiences_json
      from knowledge_item_audiences kia
      left join profile_type_catalog ptc on ptc.id = kia.profile_type_id
      left join student_types st on st.id = kia.student_type_id
      where kia.knowledge_item_id = ki.id
    ) aud on true
    where ${whereSql}
    order by ki.updated_at desc
    limit ${limitParam} offset ${offsetParam}
  `

  const { rows } = await dbQuery<{
    id: string
    title: string | null
    editorial_status: string
    section_code: string
    content_type: string
    domain_code: string
    category_name: string
    subcategory_name: string
    element_name: string
    question_preview: string | null
    updated_at: string
    is_active: boolean
    audiences_json: AdminItemAudienceRow[] | string | null
  }>(listSql, values)

  return {
    total,
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      editorialStatus: r.editorial_status,
      sectionCode: r.section_code,
      contentType: r.content_type,
      domainCode: r.domain_code,
      categoryName: r.category_name,
      subcategoryName: r.subcategory_name,
      elementName: r.element_name,
      questionPreview: r.question_preview,
      updatedAt: r.updated_at,
      isActive: r.is_active,
      audiences: parseAudienceJson(r.audiences_json),
    })),
  }
}

function parseAudienceJson(raw: AdminItemAudienceRow[] | string | null): AdminItemAudienceRow[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown
      return Array.isArray(parsed) ? (parsed as AdminItemAudienceRow[]) : []
    } catch {
      return []
    }
  }
  return []
}

export interface AdminItemDetail {
  id: string
  kbElementId: string
  domainId: string
  domainCode: string
  sectionCode: string
  contentType: string
  canonicalSlug: string
  title: string | null
  editorialStatus: string
  ingestionStatus: string
  isActive: boolean
  validFrom: string | null
  validTo: string | null
  publishedAt: string | null
  reviewPolicy: string | null
  updatedAt: string
  taxonomy: {
    categoryId: string
    categoryName: string
    categorySlug: string
    subcategoryId: string
    subcategoryName: string
    subcategorySlug: string
    elementId: string
    elementName: string
    elementSlug: string
  }
  latestVersion: {
    id: string
    versionNumber: number
    questionText: string | null
    answerText: string | null
    searchForms: string[]
    phrases: string[]
    synonyms: string[]
    createdAt: string
  } | null
  versions: Array<{ id: string; versionNumber: number; createdAt: string; changeSummary: string | null }>
  audiences: Array<{
    id: string
    profileCode: string
    profileTypeCode: string | null
    programLevelCode: string | null
    studentTypeCode: string | null
    priority: number
  }>
  responsibles: Array<{ id: string; displayName: string; slug: string; isPrimary: boolean }>
}

function parseJsonArray(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown
      return Array.isArray(parsed) ? parsed.map(String) : []
    } catch {
      return []
    }
  }
  return []
}

export async function getAdminKnowledgeItemById(id: string): Promise<AdminItemDetail | null> {
  const { rows } = await dbQuery<{
    id: string
    kb_element_id: string
    domain_id: string
    domain_code: string
    section_code: string
    content_type: string
    canonical_slug: string
    title: string | null
    editorial_status: string
    ingestion_status: string
    is_active: boolean
    valid_from: string | null
    valid_to: string | null
    published_at: string | null
    review_policy: string | null
    updated_at: string
    category_id: string
    category_name: string
    category_slug: string
    subcategory_id: string
    subcategory_name: string
    subcategory_slug: string
    element_id: string
    element_name: string
    element_slug: string
  }>(
    `
      select
        ki.id::text,
        ki.kb_element_id::text,
        ki.domain_id::text,
        d.code as domain_code,
        ki.section_code,
        ki.content_type,
        ki.canonical_slug,
        ki.title,
        ki.editorial_status,
        ki.ingestion_status,
        ki.is_active,
        ki.valid_from::text,
        ki.valid_to::text,
        ki.published_at::text,
        ki.review_policy,
        ki.updated_at::text,
        kc.id::text as category_id,
        kc.name as category_name,
        kc.slug as category_slug,
        ks.id::text as subcategory_id,
        ks.name as subcategory_name,
        ks.slug as subcategory_slug,
        ke.id::text as element_id,
        ke.name as element_name,
        ke.slug as element_slug
      from knowledge_items ki
      join kb_elements ke on ke.id = ki.kb_element_id
      join kb_subcategories ks on ks.id = ke.kb_subcategory_id
      join kb_categories kc on kc.id = ks.kb_category_id
      join domains d on d.id = ki.domain_id
      where ki.id = $1
      limit 1
    `,
    [id],
  )

  if (rows.length === 0) return null
  const base = rows[0]

  const { rows: versionRows } = await dbQuery<{
    id: string
    version_number: number
    question_text: string | null
    answer_text: string | null
    search_forms_json: unknown
    phrases_json: unknown
    synonyms_json: unknown
    change_summary: string | null
    created_at: string
  }>(
    `
      select
        id::text,
        version_number,
        question_text,
        answer_text,
        search_forms_json,
        phrases_json,
        synonyms_json,
        change_summary,
        created_at::text
      from knowledge_item_versions
      where knowledge_item_id = $1
      order by version_number desc
    `,
    [id],
  )

  const latest = versionRows[0]

  const { rows: audienceRows } = await dbQuery<{
    id: string
    profile_code: string
    type_code: string | null
    program_level_code: string | null
    student_code: string | null
    priority: number
  }>(
    `
      select
        kia.id::text,
        kia.profile_code,
        ptc.type_code,
        kia.program_level_code,
        st.code as student_code,
        kia.priority
      from knowledge_item_audiences kia
      left join profile_type_catalog ptc on ptc.id = kia.profile_type_id
      left join student_types st on st.id = kia.student_type_id
      where kia.knowledge_item_id = $1
      order by kia.priority asc, kia.created_at asc
    `,
    [id],
  )

  const { rows: responsibleRows } = await dbQuery<{
    id: string
    display_name: string
    slug: string
    is_primary: boolean
  }>(
    `
      select r.id::text, r.display_name, r.slug, kir.is_primary
      from knowledge_item_responsibles kir
      join responsibles r on r.id = kir.responsible_id
      where kir.knowledge_item_id = $1
      order by kir.is_primary desc, r.display_name asc
    `,
    [id],
  )

  return {
    id: base.id,
    kbElementId: base.kb_element_id,
    domainId: base.domain_id,
    domainCode: base.domain_code,
    sectionCode: base.section_code,
    contentType: base.content_type,
    canonicalSlug: base.canonical_slug,
    title: base.title,
    editorialStatus: base.editorial_status,
    ingestionStatus: base.ingestion_status,
    isActive: base.is_active,
    validFrom: base.valid_from,
    validTo: base.valid_to,
    publishedAt: base.published_at,
    reviewPolicy: base.review_policy,
    updatedAt: base.updated_at,
    taxonomy: {
      categoryId: base.category_id,
      categoryName: base.category_name,
      categorySlug: base.category_slug,
      subcategoryId: base.subcategory_id,
      subcategoryName: base.subcategory_name,
      subcategorySlug: base.subcategory_slug,
      elementId: base.element_id,
      elementName: base.element_name,
      elementSlug: base.element_slug,
    },
    latestVersion: latest
      ? {
          id: latest.id,
          versionNumber: latest.version_number,
          questionText: latest.question_text,
          answerText: latest.answer_text,
          searchForms: parseJsonArray(latest.search_forms_json),
          phrases: parseJsonArray(latest.phrases_json),
          synonyms: parseJsonArray(latest.synonyms_json),
          createdAt: latest.created_at,
        }
      : null,
    versions: versionRows.map((v) => ({
      id: v.id,
      versionNumber: v.version_number,
      createdAt: v.created_at,
      changeSummary: v.change_summary,
    })),
    audiences: audienceRows.map((a) => ({
      id: a.id,
      profileCode: a.profile_code,
      profileTypeCode: a.type_code,
      programLevelCode: a.program_level_code,
      studentTypeCode: a.student_code,
      priority: a.priority,
    })),
    responsibles: responsibleRows.map((r) => ({
      id: r.id,
      displayName: r.display_name,
      slug: r.slug,
      isPrimary: r.is_primary,
    })),
  }
}

async function replaceAudiences(
  client: PoolClient,
  itemId: string,
  audiences: AudienceInput[] | undefined,
): Promise<void> {
  await dbQueryClient(client, `delete from knowledge_item_audiences where knowledge_item_id = $1`, [itemId])

  const rows = audiences?.length
    ? audiences
    : [{ profileCode: 'student', profileTypeCode: 'sin_tipo', programLevelCode: 'general', studentTypeCode: null }]

  for (const [index, aud] of rows.entries()) {
    const profileTypeId = await resolveProfileTypeId(aud.profileCode, aud.profileTypeCode)
    const studentTypeId = await resolveStudentTypeId(aud.studentTypeCode)
    await dbQueryClient(
      client,
      `
        insert into knowledge_item_audiences (
          knowledge_item_id,
          profile_code,
          profile_type_id,
          program_level_code,
          student_type_id,
          priority
        ) values ($1, $2, $3, $4, $5, $6)
      `,
      [
        itemId,
        aud.profileCode,
        profileTypeId,
        aud.programLevelCode ?? null,
        studentTypeId,
        aud.priority ?? 100 + index,
      ],
    )
  }
}

async function linkResponsible(
  client: PoolClient,
  itemId: string,
  responsibleName: string | undefined,
): Promise<void> {
  if (!responsibleName?.trim()) return
  const slug = slugify(responsibleName)
  const { rows } = await dbQueryClient<{ id: string }>(
    client,
    `
      insert into responsibles (responsible_type, display_name, slug, is_active)
      values ('person', $1, $2, true)
      on conflict (slug) do update
        set display_name = excluded.display_name, is_active = true, updated_at = now()
      returning id::text
    `,
    [responsibleName.trim(), slug],
  )
  const responsibleId = rows[0].id
  await dbQueryClient(
    client,
    `update knowledge_item_responsibles set is_primary = false where knowledge_item_id = $1`,
    [itemId],
  )
  await dbQueryClient(
    client,
    `
      insert into knowledge_item_responsibles (
        knowledge_item_id, responsible_id, responsibility_type, is_primary
      ) values ($1, $2, 'owner', true)
      on conflict (knowledge_item_id, responsible_id, responsibility_type) do update
        set is_primary = true
    `,
    [itemId, responsibleId],
  )
}

export async function createKnowledgeItem(
  client: PoolClient,
  input: CreateItem,
): Promise<string> {
  const canonicalSlug =
    input.canonicalSlug ??
    `${slugify(input.title)}-${Date.now().toString(36).slice(-6)}`

  const publishedAt = input.editorialStatus === 'published' ? new Date().toISOString() : null

  const { rows } = await dbQueryClient<{ id: string }>(
    client,
    `
      insert into knowledge_items (
        kb_element_id,
        domain_id,
        section_code,
        content_type,
        canonical_slug,
        title,
        ingestion_status,
        editorial_status,
        review_policy,
        valid_from,
        valid_to,
        published_at,
        is_active
      ) values (
        $1, $2, $3, $4, $5, $6,
        'processed', $7, $8, $9, $10, $11, true
      )
      returning id::text
    `,
    [
      input.kbElementId,
      input.domainId,
      input.sectionCode,
      input.contentType,
      canonicalSlug,
      input.title,
      input.editorialStatus,
      encodeDocumentMeta({ periodLabel: input.periodLabel }),
      input.validFrom ?? null,
      input.validTo ?? null,
      publishedAt,
    ],
  )

  const itemId = rows[0].id

  await dbQueryClient(
    client,
    `
      insert into knowledge_item_versions (
        knowledge_item_id,
        version_number,
        question_text,
        answer_text,
        search_forms_json,
        phrases_json,
        synonyms_json,
        change_summary
      ) values ($1, 1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7)
    `,
    [
      itemId,
      input.questionText,
      input.answerText,
      JSON.stringify(input.searchForms),
      JSON.stringify(input.phrases),
      JSON.stringify(input.synonyms),
      'Created from admin panel',
    ],
  )

  await replaceAudiences(client, itemId, input.audiences)
  await linkResponsible(client, itemId, input.responsibleName)
  await refreshKnowledgeItemSearchIndex(client, itemId)

  return itemId
}

export async function patchKnowledgeItem(
  client: PoolClient,
  id: string,
  input: PatchItem,
): Promise<void> {
  const sets: string[] = ['updated_at = now()']
  const values: unknown[] = []

  if (input.sectionCode !== undefined) {
    values.push(input.sectionCode)
    sets.push(`section_code = $${values.length}`)
  }
  if (input.contentType !== undefined) {
    values.push(input.contentType)
    sets.push(`content_type = $${values.length}`)
  }
  if (input.title !== undefined) {
    values.push(input.title)
    sets.push(`title = $${values.length}`)
  }
  if (input.editorialStatus !== undefined) {
    values.push(input.editorialStatus)
    sets.push(`editorial_status = $${values.length}`)
    if (input.editorialStatus === 'published') {
      sets.push(`published_at = coalesce(published_at, now())`)
    }
    if (input.editorialStatus === 'archived') {
      sets.push(`archived_at = now()`)
    }
  }
  if (input.isActive !== undefined) {
    values.push(input.isActive)
    sets.push(`is_active = $${values.length}`)
  }
  if (input.validFrom !== undefined) {
    values.push(input.validFrom)
    sets.push(`valid_from = $${values.length}`)
  }
  if (input.validTo !== undefined) {
    values.push(input.validTo)
    sets.push(`valid_to = $${values.length}`)
  }
  if (input.periodLabel !== undefined) {
    values.push(encodeDocumentMeta({ periodLabel: input.periodLabel ?? undefined }))
    sets.push(`review_policy = $${values.length}`)
  } else if (input.reviewPolicy !== undefined) {
    values.push(input.reviewPolicy)
    sets.push(`review_policy = $${values.length}`)
  }

  values.push(id)
  await dbQueryClient(
    client,
    `update knowledge_items set ${sets.join(', ')} where id = $${values.length}`,
    values,
  )
  await refreshKnowledgeItemSearchIndex(client, id)
}

export async function createKnowledgeItemVersion(
  client: PoolClient,
  itemId: string,
  input: CreateVersion,
): Promise<{ versionId: string; versionNumber: number }> {
  const { rows: latest } = await dbQueryClient<{ version_number: number }>(
    client,
    `
      select version_number
      from knowledge_item_versions
      where knowledge_item_id = $1
      order by version_number desc
      limit 1
    `,
    [itemId],
  )

  const nextVersion = (latest[0]?.version_number ?? 0) + 1

  const { rows } = await dbQueryClient<{ id: string }>(
    client,
    `
      insert into knowledge_item_versions (
        knowledge_item_id,
        version_number,
        question_text,
        answer_text,
        search_forms_json,
        phrases_json,
        synonyms_json,
        change_summary
      ) values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8)
      returning id::text
    `,
    [
      itemId,
      nextVersion,
      input.questionText,
      input.answerText,
      JSON.stringify(input.searchForms),
      JSON.stringify(input.phrases),
      JSON.stringify(input.synonyms),
      input.changeSummary ?? 'Updated from admin panel',
    ],
  )

  await dbQueryClient(client, `update knowledge_items set updated_at = now() where id = $1`, [itemId])
  await refreshKnowledgeItemSearchIndex(client, itemId)

  return { versionId: rows[0].id, versionNumber: nextVersion }
}

export async function replaceItemAudiences(
  client: PoolClient,
  itemId: string,
  audiences: AudienceInput[],
): Promise<void> {
  await replaceAudiences(client, itemId, audiences)
}

export async function deleteKnowledgeItem(client: PoolClient, itemId: string): Promise<void> {
  await dbQueryClient(client, `delete from knowledge_item_audiences where knowledge_item_id = $1`, [itemId])
  await dbQueryClient(client, `delete from knowledge_item_versions where knowledge_item_id = $1`, [itemId])
  await dbQueryClient(client, `delete from knowledge_items where id = $1`, [itemId])
}
