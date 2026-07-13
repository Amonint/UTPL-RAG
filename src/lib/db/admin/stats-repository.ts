import { dbQuery } from '@/lib/db/postgres'

export interface AdminDbStats {
  domains: number
  categories: number
  subcategories: number
  elements: number
  items: number
  versions: number
  publishedItems: number
  draftItems: number
  itemsMissingEmbeddings: number
}

export async function fetchAdminDbStats(): Promise<AdminDbStats> {
  const { rows } = await dbQuery<{
    domains: string
    categories: string
    subcategories: string
    elements: string
    items: string
    versions: string
    published_items: string
    draft_items: string
    items_missing_embeddings: string
  }>(`
    select
      (select count(*)::text from domains where is_active) as domains,
      (select count(*)::text from kb_categories where is_active) as categories,
      (select count(*)::text from kb_subcategories where is_active) as subcategories,
      (select count(*)::text from kb_elements where is_active) as elements,
      (select count(*)::text from knowledge_items) as items,
      (select count(*)::text from knowledge_item_versions) as versions,
      (select count(*)::text from knowledge_items where editorial_status = 'published') as published_items,
      (select count(*)::text from knowledge_items where editorial_status not in ('published', 'archived')) as draft_items,
      (
        select count(*)::text
        from knowledge_items ki
        where ki.is_active
          and ki.editorial_status in ('published', 'approved')
          and coalesce(ki.search_document, '') <> ''
          and ki.search_embedding is null
          and to_regclass('public.knowledge_items') is not null
      ) as items_missing_embeddings
  `)

  const row = rows[0]
  return {
    domains: Number(row?.domains) || 0,
    categories: Number(row?.categories) || 0,
    subcategories: Number(row?.subcategories) || 0,
    elements: Number(row?.elements) || 0,
    items: Number(row?.items) || 0,
    versions: Number(row?.versions) || 0,
    publishedItems: Number(row?.published_items) || 0,
    draftItems: Number(row?.draft_items) || 0,
    itemsMissingEmbeddings: Number(row?.items_missing_embeddings) || 0,
  }
}

export interface DomainItemCount {
  domainCode: string
  domainName: string
  itemCount: number
}

export async function fetchItemCountsByDomain(): Promise<DomainItemCount[]> {
  const { rows } = await dbQuery<{
    domain_code: string
    domain_name: string
    item_count: string
  }>(`
    select
      d.code as domain_code,
      d.name as domain_name,
      count(ki.id)::text as item_count
    from domains d
    left join knowledge_items ki on ki.domain_id = d.id
    where d.is_active
    group by d.id, d.code, d.name
    order by d.sort_order asc, d.name asc
  `)

  return rows.map((r) => ({
    domainCode: r.domain_code,
    domainName: r.domain_name,
    itemCount: Number(r.item_count) || 0,
  }))
}
