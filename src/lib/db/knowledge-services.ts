import type { SearchResult } from '@/lib/types'

import { dbQuery } from './postgres'

export type TaxonomyElement = { slug: string; name: string; count: number }
export type TaxonomySubcategory = {
  slug: string
  name: string
  count: number
  elements: TaxonomyElement[]
}
export type TaxonomyCategory = {
  slug: string
  name: string
  count: number
  subcategories: TaxonomySubcategory[]
}

export interface SearchKnowledgeInput {
  query?: string
  limit?: number
  category?: string
  subcategory?: string
  element?: string
  uiSection?: 'services_incidents' | 'documentation'
  profileCode?: string
  profileTypeCode?: string
  includeUnfiltered?: boolean
  /** When true, skip item query and return empty results (taxonomy loaded separately). */
  taxonomyOnly?: boolean
}

interface SearchRow {
  service_id: string
  service_name: string
  category: string
  category_slug: string
  subcategory: string
  subcategory_slug: string
  element: string
  element_slug: string
  question_text: string | null
  answer_text: string | null
  content_type: string
  score: number
  audience_score?: number
}

let audienceTablesReadyCache: boolean | null = null

async function areAudienceTablesReady(): Promise<boolean> {
  if (audienceTablesReadyCache !== null) return audienceTablesReadyCache
  const sql = `
    select
      to_regclass('public.knowledge_item_audiences') is not null as has_item_audiences,
      to_regclass('public.profile_type_catalog') is not null as has_profile_types
  `
  const { rows } = await dbQuery<{ has_item_audiences: boolean; has_profile_types: boolean }>(sql)
  audienceTablesReadyCache = Boolean(rows[0]?.has_item_audiences && rows[0]?.has_profile_types)
  return audienceTablesReadyCache
}

function clampLimit(limit: number | undefined): number {
  const n = Number(limit)
  if (!Number.isFinite(n)) return 20
  return Math.min(Math.max(Math.trunc(n), 1), 50)
}

function resolveSectionCode(section: SearchKnowledgeInput['uiSection']): 'faq' | 'general_info' {
  if (section === 'documentation') return 'general_info'
  return 'faq'
}

function buildWhere(input: SearchKnowledgeInput, values: unknown[]): string {
  const sectionCode = resolveSectionCode(input.uiSection)
  const clauses: string[] = [
    "ki.is_active = true",
    `ki.section_code = '${sectionCode}'`,
    "d.code in ('academic', 'financial', 'foreign_language', 'services', 'calendar')",
  ]

  if (input.category) {
    values.push(input.category)
    clauses.push(`kc.slug = $${values.length}`)
  }
  if (input.subcategory) {
    values.push(input.subcategory)
    clauses.push(`ks.slug = $${values.length}`)
  }
  if (input.element) {
    values.push(input.element)
    clauses.push(`ke.slug = $${values.length}`)
  }

  const q = input.query?.trim().toLowerCase()
  if (q) {
    values.push(`%${q}%`)
    const likeParam = `$${values.length}`
    values.push(q)
    const tsqParam = `$${values.length}`
    clauses.push(
      [
        `(`,
        `lower(coalesce(ki.title, '')) like ${likeParam}`,
        `or lower(coalesce(lv.question_text, '')) like ${likeParam}`,
        `or lower(coalesce(lv.answer_text, '')) like ${likeParam}`,
        `or to_tsvector('spanish', coalesce(ki.title, '') || ' ' || coalesce(lv.question_text, '') || ' ' || coalesce(lv.answer_text, '')) @@ plainto_tsquery('spanish', ${tsqParam})`,
        `)`,
      ].join(' '),
    )
  }

  return clauses.join(' and ')
}

export async function searchKnowledgeServices(input: SearchKnowledgeInput): Promise<SearchResult[]> {
  if (input.taxonomyOnly) {
    return []
  }

  const hasFilters = Boolean(input.category || input.subcategory || input.element)
  const hasQuery = Boolean(input.query?.trim())
  if (!hasQuery && !hasFilters && !input.includeUnfiltered) {
    return []
  }

  const values: unknown[] = []
  const whereSql = buildWhere(input, values)
  const q = input.query?.trim().toLowerCase()
  const hasSearchQuery = Boolean(q)
  const audienceTablesReady = await areAudienceTablesReady()
  const normalizedProfileCode = input.profileCode?.trim().toLowerCase() || null
  const normalizedProfileTypeCode = input.profileTypeCode?.trim().toLowerCase() || null

  let likeParam = 'null'
  let tsqParam = 'null'
  if (hasSearchQuery) {
    likeParam = `$${values.length - 1}`
    tsqParam = `$${values.length}`
  }

  values.push(clampLimit(input.limit))
  const limitParam = `$${values.length}`
  values.push(normalizedProfileCode)
  const profileParam = `$${values.length}`
  values.push(normalizedProfileTypeCode)
  const profileTypeParam = `$${values.length}`

  const audienceJoinSql = audienceTablesReady
    ? `
    ,
    audience_rank as (
      select
        ki.id as knowledge_item_id,
        count(kia.knowledge_item_id) > 0 as has_any_audience,
        coalesce(max(
          case
            when ${profileParam} is null then 0
            when lower(kia.profile_code) = ${profileParam}
              and ${profileTypeParam} is not null
              and ptc.id is not null
              and lower(ptc.type_code) = ${profileTypeParam}
              then 300
            when lower(kia.profile_code) = ${profileParam}
              and lower(coalesce(ptc.type_code, '')) = 'sin_tipo'
              then 200
            when lower(kia.profile_code) = ${profileParam}
              then 150
            else 0
          end
        ), 0) as audience_score
      from knowledge_items ki
      left join knowledge_item_audiences kia on kia.knowledge_item_id = ki.id
      left join profile_type_catalog ptc on ptc.id = kia.profile_type_id
      group by ki.id
    )
  `
    : `
    ,
    audience_rank as (
      select
        ki.id as knowledge_item_id,
        false as has_any_audience,
        0 as audience_score
      from knowledge_items ki
    )
  `

  const audienceWhereSql = audienceTablesReady
    ? `and (
        ${profileParam} is null
        or ar.audience_score > 0
        or ar.has_any_audience = false
      )`
    : ''

  const sql = `
    with latest_versions as (
      select distinct on (v.knowledge_item_id)
        v.knowledge_item_id,
        v.question_text,
        v.answer_text
      from knowledge_item_versions v
      order by v.knowledge_item_id, v.version_number desc
    )
    ${audienceJoinSql}
    select
      ki.id::text as service_id,
      coalesce(ki.title, lv.question_text, ke.name) as service_name,
      kc.name as category,
      kc.slug as category_slug,
      ks.name as subcategory,
      ks.slug as subcategory_slug,
      ke.name as element,
      ke.slug as element_slug,
      lv.question_text,
      lv.answer_text,
      case
        when kc.slug in ('servicios', 'tramites-y-servicios') then 'service'
        when lower(coalesce(ki.title, lv.question_text, '')) like '%error%' then 'incident'
        when lower(coalesce(ki.title, lv.question_text, '')) like '%incidencia%' then 'incident'
        when kc.slug = 'calendarios' then 'calendar'
        else 'faq'
      end as content_type,
      ar.audience_score::double precision as audience_score,
      ${
        hasSearchQuery
          ? `(
            (case when lower(coalesce(ki.title, '')) like ${likeParam} then 0.45 else 0 end) +
            (case when lower(coalesce(lv.question_text, '')) like ${likeParam} then 0.35 else 0 end) +
            (case when lower(coalesce(lv.answer_text, '')) like ${likeParam} then 0.2 else 0 end) +
            (case when to_tsvector('spanish', coalesce(ki.title, '') || ' ' || coalesce(lv.question_text, '') || ' ' || coalesce(lv.answer_text, '')) @@ plainto_tsquery('spanish', ${tsqParam}) then 0.25 else 0 end)
          )`
          : `1.0`
      }::double precision as score
    from knowledge_items ki
    join kb_elements ke on ke.id = ki.kb_element_id
    join kb_subcategories ks on ks.id = ke.kb_subcategory_id
    join kb_categories kc on kc.id = ks.kb_category_id
    join domains d on d.id = kc.domain_id
    left join latest_versions lv on lv.knowledge_item_id = ki.id
    join audience_rank ar on ar.knowledge_item_id = ki.id
    where ${whereSql}
      ${audienceWhereSql}
    order by
      ar.audience_score desc,
      score desc,
      service_name asc
    limit ${limitParam}
  `

  const { rows } = await dbQuery<SearchRow>(sql, values)
  return rows.map((row) => ({
    serviceId: row.service_id,
    serviceName: row.service_name,
    category: row.category,
    score: Number(row.score) || 0,
    hasPdfs: false,
    snippet: row.question_text || row.answer_text || undefined,
    studentTypes: [],
    pdfRefs: [],
    jsonPayload: {
      category: row.category,
      category_slug: row.category_slug,
      subcategory: row.subcategory,
      subcategory_slug: row.subcategory_slug,
      element: row.element,
      element_slug: row.element_slug,
      question: row.question_text,
      answer: row.answer_text,
      content_type: row.content_type,
      source: 'canonical_db',
    },
    matchHints: [
      `Categoría: ${row.category}`,
      `Subcategoría: ${row.subcategory}`,
      `Elemento: ${row.element}`,
    ],
  }))
}

interface TaxonomyRow {
  category_slug: string
  category_name: string
  subcategory_slug: string
  subcategory_name: string
  element_slug: string
  element_name: string
  item_count: string | number
}

export async function loadKnowledgeTaxonomy(
  uiSection?: SearchKnowledgeInput['uiSection'],
): Promise<TaxonomyCategory[]> {
  const sectionCode = resolveSectionCode(uiSection)
  const sql = `
    select
      kc.slug as category_slug,
      kc.name as category_name,
      ks.slug as subcategory_slug,
      ks.name as subcategory_name,
      ke.slug as element_slug,
      ke.name as element_name,
      count(ki.id) as item_count
    from knowledge_items ki
    join kb_elements ke on ke.id = ki.kb_element_id
    join kb_subcategories ks on ks.id = ke.kb_subcategory_id
    join kb_categories kc on kc.id = ks.kb_category_id
    where ki.is_active = true
      and ki.section_code = '${sectionCode}'
    group by
      kc.slug,
      kc.name,
      ks.slug,
      ks.name,
      ke.slug,
      ke.name
    order by
      kc.name asc,
      ks.name asc,
      ke.name asc
  `

  const { rows } = await dbQuery<TaxonomyRow>(sql)
  const byCategory = new Map<string, TaxonomyCategory>()

  for (const row of rows) {
    const count = Number(row.item_count) || 0
    let cat = byCategory.get(row.category_slug)
    if (!cat) {
      cat = {
        slug: row.category_slug,
        name: row.category_name,
        count: 0,
        subcategories: [],
      }
      byCategory.set(row.category_slug, cat)
    }
    cat.count += count

    let sub = cat.subcategories.find((s) => s.slug === row.subcategory_slug)
    if (!sub) {
      sub = {
        slug: row.subcategory_slug,
        name: row.subcategory_name,
        count: 0,
        elements: [],
      }
      cat.subcategories.push(sub)
    }
    sub.count += count
    sub.elements.push({
      slug: row.element_slug,
      name: row.element_name,
      count,
    })
  }

  return Array.from(byCategory.values())
}

interface ServiceDetailRow {
  service_id: string
  service_name: string
  category: string
  subcategory: string
  element: string
  question_text: string | null
  answer_text: string | null
}

export async function getKnowledgeServiceById(serviceId: string) {
  const sql = `
    with latest_versions as (
      select distinct on (v.knowledge_item_id)
        v.knowledge_item_id,
        v.question_text,
        v.answer_text
      from knowledge_item_versions v
      order by v.knowledge_item_id, v.version_number desc
    )
    select
      ki.id::text as service_id,
      coalesce(ki.title, lv.question_text, ke.name) as service_name,
      kc.name as category,
      ks.name as subcategory,
      ke.name as element,
      lv.question_text,
      lv.answer_text
    from knowledge_items ki
    join kb_elements ke on ke.id = ki.kb_element_id
    join kb_subcategories ks on ks.id = ke.kb_subcategory_id
    join kb_categories kc on kc.id = ks.kb_category_id
    left join latest_versions lv on lv.knowledge_item_id = ki.id
    where ki.id::text = $1
      and ki.is_active = true
      and ki.section_code = 'faq'
    limit 1
  `

  const { rows } = await dbQuery<ServiceDetailRow>(sql, [serviceId])
  if (rows.length === 0) return null
  return rows[0]
}
