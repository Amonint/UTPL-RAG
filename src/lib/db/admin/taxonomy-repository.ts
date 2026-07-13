import type { PoolClient } from 'pg'

import { slugify } from '@/lib/admin/slugify'
import { dbQuery } from '@/lib/db/postgres'
import { dbQueryClient } from '@/lib/db/transaction'

export interface AdminTaxonomyElement {
  id: string
  slug: string
  name: string
  itemCount: number
  isActive: boolean
}

export interface AdminTaxonomySubcategory {
  id: string
  slug: string
  name: string
  itemCount: number
  isActive: boolean
  elements: AdminTaxonomyElement[]
}

export interface AdminTaxonomyCategory {
  id: string
  slug: string
  name: string
  itemCount: number
  isActive: boolean
  subcategories: AdminTaxonomySubcategory[]
}

export interface AdminTaxonomyDomain {
  id: string
  code: string
  name: string
  itemCount: number
  categories: AdminTaxonomyCategory[]
}

export type AdminTaxonomySectionCode = 'faq' | 'general_info'

export async function fetchAdminTaxonomyTree(
  sectionCode?: AdminTaxonomySectionCode,
): Promise<AdminTaxonomyDomain[]> {
  const { rows } = await dbQuery<{
    domain_id: string
    domain_code: string
    domain_name: string
    category_id: string | null
    category_slug: string | null
    category_name: string | null
    category_active: boolean | null
    subcategory_id: string | null
    subcategory_slug: string | null
    subcategory_name: string | null
    subcategory_active: boolean | null
    element_id: string | null
    element_slug: string | null
    element_name: string | null
    element_active: boolean | null
    item_count: string
  }>(`
    select
      d.id::text as domain_id,
      d.code as domain_code,
      d.name as domain_name,
      kc.id::text as category_id,
      kc.slug as category_slug,
      kc.name as category_name,
      kc.is_active as category_active,
      ks.id::text as subcategory_id,
      ks.slug as subcategory_slug,
      ks.name as subcategory_name,
      ks.is_active as subcategory_active,
      ke.id::text as element_id,
      ke.slug as element_slug,
      ke.name as element_name,
      ke.is_active as element_active,
      count(ki.id)::text as item_count
    from domains d
    left join kb_categories kc on kc.domain_id = d.id
    left join kb_subcategories ks on ks.kb_category_id = kc.id
    left join kb_elements ke on ke.kb_subcategory_id = ks.id
    left join knowledge_items ki on ki.kb_element_id = ke.id
      and ($1::text is null or ki.section_code = $1)
    where d.is_active
    group by
      d.id, d.code, d.name, d.sort_order,
      kc.id, kc.slug, kc.name, kc.is_active, kc.sort_order,
      ks.id, ks.slug, ks.name, ks.is_active, ks.sort_order,
      ke.id, ke.slug, ke.name, ke.is_active, ke.sort_order
    order by
      d.sort_order asc, d.name asc,
      kc.sort_order asc, kc.name asc nulls last,
      ks.sort_order asc, ks.name asc nulls last,
      ke.sort_order asc, ke.name asc nulls last
  `, [sectionCode ?? null])

  const domains = new Map<string, AdminTaxonomyDomain>()

  for (const row of rows) {
    let domain = domains.get(row.domain_id)
    if (!domain) {
      domain = {
        id: row.domain_id,
        code: row.domain_code,
        name: row.domain_name,
        itemCount: 0,
        categories: [],
      }
      domains.set(row.domain_id, domain)
    }

    if (!row.category_id) continue

    let category = domain.categories.find((c) => c.id === row.category_id)
    if (!category) {
      category = {
        id: row.category_id,
        slug: row.category_slug ?? '',
        name: row.category_name ?? '',
        itemCount: 0,
        isActive: row.category_active ?? true,
        subcategories: [],
      }
      domain.categories.push(category)
    }

    if (!row.subcategory_id) continue

    let subcategory = category.subcategories.find((s) => s.id === row.subcategory_id)
    if (!subcategory) {
      subcategory = {
        id: row.subcategory_id,
        slug: row.subcategory_slug ?? '',
        name: row.subcategory_name ?? '',
        itemCount: 0,
        isActive: row.subcategory_active ?? true,
        elements: [],
      }
      category.subcategories.push(subcategory)
    }

    if (!row.element_id) continue

    const count = Number(row.item_count) || 0
    subcategory.elements.push({
      id: row.element_id,
      slug: row.element_slug ?? '',
      name: row.element_name ?? '',
      itemCount: count,
      isActive: row.element_active ?? true,
    })
    subcategory.itemCount += count
    category.itemCount += count
    domain.itemCount += count
  }

  return Array.from(domains.values())
}

export async function upsertCategory(
  client: PoolClient,
  input: {
    domainId: string
    name: string
    slug?: string
    description?: string
    sortOrder?: number
  },
): Promise<string> {
  const slug = input.slug ?? slugify(input.name)
  const { rows } = await dbQueryClient<{ id: string }>(
    client,
    `
      insert into kb_categories (domain_id, name, slug, description, sort_order, is_active)
      values ($1, $2, $3, $4, coalesce($5, 0), true)
      on conflict (domain_id, slug) do update
        set name = excluded.name,
            description = coalesce(excluded.description, kb_categories.description),
            sort_order = coalesce(excluded.sort_order, kb_categories.sort_order),
            is_active = true,
            updated_at = now()
      returning id::text
    `,
    [input.domainId, input.name, slug, input.description ?? null, input.sortOrder ?? 0],
  )
  return rows[0].id
}

export async function patchCategory(
  client: PoolClient,
  id: string,
  input: Partial<{ name: string; slug: string; description: string; sortOrder: number; isActive: boolean }>,
): Promise<void> {
  const sets: string[] = ['updated_at = now()']
  const values: unknown[] = []
  if (input.name !== undefined) {
    values.push(input.name)
    sets.push(`name = $${values.length}`)
  }
  if (input.slug !== undefined) {
    values.push(input.slug)
    sets.push(`slug = $${values.length}`)
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
  await dbQueryClient(client, `update kb_categories set ${sets.join(', ')} where id = $${values.length}`, values)
}

export async function upsertSubcategory(
  client: PoolClient,
  input: {
    categoryId: string
    name: string
    slug?: string
    description?: string
    sortOrder?: number
  },
): Promise<string> {
  const slug = input.slug ?? slugify(input.name)
  const { rows } = await dbQueryClient<{ id: string }>(
    client,
    `
      insert into kb_subcategories (kb_category_id, name, slug, description, sort_order, is_active)
      values ($1, $2, $3, $4, coalesce($5, 0), true)
      on conflict (kb_category_id, slug) do update
        set name = excluded.name,
            description = coalesce(excluded.description, kb_subcategories.description),
            sort_order = coalesce(excluded.sort_order, kb_subcategories.sort_order),
            is_active = true,
            updated_at = now()
      returning id::text
    `,
    [input.categoryId, input.name, slug, input.description ?? null, input.sortOrder ?? 0],
  )
  return rows[0].id
}

export async function patchSubcategory(
  client: PoolClient,
  id: string,
  input: Partial<{ name: string; slug: string; description: string; sortOrder: number; isActive: boolean }>,
): Promise<void> {
  const sets: string[] = ['updated_at = now()']
  const values: unknown[] = []
  if (input.name !== undefined) {
    values.push(input.name)
    sets.push(`name = $${values.length}`)
  }
  if (input.slug !== undefined) {
    values.push(input.slug)
    sets.push(`slug = $${values.length}`)
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
  await dbQueryClient(client, `update kb_subcategories set ${sets.join(', ')} where id = $${values.length}`, values)
}

export async function upsertElement(
  client: PoolClient,
  input: {
    subcategoryId: string
    name: string
    slug?: string
    description?: string
    elementType?: string
    sortOrder?: number
  },
): Promise<string> {
  const slug = input.slug ?? slugify(input.name)
  const { rows } = await dbQueryClient<{ id: string }>(
    client,
    `
      insert into kb_elements (kb_subcategory_id, name, slug, description, element_type, sort_order, is_active)
      values ($1, $2, $3, $4, $5, coalesce($6, 0), true)
      on conflict (kb_subcategory_id, slug) do update
        set name = excluded.name,
            description = coalesce(excluded.description, kb_elements.description),
            element_type = coalesce(excluded.element_type, kb_elements.element_type),
            sort_order = coalesce(excluded.sort_order, kb_elements.sort_order),
            is_active = true,
            updated_at = now()
      returning id::text
    `,
    [
      input.subcategoryId,
      input.name,
      slug,
      input.description ?? null,
      input.elementType ?? 'faq_topic',
      input.sortOrder ?? 0,
    ],
  )
  return rows[0].id
}

export async function patchElement(
  client: PoolClient,
  id: string,
  input: Partial<{
    name: string
    slug: string
    description: string
    elementType: string
    sortOrder: number
    isActive: boolean
  }>,
): Promise<void> {
  const sets: string[] = ['updated_at = now()']
  const values: unknown[] = []
  if (input.name !== undefined) {
    values.push(input.name)
    sets.push(`name = $${values.length}`)
  }
  if (input.slug !== undefined) {
    values.push(input.slug)
    sets.push(`slug = $${values.length}`)
  }
  if (input.description !== undefined) {
    values.push(input.description)
    sets.push(`description = $${values.length}`)
  }
  if (input.elementType !== undefined) {
    values.push(input.elementType)
    sets.push(`element_type = $${values.length}`)
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
  await dbQueryClient(client, `update kb_elements set ${sets.join(', ')} where id = $${values.length}`, values)
}
