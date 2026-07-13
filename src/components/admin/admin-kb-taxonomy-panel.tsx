'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { TAXONOMY_EMPTY_ELEMENT_HINT } from '@/lib/admin/ui-labels'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type TaxonomyElement = {
  id: string
  slug: string
  name: string
  itemCount: number
  isActive: boolean
}

type TaxonomySubcategory = {
  id: string
  slug: string
  name: string
  itemCount: number
  isActive: boolean
  elements: TaxonomyElement[]
}

type TaxonomyCategory = {
  id: string
  slug: string
  name: string
  itemCount: number
  isActive: boolean
  subcategories: TaxonomySubcategory[]
}

type TaxonomyDomain = {
  id: string
  code: string
  name: string
  itemCount: number
  categories: TaxonomyCategory[]
}

type TaxonomyResponse = { tree?: TaxonomyDomain[] }

export function AdminKbTaxonomyPanel() {
  const [tree, setTree] = useState<TaxonomyDomain[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [selectedDomainId, setSelectedDomainId] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState('')

  const [newCategoryName, setNewCategoryName] = useState('')
  const [newSubcategoryName, setNewSubcategoryName] = useState('')
  const [newElementName, setNewElementName] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/taxonomy')
      const body = (await res.json()) as TaxonomyResponse
      if (!res.ok) {
        setError((body as { error?: string }).error ?? 'No se pudo cargar el menú')
        return
      }
      const nextTree = body.tree ?? []
      setTree(nextTree)
      if (!selectedDomainId && nextTree[0]) setSelectedDomainId(nextTree[0].id)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo cargar el menú')
    } finally {
      setLoading(false)
    }
  }, [selectedDomainId])

  useEffect(() => {
    void load()
  }, [load])

  const selectedDomain = tree.find((d) => d.id === selectedDomainId) ?? null
  const selectedCategory =
    selectedDomain?.categories.find((c) => c.id === selectedCategoryId) ?? null
  const selectedSubcategory =
    selectedCategory?.subcategories.find((s) => s.id === selectedSubcategoryId) ?? null

  async function createCategory() {
    if (!selectedDomainId || !newCategoryName.trim()) return
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/taxonomy/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domainId: selectedDomainId, name: newCategoryName.trim() }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'No se pudo crear la categoría')
      setNewCategoryName('')
      setMessage('Categoría creada.')
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo crear la categoría')
    } finally {
      setSaving(false)
    }
  }

  async function createSubcategory() {
    if (!selectedCategoryId || !newSubcategoryName.trim()) return
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/taxonomy/subcategories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: selectedCategoryId, name: newSubcategoryName.trim() }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'No se pudo crear la subcategoría')
      setNewSubcategoryName('')
      setMessage('Subcategoría creada.')
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo crear la subcategoría')
    } finally {
      setSaving(false)
    }
  }

  async function createElement() {
    if (!selectedSubcategoryId || !newElementName.trim()) return
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/taxonomy/elements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subcategoryId: selectedSubcategoryId, name: newElementName.trim() }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'No se pudo crear el tema')
      setNewElementName('')
      setMessage('Tema creado. Publique contenido en Administrar información para que el asesor lo vea.')
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo crear el tema')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-obsidian">Organizar menú del asesor</h2>
          <p className="text-sm text-gravel">
            Cree categorías, subcategorías y temas. El asesor solo ve nodos con contenido publicado.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
          Actualizar
        </Button>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {message ? <p className="text-sm text-green-800">{message}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-lg border border-chalk bg-white p-4">
          <label className="mb-1 block text-xs font-medium text-gravel">Área</label>
          <select
            data-testid="taxonomy-domain"
            value={selectedDomainId}
            onChange={(e) => {
              setSelectedDomainId(e.target.value)
              setSelectedCategoryId('')
              setSelectedSubcategoryId('')
            }}
            className="mb-4 w-full rounded border border-chalk px-2 py-1.5 text-sm"
          >
            {tree.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <div className="flex flex-col gap-2">
            <Input
              data-testid="taxonomy-new-category"
              placeholder="Nueva categoría"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
            />
            <Button type="button" size="sm" disabled={saving} onClick={() => void createCategory()}>
              Agregar categoría
            </Button>
          </div>
        </aside>

        <div className="rounded-lg border border-chalk bg-white p-4">
          {loading ? (
            <p className="text-sm text-gravel">Cargando…</p>
          ) : !selectedDomain ? (
            <p className="text-sm text-gravel">Seleccione un área.</p>
          ) : selectedDomain.categories.length === 0 ? (
            <p className="text-sm text-gravel">No hay categorías en esta área.</p>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gravel">Categoría</label>
                <select
                  data-testid="taxonomy-category"
                  value={selectedCategoryId}
                  onChange={(e) => {
                    setSelectedCategoryId(e.target.value)
                    setSelectedSubcategoryId('')
                  }}
                  className="w-full rounded border border-chalk px-2 py-1.5 text-sm"
                >
                  <option value="">—</option>
                  {selectedDomain.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.itemCount})
                    </option>
                  ))}
                </select>
              </div>

              {selectedCategory ? (
                <>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      data-testid="taxonomy-new-subcategory"
                      placeholder="Nueva subcategoría"
                      value={newSubcategoryName}
                      onChange={(e) => setNewSubcategoryName(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={saving}
                      onClick={() => void createSubcategory()}
                    >
                      Agregar subcategoría
                    </Button>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-gravel">Subcategoría</label>
                    <select
                      data-testid="taxonomy-subcategory"
                      value={selectedSubcategoryId}
                      onChange={(e) => setSelectedSubcategoryId(e.target.value)}
                      className="w-full rounded border border-chalk px-2 py-1.5 text-sm"
                    >
                      <option value="">—</option>
                      {selectedCategory.subcategories.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.itemCount})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedSubcategory ? (
                    <>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          data-testid="taxonomy-new-element"
                          placeholder="Nuevo tema en el menú"
                          value={newElementName}
                          onChange={(e) => setNewElementName(e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={saving}
                          onClick={() => void createElement()}
                        >
                          Agregar tema
                        </Button>
                      </div>

                      <ul className="grid gap-2 text-sm">
                        {selectedSubcategory.elements.map((el) => (
                          <li
                            key={el.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded border border-chalk px-3 py-2"
                          >
                            <span className="text-obsidian">{el.name}</span>
                            <span className="text-xs text-gravel">
                              {el.itemCount > 0
                                ? `${el.itemCount} publicado(s)`
                                : TAXONOMY_EMPTY_ELEMENT_HINT}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-gravel">
        Después de crear la estructura, publique contenido en{' '}
        <Link href="/admin/items" className="underline">
          Administrar información y preguntas frecuentes
        </Link>
        .
      </p>
    </div>
  )
}
