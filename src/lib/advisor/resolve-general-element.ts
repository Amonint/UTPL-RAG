import type { PoolClient } from 'pg'

import { upsertElement } from '@/lib/db/admin/taxonomy-repository'
import { dbQueryClient } from '@/lib/db/transaction'

/**
 * Resuelve o crea el ancla técnica "General" bajo una subcategoría.
 * El menú del asesor solo muestra Dominio → Categoría → Subcategoría.
 */
export async function resolveOrCreateGeneralElement(
  client: PoolClient,
  subcategoryId: string,
): Promise<string> {
  const { rows } = await dbQueryClient<{ id: string }>(
    client,
    `
      select id::text
      from kb_elements
      where kb_subcategory_id = $1
        and is_active
        and (slug = 'general' or lower(trim(name)) = 'general')
      order by case when slug = 'general' then 0 else 1 end
      limit 1
    `,
    [subcategoryId],
  )
  if (rows[0]?.id) return rows[0].id

  return upsertElement(client, {
    subcategoryId,
    name: 'General',
    slug: 'general',
  })
}

/** Comprueba que la subcategoría pertenece al dominio indicado. */
export async function assertSubcategoryInDomain(
  client: PoolClient,
  subcategoryId: string,
  domainId: string,
): Promise<void> {
  const { rows } = await dbQueryClient<{ ok: boolean }>(
    client,
    `
      select true as ok
      from kb_subcategories ks
      join kb_categories kc on kc.id = ks.kb_category_id
      where ks.id = $1
        and kc.domain_id = $2
        and ks.is_active
        and kc.is_active
      limit 1
    `,
    [subcategoryId, domainId],
  )
  if (!rows[0]?.ok) {
    throw new Error('La subcategoría no pertenece al dominio seleccionado.')
  }
}
