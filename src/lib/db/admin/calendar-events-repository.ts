import { createHash } from 'crypto'

import type { PoolClient } from 'pg'

import {
  decodeScopeMeta,
  encodeScopeMeta,
  PROFILE_TYPE_TO_MODALITY_CODE,
  type CalendarEditorialStatus,
  type CalendarEventScopeMeta,
} from '@/lib/calendar/event-scope-meta'
import {
  mapDbRowToAcademicRecord,
} from '@/lib/calendar/map-db-to-academic-record'
import {
  isPgTrgmReady,
  isUnaccentReady,
  normalizeSqlTextExpr,
} from '@/lib/db/knowledge-search-sql'
import { embedSearchText } from '@/lib/search/embeddings/gemini-embeddings'
import {
  isHybridSearchEnabled,
  SEARCH_VECTOR_MAX_DISTANCE,
  vectorLiteral,
} from '@/lib/search/hybrid-search-config'
import { normalizeText } from '@/lib/search/normalize'
import { buildSpanishDateSearchText } from '@/lib/search/spanish-date-search'
import { buildSpanishDateSearchTextSql } from '@/lib/search/spanish-date-search-sql'
import { EVENTS as STATIC_CALENDAR_EVENTS, type AcademicCalendarEventRecord } from '@/data/academic-calendar-events'
import { dbQuery } from '@/lib/db/postgres'
import { dbQueryClient } from '@/lib/db/transaction'
import type { SearchResult, StudentType } from '@/lib/types'

export type CalendarEventsListQuery = {
  domainCode?: string
  profileTypeCode?: string
  studentTypeCode?: string
  periodLabel?: string
  periodValidFrom?: string
  periodValidTo?: string
  includePast?: boolean
  /** Si true, oculta eventos con editorialStatus=review (calendario público). */
  excludePendingReview?: boolean
}

export type CreateCalendarEventInput = {
  title: string
  eventType: string
  startsOn: string
  endsOn: string
  scope: CalendarEventScopeMeta
}

export type UpdateCalendarEventInput = Partial<CreateCalendarEventInput>

type DbRow = {
  id: string
  title: string
  event_type: string
  starts_on: string
  ends_on: string
  details_text: string | null
  modality_labels: string[] | null
  modality_codes: string[] | null
}

type CalendarSearchRow = {
  id: string
  title: string
  event_type: string
  starts_on: string
  ends_on: string
  details_text: string | null
  modality_labels: string[] | null
  modality_codes: string[] | null
  score: number
}

let calendarEmbeddingColumnReadyCache: boolean | null = null

async function isCalendarSearchEmbeddingColumnReady(): Promise<boolean> {
  if (calendarEmbeddingColumnReadyCache !== null) return calendarEmbeddingColumnReadyCache
  const { rows } = await dbQuery<{ ready: boolean }>(`
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'calendar_events'
        and column_name = 'search_embedding'
    ) as ready
  `)
  calendarEmbeddingColumnReadyCache = Boolean(rows[0]?.ready)
  return calendarEmbeddingColumnReadyCache
}

export async function calendarEventsTableReady(): Promise<boolean> {
  const { rows } = await dbQuery<{ ready: boolean }>(`
    select to_regclass('public.calendar_events') is not null as ready
  `)
  return Boolean(rows[0]?.ready)
}

/** Categorías de evento usadas en calendario (desde BD, sin lista fija). */
export async function fetchDistinctCalendarEventTypes(): Promise<string[]> {
  const ready = await calendarEventsTableReady()
  if (!ready) return []
  const { rows } = await dbQuery<{ event_type: string }>(`
    select distinct event_type
    from calendar_events
    where is_active
      and nullif(trim(event_type), '') is not null
    order by event_type asc
  `)
  return rows.map((r) => r.event_type)
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'evento'
}

function buildCanonicalSlug(title: string, startsOn: string, scope: CalendarEventScopeMeta): string {
  const base = `${title}|${startsOn}|${scope.domainCode ?? ''}|${scope.profileTypeCode ?? ''}|${scope.studentTypeCode ?? ''}`
  return createHash('sha1').update(base).digest('hex').slice(0, 40)
}

async function resolveCalendarDomainId(client: PoolClient): Promise<string> {
  const { rows } = await dbQueryClient<{ id: string }>(
    client,
    `select id::text from domains where code = 'calendar' and is_active limit 1`,
  )
  if (!rows[0]?.id) {
    throw new Error("No existe el dominio 'calendar' en la base de datos.")
  }
  return rows[0].id
}

async function ensureAdminCalendar(
  client: PoolClient,
  domainCode: string,
): Promise<string> {
  const domainId = await resolveCalendarDomainId(client)
  const slug = `admin-${slugify(domainCode || 'general')}`
  const name = `Calendario administración (${domainCode || 'general'})`
  const { rows } = await dbQueryClient<{ id: string }>(
    client,
    `
    insert into calendars (domain_id, name, slug, calendar_type, description, is_active)
    values ($1::uuid, $2, $3, 'academic', $4, true)
    on conflict (domain_id, slug) do update set updated_at = now()
    returning id::text
    `,
    [domainId, name, slug, `Área: ${domainCode}`],
  )
  return rows[0]!.id
}

async function resolveModalityId(
  client: PoolClient,
  profileTypeCode: string | undefined,
): Promise<string | null> {
  if (!profileTypeCode?.trim()) return null
  const code =
    PROFILE_TYPE_TO_MODALITY_CODE[profileTypeCode] ?? profileTypeCode.trim().toLowerCase()
  const { rows } = await dbQueryClient<{ id: string }>(
    client,
    `select id::text from modalities where code = $1 and is_active limit 1`,
    [code],
  )
  return rows[0]?.id ?? null
}

async function resolveStudentTypeId(client: PoolClient, code: string | undefined): Promise<string | null> {
  if (!code?.trim()) return null
  const { rows } = await dbQueryClient<{ id: string }>(
    client,
    `select id::text from student_types where code = $1 and is_active limit 1`,
    [code.trim().toUpperCase()],
  )
  return rows[0]?.id ?? null
}

async function upsertCyclePeriod(
  client: PoolClient,
  scope: CalendarEventScopeMeta,
): Promise<string | null> {
  if (!scope.periodLabel?.trim() && !scope.periodCode?.trim()) return null

  if (scope.periodCode?.trim()) {
    const byCode = await dbQueryClient<{ id: string }>(
      client,
      `select id::text from cycle_periods where code = $1 limit 1`,
      [scope.periodCode.trim()],
    )
    if (byCode.rows[0]?.id) return byCode.rows[0].id
  }

  if (scope.periodValidFrom && scope.periodValidTo) {
    const byDates = await dbQueryClient<{ id: string }>(
      client,
      `
      select id::text
      from cycle_periods
      where starts_on = $1::date
        and ends_on = $2::date
        and is_active
      order by case when name = $3 then 0 else 1 end, code asc
      limit 1
      `,
      [scope.periodValidFrom, scope.periodValidTo, scope.periodLabel ?? ''],
    )
    if (byDates.rows[0]?.id) return byDates.rows[0].id
  }

  const code = scope.periodCode?.trim() || slugify(scope.periodLabel ?? 'periodo')
  const { rows } = await dbQueryClient<{ id: string }>(
    client,
    `
    insert into cycle_periods (code, name, starts_on, ends_on, is_active)
    values ($1, $2, $3::date, $4::date, true)
    on conflict (code) do update
      set name = excluded.name,
          starts_on = coalesce(excluded.starts_on, cycle_periods.starts_on),
          ends_on = coalesce(excluded.ends_on, cycle_periods.ends_on),
          updated_at = now()
    returning id::text
    `,
    [code, scope.periodLabel ?? code, scope.periodValidFrom ?? null, scope.periodValidTo ?? null],
  )
  return rows[0]?.id ?? null
}

async function replaceEventLinks(
  client: PoolClient,
  eventId: string,
  scope: CalendarEventScopeMeta,
): Promise<void> {
  await dbQueryClient(client, `delete from calendar_event_modalities where calendar_event_id = $1::uuid`, [
    eventId,
  ])
  await dbQueryClient(client, `delete from calendar_event_student_types where calendar_event_id = $1::uuid`, [
    eventId,
  ])
  await dbQueryClient(client, `delete from calendar_event_cycles where calendar_event_id = $1::uuid`, [eventId])

  const modalityId = await resolveModalityId(client, scope.profileTypeCode)
  if (modalityId) {
    await dbQueryClient(
      client,
      `
      insert into calendar_event_modalities (calendar_event_id, modality_id)
      values ($1::uuid, $2::uuid)
      on conflict do nothing
      `,
      [eventId, modalityId],
    )
  }

  const studentTypeId = await resolveStudentTypeId(client, scope.studentTypeCode)
  if (studentTypeId) {
    await dbQueryClient(
      client,
      `
      insert into calendar_event_student_types (calendar_event_id, student_type_id)
      values ($1::uuid, $2::uuid)
      on conflict do nothing
      `,
      [eventId, studentTypeId],
    )
  }

  const cycleId = await upsertCyclePeriod(client, scope)
  if (cycleId) {
    await dbQueryClient(
      client,
      `
      insert into calendar_event_cycles (calendar_event_id, cycle_period_id)
      values ($1::uuid, $2::uuid)
      on conflict do nothing
      `,
      [eventId, cycleId],
    )
  }
}

import type { CalendarEventWithScope } from '@/lib/calendar/types'

function mapRowsWithScope(rows: DbRow[]): CalendarEventWithScope[] {
  return rows.map((row) => ({
    ...mapDbRowToAcademicRecord({
      id: row.id,
      title: row.title,
      eventType: row.event_type,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
      detailsText: row.details_text,
      modalityLabels: row.modality_labels ?? [],
      modalityCodes: row.modality_codes ?? [],
    }),
    scope: decodeScopeMeta(row.details_text),
  }))
}

const LIST_SELECT = `
  select
    ce.id::text as id,
    ce.title,
    ce.event_type,
    ce.starts_on::text as starts_on,
    ce.ends_on::text as ends_on,
    ce.details_text,
    coalesce(array_agg(distinct m.name) filter (where m.name is not null), '{}') as modality_labels,
    coalesce(array_agg(distinct m.code) filter (where m.code is not null), '{}') as modality_codes
  from calendar_events ce
  join calendars c on c.id = ce.calendar_id
  left join calendar_event_modalities cem on cem.calendar_event_id = ce.id
  left join modalities m on m.id = cem.modality_id
  left join calendar_event_student_types cest on cest.calendar_event_id = ce.id
  left join student_types st on st.id = cest.student_type_id
  left join calendar_event_cycles cec on cec.calendar_event_id = ce.id
  left join cycle_periods cp on cp.id = cec.cycle_period_id
`

export async function listCalendarEvents(
  query: CalendarEventsListQuery,
): Promise<AcademicCalendarEventRecord[]> {
  const rows = await listCalendarEventsWithScope({
    ...query,
    excludePendingReview: query.excludePendingReview ?? true,
  })
  return rows.map(({ scope: _scope, ...event }) => event)
}

export async function listCalendarEventsWithScope(
  query: CalendarEventsListQuery,
): Promise<CalendarEventWithScope[]> {
  const ready = await calendarEventsTableReady()
  if (!ready) return []

  const conditions: string[] = ['ce.is_active = true']
  const values: unknown[] = []
  let idx = 1

  if (!query.includePast) {
    conditions.push(`ce.ends_on >= (current_date at time zone 'America/Guayaquil')::date`)
  }

  if (query.excludePendingReview) {
    conditions.push(`(
      ce.details_text is null
      or ce.details_text not like '{%'
      or coalesce(ce.details_text::jsonb->>'editorialStatus', 'published') <> 'review'
    )`)
  }

  if (query.domainCode) {
    conditions.push(
      `(ce.details_text is not null and ce.details_text like '{%' and ce.details_text::jsonb->>'domainCode' = $${idx})`,
    )
    values.push(query.domainCode)
    idx += 1
  }

  if (query.profileTypeCode) {
    conditions.push(
      `(
        exists (
          select 1 from calendar_event_modalities cem2
          join modalities m2 on m2.id = cem2.modality_id
          where cem2.calendar_event_id = ce.id
            and m2.code = $${idx}
        )
        or ce.details_text::jsonb->>'profileTypeCode' = $${idx}
      )`,
    )
    values.push(
      PROFILE_TYPE_TO_MODALITY_CODE[query.profileTypeCode] ?? query.profileTypeCode.toLowerCase(),
    )
    idx += 1
  }

  if (query.studentTypeCode) {
    conditions.push(
      `(
        exists (
          select 1 from calendar_event_student_types cest2
          join student_types st2 on st2.id = cest2.student_type_id
          where cest2.calendar_event_id = ce.id and st2.code = $${idx}
        )
        or ce.details_text::jsonb->>'studentTypeCode' = $${idx}
      )`,
    )
    values.push(query.studentTypeCode.toUpperCase())
    idx += 1
  }

  if (query.periodLabel) {
    conditions.push(
      `(cp.name ilike $${idx} or ce.details_text::jsonb->>'periodLabel' ilike $${idx})`,
    )
    values.push(`%${query.periodLabel}%`)
    idx += 1
  }

  if (query.periodValidFrom && query.periodValidTo) {
    conditions.push(
      `(
        (ce.valid_from is null and ce.valid_to is null)
        or (ce.valid_from <= $${idx + 1}::date and ce.valid_to >= $${idx}::date)
        or (cp.starts_on <= $${idx + 1}::date and cp.ends_on >= $${idx}::date)
      )`,
    )
    values.push(query.periodValidFrom, query.periodValidTo)
    idx += 2
  }

  const where = conditions.length ? `where ${conditions.join(' and ')}` : ''

  const { rows } = await dbQuery<DbRow>(
    `
    ${LIST_SELECT}
    ${where}
    group by ce.id, ce.title, ce.event_type, ce.starts_on, ce.ends_on, ce.details_text
    order by ce.starts_on asc, ce.title asc
    `,
    values,
  )

  return mapRowsWithScope(rows)
}

function mapCalendarRowToSearchResult(row: CalendarSearchRow): SearchResult {
  const scope = decodeScopeMeta(row.details_text)
  const startsOn = row.starts_on
  const endsOn = row.ends_on
  const periodLabel = scope?.periodLabel ?? undefined
  const modality =
    row.modality_labels?.filter(Boolean).join(' / ') ||
    row.modality_codes?.filter(Boolean).join(' / ') ||
    scope?.profileTypeCode ||
    'sin_tipo'
  const studentLifecycle = scope?.studentTypeCode?.toUpperCase() || null
  const dateLabel = startsOn === endsOn ? startsOn : `${startsOn} - ${endsOn}`

  return {
    serviceId: `calendar-event-${row.id}`,
    serviceName: row.title,
    category: row.event_type || 'Calendario',
    score: Number(row.score) || 0,
    hasPdfs: false,
    snippet: `${row.event_type || 'Evento'} · ${dateLabel}`,
    studentTypes: studentLifecycle ? [studentLifecycle as StudentType] : [],
    pdfRefs: [],
    jsonPayload: {
      event_id: row.id,
      category: row.event_type || 'Calendario',
      subcategory: 'Calendario',
      element: row.title,
      question: row.title,
      answer: row.details_text?.trim() || null,
      content_type: 'fechas',
      section_code: 'calendar',
      domain_code: 'calendar',
      domain_name: 'Calendario',
      modality,
      student_lifecycle: studentLifecycle,
      period_label: periodLabel,
      applies_to_all: !scope?.studentTypeCode,
      event_start: startsOn,
      event_end: endsOn,
      source: 'calendar_events',
    },
    matchHints: [`Fecha: ${dateLabel}`],
  }
}

function searchCalendarEventsStatic(query: string, limit: number): SearchResult[] {
  const q = normalizeText(query)
  const tokens = q.split(/\s+/).filter((t) => t.length >= 2)
  if (!tokens.length) return []

  return STATIC_CALENDAR_EVENTS.filter((event) => {
    const text = normalizeText(
      [
        event.title,
        event.category,
        event.modality,
        event.start,
        event.end,
        buildSpanishDateSearchText(event.start, event.end),
      ].join(' '),
    )
    return tokens.some((t) => text.includes(t))
  })
    .slice(0, limit)
    .map((event) => {
      const id = String(event.id)
      const dateLabel =
        event.start === event.end ? event.start : `${event.start} - ${event.end}`
      return {
        serviceId: `calendar-event-${id}`,
        serviceName: event.title,
        category: event.category,
        score: 0.5,
        hasPdfs: false,
        snippet: `${event.category} · ${dateLabel}`,
        studentTypes: [],
        pdfRefs: [],
        jsonPayload: {
          event_id: id,
          category: event.category,
          subcategory: 'Calendario',
          element: event.title,
          question: event.title,
          answer: null,
          content_type: 'fechas',
          section_code: 'calendar',
          domain_code: 'calendar',
          domain_name: 'Calendario',
          modality: event.modality,
          event_start: event.start,
          event_end: event.end,
          source: 'static_events',
        },
        matchHints: [`Fecha: ${dateLabel}`],
      }
    })
}

export async function searchCalendarEventsForChat(input: {
  query: string
  limit: number
}): Promise<SearchResult[]> {
  const q = input.query.trim()
  if (!q) return []
  const ready = await calendarEventsTableReady()
  if (!ready) return searchCalendarEventsStatic(q, input.limit)

  const unaccentReady = await isUnaccentReady(dbQuery)
  const trgmReady = await isPgTrgmReady(dbQuery)
  const embeddingReady = await isCalendarSearchEmbeddingColumnReady()
  const normalizedQuery = unaccentReady ? normalizeText(q) : q.toLowerCase().trim().replace(/\s+/g, ' ')
  const like = `%${normalizedQuery}%`
  const limit = Math.min(Math.max(input.limit, 1), 50)
  const values: unknown[] = [like, normalizedQuery]
  const similarityParam = `$2`

  let queryVectorParam: string | null = null
  let vectorMaxDistanceParam: string | null = null
  const calendarVectorEnabled =
    isHybridSearchEnabled() && process.env.SEARCH_CALENDAR_VECTOR_ENABLED !== 'false'

  if (calendarVectorEnabled && embeddingReady) {
    const queryEmbedding = await embedSearchText(q).catch(() => null)
    if (queryEmbedding) {
      values.push(vectorLiteral(queryEmbedding))
      queryVectorParam = `$${values.length}`
      values.push(SEARCH_VECTOR_MAX_DISTANCE)
      vectorMaxDistanceParam = `$${values.length}`
    }
  }

  values.push(limit)
  const limitParam = `$${values.length}`

  const titleTextExpr = normalizeSqlTextExpr('b.title', unaccentReady)
  const eventTypeTextExpr = normalizeSqlTextExpr('b.event_type', unaccentReady)
  const detailsTextExpr = normalizeSqlTextExpr('b.details_text', unaccentReady)
  const periodTextExpr = normalizeSqlTextExpr('b.period_names', unaccentReady)
  const startsOnTextExpr = normalizeSqlTextExpr('b.starts_on::text', unaccentReady)
  const endsOnTextExpr = normalizeSqlTextExpr('b.ends_on::text', unaccentReady)
  const startsOnSpanishTextExpr = normalizeSqlTextExpr('b.starts_on_spanish', unaccentReady)
  const endsOnSpanishTextExpr = normalizeSqlTextExpr('b.ends_on_spanish', unaccentReady)
  const searchDocExpr = `concat_ws(' ', ${titleTextExpr}, ${eventTypeTextExpr}, ${startsOnTextExpr}, ${endsOnTextExpr}, ${startsOnSpanishTextExpr}, ${endsOnSpanishTextExpr}, ${periodTextExpr}, ${detailsTextExpr})`
  const trigramScoreExpr = trgmReady ? `similarity(${searchDocExpr}, ${similarityParam}) * 0.22` : '0'
  const vectorScoreExpr =
    queryVectorParam && vectorMaxDistanceParam
      ? `(case when b.search_embedding is not null then greatest(0, 1 - (b.search_embedding <=> ${queryVectorParam}::vector)) * 0.35 else 0 end)`
      : '0'
  const embeddingSelectExpr = embeddingReady ? 'ce.search_embedding as search_embedding,' : 'null as search_embedding,'
  const embeddingGroupByExpr = embeddingReady ? ', ce.search_embedding' : ''

  const { rows } = await dbQuery<CalendarSearchRow>(
    `
    with base as (
      select
        ce.id::text as id,
        ce.title,
        ce.event_type,
        ce.starts_on::text as starts_on,
        ce.ends_on::text as ends_on,
        ${buildSpanishDateSearchTextSql('ce.starts_on')} as starts_on_spanish,
        ${buildSpanishDateSearchTextSql('ce.ends_on')} as ends_on_spanish,
        ce.details_text,
        ${embeddingSelectExpr}
        coalesce(string_agg(distinct cp.name, ' '), '') as period_names,
        coalesce(array_agg(distinct m.name) filter (where m.name is not null), '{}') as modality_labels,
        coalesce(array_agg(distinct m.code) filter (where m.code is not null), '{}') as modality_codes
      from calendar_events ce
      left join calendar_event_modalities cem on cem.calendar_event_id = ce.id
      left join modalities m on m.id = cem.modality_id
      left join calendar_event_cycles cec on cec.calendar_event_id = ce.id
      left join cycle_periods cp on cp.id = cec.cycle_period_id
      where ce.is_active = true
        and (
          ce.details_text is null
          or ce.details_text not like '{%'
          or coalesce(ce.details_text::jsonb->>'editorialStatus', 'published') <> 'review'
        )
      group by ce.id, ce.title, ce.event_type, ce.starts_on, ce.ends_on, ce.details_text${embeddingGroupByExpr}
    )
    select
      b.id,
      b.title,
      b.event_type,
      b.starts_on,
      b.ends_on,
      b.details_text,
      b.modality_labels,
      b.modality_codes,
      (
        (case when ${titleTextExpr} like $1 then 0.38 else 0 end) +
        (case when ${eventTypeTextExpr} like $1 then 0.16 else 0 end) +
        (case when ${startsOnTextExpr} like $1 or ${endsOnTextExpr} like $1 then 0.20 else 0 end) +
        (case when ${startsOnSpanishTextExpr} like $1 or ${endsOnSpanishTextExpr} like $1 then 0.26 else 0 end) +
        (case when ${periodTextExpr} like $1 then 0.14 else 0 end) +
        (case when ${detailsTextExpr} like $1 then 0.10 else 0 end) +
        coalesce((
          select sum(
            case
              when length(tok) >= 2 and ${searchDocExpr} like ('%' || tok || '%') then 0.05
              else 0
            end
          )::double precision
          from regexp_split_to_table($2::text, '\\\\s+') as tok
        ), 0) +
        ${trigramScoreExpr} +
        ${vectorScoreExpr}
      )::double precision as score
    from base b
    where
      ${titleTextExpr} like $1
      or ${eventTypeTextExpr} like $1
      or ${startsOnTextExpr} like $1
      or ${endsOnTextExpr} like $1
      or ${startsOnSpanishTextExpr} like $1
      or ${endsOnSpanishTextExpr} like $1
      or ${detailsTextExpr} like $1
      or ${periodTextExpr} like $1
      ${trgmReady ? `or similarity(${searchDocExpr}, ${similarityParam}) > 0.16` : ''}
      ${
        queryVectorParam && vectorMaxDistanceParam
          ? `or (b.search_embedding is not null and b.search_embedding <=> ${queryVectorParam}::vector < ${vectorMaxDistanceParam}::double precision)`
          : ''
      }
    order by score desc, b.starts_on asc
    limit ${limitParam}
    `,
    values,
  )

  return rows.map(mapCalendarRowToSearchResult)
}

export async function createCalendarEvent(
  client: PoolClient,
  input: CreateCalendarEventInput,
): Promise<string> {
  const domainCode = input.scope.domainCode ?? 'calendar'
  const calendarId = await ensureAdminCalendar(client, domainCode)
  const canonicalSlug = buildCanonicalSlug(input.title, input.startsOn, input.scope)
  const detailsText = encodeScopeMeta(input.scope)

  const { rows } = await dbQueryClient<{ id: string }>(
    client,
    `
    insert into calendar_events (
      calendar_id,
      event_type,
      canonical_slug,
      title,
      starts_on,
      ends_on,
      details_text,
      valid_from,
      valid_to,
      is_active
    )
    values ($1::uuid, $2, $3, $4, $5::date, $6::date, $7, $8::date, $9::date, true)
    returning id::text
    `,
    [
      calendarId,
      input.eventType,
      canonicalSlug,
      input.title,
      input.startsOn,
      input.endsOn,
      detailsText,
      input.scope.periodValidFrom ?? null,
      input.scope.periodValidTo ?? null,
    ],
  )
  const eventId = rows[0]!.id
  await replaceEventLinks(client, eventId, input.scope)
  return eventId
}

export async function updateCalendarEvent(
  client: PoolClient,
  eventId: string,
  input: UpdateCalendarEventInput,
): Promise<void> {
  const sets: string[] = ['updated_at = now()']
  const values: unknown[] = []
  let idx = 1

  if (input.title !== undefined) {
    sets.push(`title = $${idx}`)
    values.push(input.title)
    idx += 1
  }
  if (input.eventType !== undefined) {
    sets.push(`event_type = $${idx}`)
    values.push(input.eventType)
    idx += 1
  }
  if (input.startsOn !== undefined) {
    sets.push(`starts_on = $${idx}::date`)
    values.push(input.startsOn)
    idx += 1
  }
  if (input.endsOn !== undefined) {
    sets.push(`ends_on = $${idx}::date`)
    values.push(input.endsOn)
    idx += 1
  }
  if (input.scope !== undefined) {
    sets.push(`details_text = $${idx}`)
    values.push(encodeScopeMeta(input.scope))
    idx += 1
    sets.push(`valid_from = $${idx}::date`)
    values.push(input.scope.periodValidFrom ?? null)
    idx += 1
    sets.push(`valid_to = $${idx}::date`)
    values.push(input.scope.periodValidTo ?? null)
    idx += 1
  }

  values.push(eventId)
  await dbQueryClient(
    client,
    `update calendar_events set ${sets.join(', ')} where id = $${idx}::uuid and is_active`,
    values,
  )

  if (input.scope) {
    await replaceEventLinks(client, eventId, input.scope)
  }
}

const EDITORIAL_STATUS_JSON_SQL = `
  jsonb_set(
    case
      when details_text is null or btrim(details_text) = '' or left(btrim(details_text), 1) <> '{'
        then '{}'::jsonb
      else details_text::jsonb
    end,
    '{editorialStatus}',
    to_jsonb($status::text)
  )::text
`

export async function updateCalendarEventEditorialStatus(
  client: PoolClient,
  eventId: string,
  editorialStatus: CalendarEditorialStatus,
): Promise<void> {
  await dbQueryClient(
    client,
    `
    update calendar_events
    set details_text = ${EDITORIAL_STATUS_JSON_SQL.replace('$status', '$2')},
        updated_at = now()
    where id = $1::uuid and is_active
    `,
    [eventId, editorialStatus],
  )
}

export async function publishAllCalendarEvents(client: PoolClient): Promise<number> {
  const { rowCount } = await dbQueryClient(
    client,
    `
    update calendar_events
    set details_text = ${EDITORIAL_STATUS_JSON_SQL.replace('$status', '$1')},
        updated_at = now()
    where is_active
      and coalesce(
        case
          when details_text is null or btrim(details_text) = '' or left(btrim(details_text), 1) <> '{'
            then 'review'
          else details_text::jsonb->>'editorialStatus'
        end,
        'review'
      ) <> 'published'
    `,
    ['published'],
  )
  return rowCount ?? 0
}

export async function softDeleteCalendarEvent(client: PoolClient, eventId: string): Promise<void> {
  await dbQueryClient(
    client,
    `update calendar_events set is_active = false, updated_at = now() where id = $1::uuid`,
    [eventId],
  )
}
