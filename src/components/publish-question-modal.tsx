'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type AdminTaxonomyElement = {
  id: string
  slug: string
  name: string
  itemCount: number
}

type AdminTaxonomySubcategory = {
  id: string
  slug: string
  name: string
  itemCount: number
  isActive: boolean
  elements: AdminTaxonomyElement[]
}

type AdminTaxonomyCategory = {
  id: string
  slug: string
  name: string
  itemCount: number
  isActive: boolean
  subcategories: AdminTaxonomySubcategory[]
}

type AdminTaxonomyDomain = {
  id: string
  code: string
  name: string
  itemCount: number
  categories: AdminTaxonomyCategory[]
}

interface PublishQuestionModalProps {
  open: boolean
  onClose: () => void
}

export function PublishQuestionModal({ open, onClose }: PublishQuestionModalProps) {
  const [domainId, setDomainId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')
  const [elementId, setElementId] = useState('')
  const [title, setTitle] = useState('')
  const [questionBody, setQuestionBody] = useState('')
  const [answer, setAnswer] = useState('')
  const [taxonomy, setTaxonomy] = useState<AdminTaxonomyDomain[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!open) return

    setLoading(true)
    setError(null)
    fetch('/api/admin/taxonomy')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to load taxonomy'))))
      .then((data) => {
        setTaxonomy(data.tree ?? [])
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'No se pudo cargar dominios')
      })
      .finally(() => setLoading(false))
  }, [open])

  // Derivar opciones disponibles
  const selectedDomain = taxonomy?.find((d) => d.id === domainId)
  const categories = selectedDomain?.categories ?? []

  const selectedCategory = categories.find((c) => c.id === categoryId)
  const subcategories = selectedCategory?.subcategories ?? []

  const selectedSub = subcategories.find((s) => s.id === subcategoryId)
  const elements = selectedSub?.elements ?? []

  // Auto-select element cuando hay solo uno
  useEffect(() => {
    if (elements.length === 1 && !elementId) {
      setElementId(elements[0].id)
    } else if (elements.length !== 1) {
      setElementId('')
    }
  }, [elements, elementId])

  // Reset cascada
  const handleDomainChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDomainId(e.target.value)
    setCategoryId('')
    setSubcategoryId('')
    setElementId('')
  }

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategoryId(e.target.value)
    setSubcategoryId('')
    setElementId('')
  }

  const handleSubcategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSubcategoryId(e.target.value)
    setElementId('')
  }

  // Validaciones
  const titleError =
    title.trim().length > 0 && title.trim().length < 10 ? 'Mínimo 10 caracteres' : null
  const questionBodyError =
    questionBody.trim().length > 0 && questionBody.trim().length < 20
      ? 'Mínimo 20 caracteres'
      : null
  const answerError =
    answer.trim().length > 0 && answer.trim().length < 20 ? 'Mínimo 20 caracteres' : null

  const canSubmit =
    domainId &&
    categoryId &&
    subcategoryId &&
    elementId &&
    title.trim().length >= 10 &&
    questionBody.trim().length >= 20 &&
    answer.trim().length >= 20 &&
    !saving

  async function handleSubmit() {
    if (!canSubmit) return

    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/advisor/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domainId,
          elementId,
          title: title.trim(),
          questionBody: questionBody.trim(),
          answer: answer.trim(),
        }),
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? 'Error al publicar pregunta')
      }

      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        setDomainId('')
        setCategoryId('')
        setSubcategoryId('')
        setElementId('')
        setTitle('')
        setQuestionBody('')
        setAnswer('')
        onClose()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al publicar pregunta')
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    if (!saving && !success) {
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto sm:w-full">
        {success ? (
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            <div className="text-4xl">✓</div>
            <p className="text-center text-lg font-medium text-obsidian">
              ¡Pregunta publicada! Está en revisión.
            </p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Publicar pregunta</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {error ? (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
              ) : null}

              {loading ? (
                <div className="text-center text-sm text-gravel">Cargando dominios...</div>
              ) : (
                <>
                  {/* Dominio */}
                  <div>
                    <label htmlFor="domain" className="block text-sm font-medium text-obsidian">
                      Dominio
                    </label>
                    <select
                      id="domain"
                      value={domainId}
                      onChange={handleDomainChange}
                      className="mt-1 w-full rounded-md border border-chalk bg-white px-3 py-2 text-sm text-obsidian"
                    >
                      <option value="">Selecciona un dominio</option>
                      {taxonomy?.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Categoría */}
                  <div>
                    <label htmlFor="category" className="block text-sm font-medium text-obsidian">
                      Categoría
                    </label>
                    <select
                      id="category"
                      value={categoryId}
                      onChange={handleCategoryChange}
                      disabled={!domainId}
                      className="mt-1 w-full rounded-md border border-chalk bg-white px-3 py-2 text-sm text-obsidian disabled:opacity-50"
                    >
                      <option value="">Selecciona una categoría</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Subcategoría */}
                  <div>
                    <label
                      htmlFor="subcategory"
                      className="block text-sm font-medium text-obsidian"
                    >
                      Subcategoría
                    </label>
                    <select
                      id="subcategory"
                      value={subcategoryId}
                      onChange={handleSubcategoryChange}
                      disabled={!categoryId}
                      className="mt-1 w-full rounded-md border border-chalk bg-white px-3 py-2 text-sm text-obsidian disabled:opacity-50"
                    >
                      <option value="">Selecciona una subcategoría</option>
                      {subcategories.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Elemento (solo si hay múltiples) */}
                  {elements.length > 1 ? (
                    <div>
                      <label htmlFor="element" className="block text-sm font-medium text-obsidian">
                        Elemento
                      </label>
                      <select
                        id="element"
                        value={elementId}
                        onChange={(e) => setElementId(e.target.value)}
                        disabled={!subcategoryId}
                        className="mt-1 w-full rounded-md border border-chalk bg-white px-3 py-2 text-sm text-obsidian disabled:opacity-50"
                      >
                        <option value="">Selecciona un elemento</option>
                        {elements.map((el) => (
                          <option key={el.id} value={el.id}>
                            {el.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  {/* Título */}
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-obsidian">
                      Título de la pregunta
                    </label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Escribe el título de la pregunta"
                      className="mt-1"
                    />
                    {titleError ? (
                      <p className="mt-1 text-xs text-red-700">{titleError}</p>
                    ) : null}
                  </div>

                  {/* Cuerpo de la pregunta */}
                  <div>
                    <label htmlFor="body" className="block text-sm font-medium text-obsidian">
                      Cuerpo de la pregunta
                    </label>
                    <textarea
                      id="body"
                      value={questionBody}
                      onChange={(e) => setQuestionBody(e.target.value)}
                      placeholder="Escribe los detalles de la pregunta"
                      rows={3}
                      className="mt-1 w-full rounded-md border border-chalk px-3 py-2 text-sm text-obsidian"
                    />
                    {questionBodyError ? (
                      <p className="mt-1 text-xs text-red-700">{questionBodyError}</p>
                    ) : null}
                  </div>

                  {/* Respuesta */}
                  <div>
                    <label htmlFor="answer" className="block text-sm font-medium text-obsidian">
                      Respuesta
                    </label>
                    <textarea
                      id="answer"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Escribe la respuesta"
                      rows={3}
                      className="mt-1 w-full rounded-md border border-chalk px-3 py-2 text-sm text-obsidian"
                    />
                    {answerError ? (
                      <p className="mt-1 text-xs text-red-700">{answerError}</p>
                    ) : null}
                  </div>
                </>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="bg-obsidian text-white hover:bg-obsidian/90"
              >
                {saving ? 'Publicando...' : 'Publicar'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
