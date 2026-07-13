export type KbContentType = 'service' | 'incident' | 'faq' | 'calendar' | 'fechas' | 'general'

export type KbTaxonomyElement = {
  slug: string
  name: string
  count: number
}

export type KbTaxonomySubcategory = {
  slug: string
  name: string
  count: number
  elements: KbTaxonomyElement[]
}

export type KbTaxonomyCategory = {
  slug: string
  name: string
  count: number
  subcategories: KbTaxonomySubcategory[]
}

export type KbFilters = {
  category: string
  subcategory: string
  element: string
}

export type KbLeafSelection = {
  category: string
  subcategory: string
  element: string
}

export type KbViewMode = 'chat' | 'detail'
export type KbNavSection = 'documentation' | 'services_incidents'

export type KbResultPayload = {
  category?: string
  category_slug?: string
  subcategory?: string
  subcategory_slug?: string
  element?: string
  element_slug?: string
  question?: string | null
  answer?: string | null
  content_type?: KbContentType
  source?: string
}
