'use client'

import { ChevronDown, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'

import type { KbFilters, KbLeafSelection, KbNavSection, KbTaxonomyCategory } from './types'

const SECTION_HEADING: Record<
  KbNavSection,
  { title: string; description: string }
> = {
  documentation: {
    title: 'Información',
    description: 'Guías, manuales y políticas para orientar al estudiante.',
  },
  services_incidents: {
    title: 'Preguntas frecuentes',
    description: 'Trámites, servicios e incidencias habituales con pasos en SGA.',
  },
}

type Props = {
  taxonomy: KbTaxonomyCategory[]
  filters: KbFilters
  activeSection: KbNavSection
  sectionPickerVariant?: 'tabs' | 'select'
  onChange: (next: KbFilters) => void
  onSectionChange: (next: KbNavSection) => void
  onLeafSelect: (leaf: KbLeafSelection) => void
}

export function KbLeftNav({
  taxonomy,
  filters,
  activeSection,
  sectionPickerVariant = 'tabs',
  onChange,
  onSectionChange,
  onLeafSelect,
}: Props) {
  const visibleTaxonomy = taxonomy

  const selectedCategory = visibleTaxonomy.find((item) => item.slug === filters.category) ?? null
  const subcategories = selectedCategory
    ? selectedCategory.subcategories
    : visibleTaxonomy.flatMap((cat) => cat.subcategories)
  const selectedSubcategory = subcategories.find((item) => item.slug === filters.subcategory) ?? null
  const elements = selectedSubcategory
    ? selectedSubcategory.elements
    : selectedCategory
      ? selectedCategory.subcategories.flatMap((sub) => sub.elements)
      : visibleTaxonomy.flatMap((cat) => cat.subcategories.flatMap((sub) => sub.elements))

  const selectedElement = elements.find((item) => item.slug === filters.element) ?? null
  const heading = SECTION_HEADING[activeSection]
  const breadcrumb = [selectedCategory?.name, selectedSubcategory?.name, selectedElement?.name].filter(
    Boolean,
  )
  const subtitle =
    breadcrumb.length > 0 ? breadcrumb.join(' / ') : heading.description

  function isLeafActive(catSlug: string, subSlug: string, elSlug: string) {
    return (
      filters.category === catSlug && filters.subcategory === subSlug && filters.element === elSlug
    )
  }

  return (
    <aside className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="shrink-0 border-b border-chalk px-2 py-2">
        {sectionPickerVariant === 'select' ? (
          <label className="block">
            <span className="mb-1 block px-1 text-[11px] font-medium uppercase tracking-[0.05em] text-gravel">
              Consultar en
            </span>
            <select
              value={activeSection}
              onChange={(event) => onSectionChange(event.target.value as KbNavSection)}
              className="h-10 w-full rounded-md border border-chalk bg-white px-3 text-sm text-obsidian shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/20"
            >
              <option value="documentation">Información</option>
              <option value="services_incidents">Preguntas frecuentes</option>
            </select>
          </label>
        ) : (
          <div className="grid grid-cols-2 gap-1 rounded-md bg-eggshell p-1">
            <button
              type="button"
              onClick={() => onSectionChange('documentation')}
              className={cn(
                'h-9 rounded-md px-2 text-xs font-medium transition',
                activeSection === 'documentation'
                  ? 'bg-white text-obsidian shadow-sm'
                  : 'text-gravel hover:bg-white/70',
              )}
            >
              Información
            </button>
            <button
              type="button"
              onClick={() => onSectionChange('services_incidents')}
              className={cn(
                'h-9 rounded-md px-2 text-xs font-medium transition',
                activeSection === 'services_incidents'
                  ? 'bg-white text-obsidian shadow-sm'
                  : 'text-gravel hover:bg-white/70',
              )}
            >
              Preguntas frecuentes
            </button>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center border-b border-chalk px-2 py-3">
        <div className="min-w-0">
          <p className="m-0 truncate text-sm text-obsidian">{heading.title}</p>
          <p className="m-0 mt-0.5 line-clamp-2 text-xs text-gravel">{subtitle}</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 py-2">
        {visibleTaxonomy.length === 0 ? (
          <p className="m-0 rounded-md border border-dashed border-chalk bg-eggshell px-3 py-2 text-xs text-gravel">
            No hay categorías visibles para esta pestaña todavía.
          </p>
        ) : null}
        {visibleTaxonomy.map((cat) => (
          <details key={cat.slug} className="mb-2 rounded-md border border-chalk bg-eggshell">
            <summary className="flex cursor-pointer list-none items-center justify-between px-2 py-2 text-sm text-obsidian [&::-webkit-details-marker]:hidden">
              <span className="truncate">{cat.name}</span>
              <span className="inline-flex items-center gap-1 text-xs text-gravel">
                {cat.count}
                <ChevronDown className="size-3.5" aria-hidden />
              </span>
            </summary>
            <div className="space-y-1 px-1 pb-2">
              {cat.subcategories.map((sub) => (
                <details key={`${cat.slug}-${sub.slug}`} className="rounded-md bg-white">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-2 py-1.5 text-xs text-cinder [&::-webkit-details-marker]:hidden">
                    <span className="truncate">{sub.name}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-gravel">
                      {sub.count}
                      <ChevronRight className="size-3" aria-hidden />
                    </span>
                  </summary>
                  <div className="grid gap-1 px-1 pb-2">
                    {sub.elements.map((el, elementIndex) => (
                      <button
                        key={`${cat.slug}-${sub.slug}-${el.slug}-${elementIndex}`}
                        type="button"
                        onClick={() =>
                          onLeafSelect({
                            category: cat.slug,
                            subcategory: sub.slug,
                            element: el.slug,
                          })
                        }
                        className={cn(
                          'flex min-h-8 w-full items-center justify-between rounded-md px-2 text-left text-xs transition',
                          isLeafActive(cat.slug, sub.slug, el.slug)
                            ? 'bg-obsidian text-eggshell'
                            : 'text-cinder hover:bg-powder',
                        )}
                      >
                        <span className="truncate">{el.name}</span>
                        <span className="ml-2 shrink-0 opacity-70">{el.count}</span>
                      </button>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </details>
        ))}
      </div>
    </aside>
  )
}
