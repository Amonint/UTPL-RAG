import { decodeDocumentMeta } from '@/lib/admin/document-meta'
import { formatKnowledgeScopeLine } from '@/lib/kb/audience-labels'
import {
  isKnowledgeSearchDocumentColumnReady,
  isKnowledgeSearchEmbeddingColumnReady,
  isPgTrgmReady,
  isUnaccentReady,
  knowledgeSearchDocumentTextExpr,
  knowledgeSearchTsvExpr,
  normalizeSqlTextExpr,
} from '@/lib/db/knowledge-search-sql'
import { embedSearchText } from '@/lib/search/embeddings/gemini-embeddings'
import { sanitizePublicAnswerText } from '@/lib/kb/sanitize-public-answer'
import {
  isHybridSearchEnabled,
  searchFtsWeight,
  searchSemanticWeight,
  SEARCH_VECTOR_MAX_DISTANCE,
  vectorLiteral,
} from '@/lib/search/hybrid-search-config'
import { normalizeText } from '@/lib/search/normalize'
import type { SearchResult, StudentType } from '@/lib/types'

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
  programLevelCode?: string
  studentLifecycleCode?: string
  /** Chat search across both sections; taxonomy browse stays section-scoped. */
  crossSection?: boolean
  includeUnfiltered?: boolean
  taxonomyOnly?: boolean
}

interface HybridSearchContext {
  searchDocText: string
  searchDocLikeText: string
  titleLikeText: string
  questionLikeText: string
  answerLikeText: string
  searchTsv: string
  trgmReady: boolean
  embeddingReady: boolean
  queryVectorParam: string | null
  vectorMaxDistanceParam: string | null
  ftsWeight: number
  semanticWeight: number
}

function normalizeSqlQuery(query: string, unaccentReady: boolean): string {
  if (unaccentReady) return normalizeText(query)
  return query.toLowerCase().trim().replace(/\s+/g, ' ')
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
  section_code: string
  domain_code: string
  domain_name: string
  review_policy: string | null
  service_category_code: string | null
  modality: string | null
  program_level: string | null
  student_lifecycle: string | null
  applies_to_all: boolean
  score: number
  audience_score?: number
  section_boost?: number
}

let audienceTablesReadyCache: boolean | null = null

async function areAudienceTablesReady(): Promise<boolean> {
  if (audienceTablesReadyCache !== null) return audienceTablesReadyCache
  const sql = `
    select
      to_regclass('public.knowledge_item_audiences') is not null as has_item_audiences,
      to_regclass('public.profile_type_catalog') is not null as has_profile_types,
      to_regclass('public.program_level_catalog') is not null as has_program_levels
  `
  const { rows } = await dbQuery<{
    has_item_audiences: boolean
    has_profile_types: boolean
    has_program_levels: boolean
  }>(sql)
  const row = rows[0]
  audienceTablesReadyCache = Boolean(
    row?.has_item_audiences && row?.has_profile_types && row?.has_program_levels,
  )
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

function buildWhere(
  input: SearchKnowledgeInput,
  values: unknown[],
  hybrid: HybridSearchContext,
  queryParams: { likeParam: string; tsqParam: string; similarityParam: string },
): string {
  const hasTaxonomyFilters = Boolean(input.category || input.subcategory || input.element)
  const crossSection = input.crossSection === true || (Boolean(input.query?.trim()) && !hasTaxonomyFilters)

  const clauses: string[] = [
    'ki.is_active = true',
    "ki.editorial_status in ('published', 'approved')",
    "d.code in ('academic', 'financial', 'foreign_language', 'services', 'calendar')",
  ]

  if (!crossSection) {
    const sectionCode = resolveSectionCode(input.uiSection)
    clauses.push(`ki.section_code = '${sectionCode}'`)
  }

  if (input.category) {
    clauses.push(`kc.slug = $${values.indexOf(input.category) + 1}`)
  }
  if (input.subcategory) {
    clauses.push(`ks.slug = $${values.indexOf(input.subcategory) + 1}`)
  }
  if (input.element) {
    clauses.push(`ke.slug = $${values.indexOf(input.element) + 1}`)
  }

  const q = input.query?.trim()
  if (q) {
    const { likeParam, tsqParam, similarityParam } = queryParams
    clauses.push(
      [
        `(`,
        `${hybrid.searchTsv} @@ websearch_to_tsquery('spanish', ${tsqParam})`,
        `or ${hybrid.searchDocLikeText} like ${likeParam}`,
        `or ${hybrid.titleLikeText} like ${likeParam}`,
        `or ${hybrid.questionLikeText} like ${likeParam}`,
        `or ${hybrid.answerLikeText} like ${likeParam}`,
        hybrid.trgmReady
          ? `or similarity(${hybrid.searchDocLikeText}, ${similarityParam}) > 0.22`
          : null,
        hybrid.embeddingReady && hybrid.queryVectorParam && hybrid.vectorMaxDistanceParam
          ? `or (ki.search_embedding is not null and ki.search_embedding <=> ${hybrid.queryVectorParam}::vector < ${hybrid.vectorMaxDistanceParam}::double precision)`
          : null,
        `)`,
      ]
        .filter(Boolean)
        .join(' '),
    )
  }

  return clauses.join(' and ')
}

function mapRowToSearchResult(row: SearchRow): SearchResult {
  const cleanAnswerText = sanitizePublicAnswerText(row.answer_text ?? '')
  const cleanQuestionText = sanitizePublicAnswerText(row.question_text ?? '')
  const periodLabel = decodeDocumentMeta(row.review_policy).periodLabel
  const normalizedContentType = row.content_type === 'calendar' ? 'fechas' : row.content_type
  const jsonPayload = {
      category: row.category,
      category_slug: row.category_slug,
      subcategory: row.subcategory,
      subcategory_slug: row.subcategory_slug,
      element: row.element,
      element_slug: row.element_slug,
      question: cleanQuestionText || null,
      answer: cleanAnswerText || null,
      content_type: normalizedContentType,
      section_code: row.section_code,
      domain_code: row.domain_code,
      domain_name: row.domain_name,
      period_label: periodLabel ?? undefined,
      service_category_code: row.service_category_code,
      modality: row.modality,
      program_level: row.program_level,
      student_lifecycle: row.student_lifecycle,
      applies_to_all: row.applies_to_all,
      source: 'neon_hybrid',
    }
  const scopeLine = formatKnowledgeScopeLine({
    payload: jsonPayload,
    studentTypes: row.student_lifecycle ? [row.student_lifecycle as StudentType] : [],
  })

  return {
    serviceId: row.service_id,
    serviceName: row.service_name,
    category: row.category,
    score: Number(row.score) || 0,
    hasPdfs: false,
    snippet: cleanQuestionText || cleanAnswerText || undefined,
    studentTypes: row.student_lifecycle ? [row.student_lifecycle as StudentType] : [],
    pdfRefs: [],
    jsonPayload,
    matchHints: scopeLine ? [scopeLine] : [],
  }
}

let knowledgeItemsReadyCache: boolean | null = null

async function areKnowledgeItemsReady(): Promise<boolean> {
  if (knowledgeItemsReadyCache !== null) return knowledgeItemsReadyCache
  const { rows } = await dbQuery<{ ready: boolean }>(
    `select to_regclass('public.knowledge_items') is not null as ready`,
  )
  knowledgeItemsReadyCache = Boolean(rows[0]?.ready)
  return knowledgeItemsReadyCache
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

  const tablesReady = await areKnowledgeItemsReady()
  if (!tablesReady) return []

  const values: unknown[] = []
  if (input.category) values.push(input.category)
  if (input.subcategory) values.push(input.subcategory)
  if (input.element) values.push(input.element)

  const searchDocReady = await isKnowledgeSearchDocumentColumnReady(dbQuery)
  const embeddingReady = await isKnowledgeSearchEmbeddingColumnReady(dbQuery)
  const trgmReady = await isPgTrgmReady(dbQuery)
  const unaccentReady = await isUnaccentReady(dbQuery)
  const searchDocText = knowledgeSearchDocumentTextExpr(searchDocReady)
  const searchDocLikeText = normalizeSqlTextExpr(searchDocText, unaccentReady)
  const titleLikeText = normalizeSqlTextExpr(`ki.title`, unaccentReady)
  const questionLikeText = normalizeSqlTextExpr(`lv.question_text`, unaccentReady)
  const answerLikeText = normalizeSqlTextExpr(`lv.answer_text`, unaccentReady)
  const searchTsv = knowledgeSearchTsvExpr(searchDocReady)
  const q = input.query?.trim()
  const hasSearchQuery = Boolean(q)

  let likeParam = 'null'
  let similarityParam = 'null'
  let tsqParam = 'null'
  let queryVectorParam: string | null = null
  let vectorMaxDistanceParam: string | null = null

  if (hasSearchQuery && q) {
    const normalizedQuery = normalizeSqlQuery(q, unaccentReady)
    values.push(`%${normalizedQuery}%`)
    likeParam = `$${values.length}`
    values.push(normalizedQuery)
    similarityParam = `$${values.length}`
    values.push(q)
    tsqParam = `$${values.length}`

    if (isHybridSearchEnabled() && embeddingReady) {
      const queryEmbedding = await embedSearchText(q).catch(() => null)
      if (queryEmbedding) {
        values.push(vectorLiteral(queryEmbedding))
        queryVectorParam = `$${values.length}`
        values.push(SEARCH_VECTOR_MAX_DISTANCE)
        vectorMaxDistanceParam = `$${values.length}`
      }
    }
  }

  const hybrid: HybridSearchContext = {
    searchDocText,
    searchDocLikeText,
    titleLikeText,
    questionLikeText,
    answerLikeText,
    searchTsv,
    trgmReady,
    embeddingReady,
    queryVectorParam,
    vectorMaxDistanceParam,
    ftsWeight: searchFtsWeight(),
    semanticWeight: searchSemanticWeight(),
  }

  const whereSql = buildWhere(input, values, hybrid, { likeParam, tsqParam, similarityParam })
  const audienceTablesReady = await areAudienceTablesReady()
  const normalizedProfileCode = input.profileCode?.trim().toLowerCase() || null
  const normalizedProfileTypeCode = input.profileTypeCode?.trim().toLowerCase() || null
  const normalizedProgramLevel = input.programLevelCode?.trim().toLowerCase() || null
  const normalizedLifecycle = input.studentLifecycleCode?.trim().toUpperCase() || null
  const hasTaxonomyFilters = Boolean(input.category || input.subcategory || input.element)
  const shouldKeepSectionBoost = !(input.crossSection === true && Boolean(input.query?.trim()) && !hasTaxonomyFilters)
  const preferredSection = shouldKeepSectionBoost ? resolveSectionCode(input.uiSection) : null

  values.push(clampLimit(input.limit))
  const limitParam = `$${values.length}`
  values.push(normalizedProfileCode)
  const profileParam = `$${values.length}`
  values.push(normalizedProfileTypeCode)
  const profileTypeParam = `$${values.length}`
  values.push(normalizedProgramLevel)
  const programLevelParam = `$${values.length}`
  values.push(normalizedLifecycle)
  const lifecycleParam = `$${values.length}`
  values.push(preferredSection)
  const sectionHintParam = `$${values.length}`

  const audienceJoinSql = audienceTablesReady
    ? `
    ,
    audience_rank as (
      select
        ki.id as knowledge_item_id,
        count(kia.knowledge_item_id) > 0 as has_any_audience,
        coalesce(max(
          case
            when ${profileParam}::text is null then 0
            when lower(kia.profile_code) = ${profileParam}::text
              and ${profileTypeParam}::text is not null
              and ptc.id is not null
              and lower(ptc.type_code) = ${profileTypeParam}::text
              and (${programLevelParam}::text is null or kia.program_level_code is null or lower(kia.program_level_code) = ${programLevelParam}::text)
              and (${lifecycleParam}::text is null or kia.student_type_id is null or upper(st.code) = ${lifecycleParam}::text)
              then 300
            when lower(kia.profile_code) = ${profileParam}::text
              and lower(coalesce(ptc.type_code, '')) = 'sin_tipo'
              then 200
            when lower(kia.profile_code) = ${profileParam}::text
              then 150
            else 0
          end
        ), 0) as audience_score
      from knowledge_items ki
      left join knowledge_item_audiences kia on kia.knowledge_item_id = ki.id
      left join profile_type_catalog ptc on ptc.id = kia.profile_type_id
      left join student_types st on st.id = kia.student_type_id
      group by ki.id
    ),
    primary_audience as (
      select distinct on (kia.knowledge_item_id)
        kia.knowledge_item_id,
        ptc.type_code as modality,
        kia.program_level_code as program_level,
        st.code as student_lifecycle,
        (
          count(*) over (partition by kia.knowledge_item_id) = 1
          and coalesce(ptc.type_code, 'sin_tipo') = 'sin_tipo'
          and kia.program_level_code is null
          and kia.student_type_id is null
        ) as applies_to_all
      from knowledge_item_audiences kia
      left join profile_type_catalog ptc on ptc.id = kia.profile_type_id
      left join student_types st on st.id = kia.student_type_id
      order by kia.knowledge_item_id, kia.priority asc, kia.created_at asc
    )
  `
    : `
    ,
    audience_rank as (
      select ki.id as knowledge_item_id, false as has_any_audience, 0 as audience_score
      from knowledge_items ki
    ),
    primary_audience as (
      select ki.id as knowledge_item_id, null::text as modality, null::text as program_level,
        null::text as student_lifecycle, true as applies_to_all
      from knowledge_items ki
    )
  `

  const sql = `
    with latest_versions as (
      select distinct on (v.knowledge_item_id)
        v.knowledge_item_id,
        v.question_text,
        v.answer_text,
        v.synonyms_json,
        v.phrases_json,
        v.search_forms_json
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
      ki.content_type,
      ki.section_code,
      d.code as domain_code,
      d.name as domain_name,
      ki.review_policy,
      kc.service_category_code,
      pa.modality,
      pa.program_level,
      pa.student_lifecycle,
      coalesce(pa.applies_to_all, true) as applies_to_all,
      ar.audience_score::double precision as audience_score,
      (case when ${sectionHintParam}::text is not null and ki.section_code = ${sectionHintParam}::text then 0.05 else 0 end)::double precision as section_boost,
      ${
        hasSearchQuery
          ? `(
            ts_rank(${searchTsv}, websearch_to_tsquery('spanish', ${tsqParam}), 32)::double precision * ${hybrid.ftsWeight * 0.65} +
            (case when ${hybrid.titleLikeText} like ${likeParam} then 0.35 else 0 end) +
            (case when ${hybrid.questionLikeText} like ${likeParam} then 0.25 else 0 end) +
            (case when ${hybrid.answerLikeText} like ${likeParam} then 0.15 else 0 end) +
            (case when ${hybrid.searchDocLikeText} like ${likeParam} then 0.1 else 0 end) +
            ${
              trgmReady
                ? `(similarity(${hybrid.searchDocLikeText}, ${similarityParam}) * 0.25)`
                : '0'
            } +
            ${
              queryVectorParam
                ? `(case when ki.search_embedding is not null then greatest(0, 1 - (ki.search_embedding <=> ${queryVectorParam}::vector)) * ${hybrid.semanticWeight} else 0 end)`
                : '0'
            }
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
    left join primary_audience pa on pa.knowledge_item_id = ki.id
    where ${whereSql}
    order by
      section_boost desc,
      ar.audience_score desc,
      score desc,
      service_name asc
    limit ${limitParam}
  `

  const { rows } = await dbQuery<SearchRow>(sql, values)
  return rows.map((row) => ({
    ...mapRowToSearchResult(row),
    score: (Number(row.score) || 0) + (Number(row.section_boost) || 0) + (Number(row.audience_score) || 0) / 1000,
  }))
}

export async function fetchPublishedItemIdsForEmbeddingBackfill(limit: number): Promise<string[]> {
  const { rows } = await dbQuery<{ id: string }>(
    `
      select ki.id::text as id
      from knowledge_items ki
      where ki.is_active = true
        and ki.editorial_status in ('published', 'approved')
        and coalesce(ki.search_document, '') <> ''
        and ki.search_embedding is null
      order by ki.updated_at asc
      limit $1
    `,
    [Math.min(Math.max(limit, 1), 5000)],
  )
  return rows.map((row) => row.id)
}

export async function countItemsMissingEmbeddings(): Promise<number> {
  const { rows } = await dbQuery<{ n: number }>(
    `
      select count(*)::int as n
      from knowledge_items ki
      where ki.is_active = true
        and ki.editorial_status in ('published', 'approved')
        and coalesce(ki.search_document, '') <> ''
        and ki.search_embedding is null
    `,
  )
  return rows[0]?.n ?? 0
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
  const tablesReady = await areKnowledgeItemsReady()
  if (!tablesReady) return []

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
      and ki.editorial_status in ('published', 'approved')
      and ki.section_code = '${sectionCode}'
    group by
      kc.slug,
      kc.name,
      kc.sort_order,
      ks.slug,
      ks.name,
      ks.sort_order,
      ke.slug,
      ke.name,
      ke.sort_order
    order by
      kc.sort_order asc,
      kc.name asc,
      ks.sort_order asc,
      ks.name asc,
      ke.sort_order asc,
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
  section_code: string
  content_type: string
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
      lv.answer_text,
      ki.section_code,
      ki.content_type
    from knowledge_items ki
    join kb_elements ke on ke.id = ki.kb_element_id
    join kb_subcategories ks on ks.id = ke.kb_subcategory_id
    join kb_categories kc on kc.id = ks.kb_category_id
    left join latest_versions lv on lv.knowledge_item_id = ki.id
    where ki.id::text = $1
      and ki.is_active = true
      and ki.editorial_status in ('published', 'approved')
    limit 1
  `

  const { rows } = await dbQuery<ServiceDetailRow>(sql, [serviceId])
  if (rows.length === 0) return null
  return rows[0]
}
