'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  defaultContentTypeForSection,
  EDITORIAL_STATUS_FIELD_HINT,
  editorPageIntro,
  editorPageTitle,
  ADVISOR_MENU_PREVIEW_CAPTION,
  ADVISOR_VISIBILITY_HIDDEN_BANNER,
  advisorVisibilityBadgeClass,
  advisorVisibilityLabel,
  formatAdvisorMenuPreview,
  isVisibleToAdvisor,
  labelSection,
  newItemButtonLabel,
  type SectionCode,
} from '@/lib/admin/ui-labels'
import { AdminDocumentPeriodField } from '@/components/admin/admin-document-period-field'
import {
  labelSectionFromCatalog,
  resolveEditorialFormOptions,
  useAdminFilterCatalogs,
} from '@/hooks/use-admin-filter-catalogs'
import { decodeDocumentMeta } from '@/lib/admin/document-meta'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface TaxonomyTree {
  tree: Array<{
    id: string
    code: string
    name: string
    categories: Array<{
      id: string
      slug: string
      name: string
      isActive?: boolean
      subcategories: Array<{
        id: string
        slug: string
        name: string
        isActive?: boolean
        elements: Array<{ id: string; slug: string; name: string; isActive?: boolean }>
      }>
    }>
  }>
}

interface ItemDetail {
  id: string
  kbElementId: string
  domainId: string
  sectionCode: string
  contentType: string
  title: string | null
  editorialStatus: string
  validFrom: string | null
  validTo: string | null
  reviewPolicy: string | null
  latestVersion: {
    questionText: string | null
    answerText: string | null
    searchForms: string[]
    phrases: string[]
    synonyms: string[]
  } | null
  versions: Array<{ versionNumber: number; createdAt: string }>
}

function parseSectionParam(value: string | null): SectionCode | null {
  if (value === 'faq' || value === 'general_info') return value
  return null
}

export function AdminItemEditor({ itemId }: { itemId?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isNew = !itemId

  const [taxonomy, setTaxonomy] = useState<TaxonomyTree | null>(null)
  const [item, setItem] = useState<ItemDetail | null>(null)

  const [domainId, setDomainId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')
  const [elementId, setElementId] = useState('')

  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const { catalogs } = useAdminFilterCatalogs()
  const editorialFormOptions = resolveEditorialFormOptions(catalogs.editorialStatuses)

  const [sectionCode, setSectionCode] = useState<SectionCode>('faq')
  const [editorialStatus, setEditorialStatus] = useState('editorial_draft')
  const [questionText, setQuestionText] = useState('')
  const [answerText, setAnswerText] = useState('')
  const [periodLabel, setPeriodLabel] = useState('')
  const [validFrom, setValidFrom] = useState<string | null>(null)
  const [validTo, setValidTo] = useState<string | null>(null)
  const [responsibleName, setResponsibleName] = useState('')

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isDocumentation = sectionCode === 'general_info'

  useEffect(() => {
    void Promise.all([
      fetch('/api/admin/catalogs').then((r) => r.json()),
      fetch('/api/admin/taxonomy').then((r) => r.json()),
    ]).then(([catBody, taxBody]) => {
      setTaxonomy(taxBody)
      if (!isNew) return
      const domains = (catBody.domains ?? []) as Array<{ id: string; code?: string }>
      const preferred =
        domains.find((d) => d.code === 'academic') ??
        domains.find((d) => d.code && !/e2e|test/i.test(d.code)) ??
        domains[0]
      if (preferred) setDomainId(preferred.id)
    })
  }, [isNew])

  useEffect(() => {
    if (!isNew) return
    const section = parseSectionParam(searchParams.get('section'))
    if (!section) return
    setSectionCode(section)
  }, [isNew, searchParams])

  const loadItem = useCallback(async () => {
    if (!itemId) return
    setLoading(true)
    const res = await fetch(`/api/admin/items/${itemId}`)
    const body = await res.json()
    if (!res.ok) {
      setError(body.error ?? 'No se encontró el ítem')
      setLoading(false)
      return
    }
    const loaded = body.item as ItemDetail & {
      taxonomy: {
        categoryId: string
        subcategoryId: string
        elementId: string
      }
    }
    setItem(loaded)
    setDomainId(loaded.domainId)
    setCategoryId(loaded.taxonomy.categoryId)
    setSubcategoryId(loaded.taxonomy.subcategoryId)
    setElementId(loaded.kbElementId)
    setTitle(loaded.title ?? '')
    const section = loaded.sectionCode as SectionCode
    setSectionCode(section)
    setEditorialStatus(loaded.editorialStatus)
    setValidFrom(loaded.validFrom)
    setValidTo(loaded.validTo)
    setPeriodLabel(decodeDocumentMeta(loaded.reviewPolicy).periodLabel ?? '')
    if (loaded.latestVersion) {
      const q = loaded.latestVersion.questionText ?? ''
      if (section === 'general_info') {
        setSubtitle(q)
        setQuestionText('')
      } else {
        setQuestionText(q)
        setSubtitle('')
      }
      setAnswerText(loaded.latestVersion.answerText ?? '')
    }
    setLoading(false)
  }, [itemId])

  useEffect(() => {
    if (itemId) void loadItem()
  }, [itemId, loadItem])

  const selectedDomain = taxonomy?.tree.find((d) => d.id === domainId)
  const selectedCategory = selectedDomain?.categories.find((c) => c.id === categoryId)
  const selectedSubcategory = selectedCategory?.subcategories.find((s) => s.id === subcategoryId)
  const subcategoryElements = selectedSubcategory?.elements ?? []

  useEffect(() => {
    const elements = selectedSubcategory?.elements ?? []
    if (!selectedSubcategory) {
      setElementId('')
      return
    }
    // Menú de contribución: Dominio → Categoría → Subcategoría (ancla técnica "General").
    const general =
      elements.find((el) => el.slug === 'general') ??
      elements.find((el) => el.name.trim().toLowerCase() === 'general')
    if (general) {
      setElementId(general.id)
      return
    }
    if (elements.length === 1) {
      setElementId(elements[0].id)
      return
    }
    setElementId('')
  }, [subcategoryId, selectedSubcategory])

  const selectedElement = subcategoryElements.find((el) => el.id === elementId)

  const advisorMenuPreview = useMemo(
    () =>
      formatAdvisorMenuPreview(sectionCode, {
        category: selectedCategory?.name,
        subcategory: selectedSubcategory?.name,
        element: selectedElement?.name,
      }),
    [
      sectionCode,
      selectedCategory?.name,
      selectedSubcategory?.name,
      selectedElement?.name,
    ],
  )

  const missingApartado = Boolean(subcategoryId) && !elementId

  const ensureGeneralElement = async (subId: string): Promise<string | null> => {
    const existing =
      taxonomy?.tree
        .flatMap((d) => d.categories)
        .flatMap((c) => c.subcategories)
        .find((s) => s.id === subId)
        ?.elements.find((el) => el.slug === 'general' || el.name.trim().toLowerCase() === 'general')
    if (existing) return existing.id

    const res = await fetch('/api/admin/taxonomy/elements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subcategoryId: subId, name: 'General', slug: 'general' }),
    })
    const body = (await res.json()) as { id?: string; error?: string }
    if (!res.ok || !body.id) return null

    const taxRes = await fetch('/api/admin/taxonomy')
    const taxBody = await taxRes.json()
    setTaxonomy(taxBody)
    return body.id
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    setMessage(null)

    const resolvedTitle = title.trim() || (isDocumentation ? '' : questionText.trim())
    const versionQuestion = isDocumentation ? subtitle.trim() : questionText.trim()
    const versionPayload = {
      questionText: versionQuestion,
      answerText,
      searchForms: [] as string[],
      phrases: [] as string[],
      synonyms: [] as string[],
      changeSummary: 'Saved from admin',
    }
    const itemMeta = {
      editorialStatus,
      validFrom,
      validTo,
      periodLabel: isDocumentation ? periodLabel.trim() || undefined : undefined,
    }

    try {
      if (isNew) {
        if (!domainId || !categoryId || !subcategoryId) {
          setError('Seleccione dominio, categoría y subcategoría.')
          setSaving(false)
          return
        }
        let resolvedElementId = elementId
        if (!resolvedElementId) {
          resolvedElementId = (await ensureGeneralElement(subcategoryId)) ?? ''
        }
        if (!resolvedElementId) {
          setError('No se pudo preparar la ubicación en el menú. Intente de nuevo.')
          setSaving(false)
          return
        }
        if (isDocumentation && !resolvedTitle) {
          setError('Escriba un título para la información.')
          setSaving(false)
          return
        }
        if (!isDocumentation && !questionText.trim()) {
          setError('Escriba la pregunta.')
          setSaving(false)
          return
        }

        const res = await fetch('/api/admin/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kbElementId: resolvedElementId,
            domainId,
            title: resolvedTitle || questionText,
            sectionCode,
            contentType: defaultContentTypeForSection(sectionCode),
            ...itemMeta,
            questionText: versionPayload.questionText,
            answerText: versionPayload.answerText,
            searchForms: versionPayload.searchForms,
            phrases: versionPayload.phrases,
            synonyms: versionPayload.synonyms,
            responsibleName: responsibleName || undefined,
          }),
        })
        const body = await res.json()
        if (!res.ok) {
          setError(body.error ?? 'Error al crear')
          setSaving(false)
          return
        }
        router.push(`/admin/items/${body.id}`)
        return
      }

      const patchRes = await fetch(`/api/admin/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: resolvedTitle || questionText,
          ...itemMeta,
        }),
      })
      if (!patchRes.ok) {
        const body = await patchRes.json()
        setError(body.error ?? 'Error al actualizar metadatos')
        setSaving(false)
        return
      }

      const verRes = await fetch(`/api/admin/items/${itemId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(versionPayload),
      })
      const verBody = await verRes.json()
      if (!verRes.ok) {
        setError(verBody.error ?? 'Error al guardar versión')
        setSaving(false)
        return
      }

      setMessage('Guardado')
      void loadItem()
    } catch {
      setError('Error de red')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-gravel">Cargando entrada…</p>

  if (isNew && !parseSectionParam(searchParams.get('section'))) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-medium text-obsidian">Nueva entrada</h2>
        <p className="text-sm text-gravel">
          Elija qué tipo de contenido va a crear. La pestaña del asesor queda definida desde el
          inicio.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href="/admin/items/import">Cargar desde documento</Link>
          </Button>
          <Button asChild variant="default">
            <Link href="/admin/items/new?section=faq">Nueva pregunta frecuente</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/items/new?section=general_info">{newItemButtonLabel('general_info')}</Link>
          </Button>
        </div>
        <Link href="/admin/items" className="text-sm text-gravel underline">
          Volver a la lista
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gravel">
            {labelSectionFromCatalog(sectionCode, catalogs.sections)}
          </p>
          <h2 className="text-lg font-medium text-obsidian">{editorPageTitle(isNew, sectionCode)}</h2>
          <p className="text-sm text-gravel">{editorPageIntro(sectionCode)}</p>
        </div>
        <Link href="/admin/items" className="text-sm text-gravel underline">
          Volver a la lista
        </Link>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {message ? <p className="text-sm text-green-800">{message}</p> : null}

      {!isVisibleToAdvisor(editorialStatus) ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {ADVISOR_VISIBILITY_HIDDEN_BANNER}
        </p>
      ) : (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          <span className={advisorVisibilityBadgeClass(editorialStatus)}>
            {advisorVisibilityLabel(editorialStatus)}
          </span>
        </p>
      )}

      <div className="sticky top-0 z-10 rounded-lg border border-chalk bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
              <label htmlFor="editorial-status" className="shrink-0 text-xs font-medium text-gravel">
                Estado
              </label>
              <select
                id="editorial-status"
                data-testid="admin-editorial-status"
                value={editorialStatus}
                onChange={(e) => setEditorialStatus(e.target.value)}
                className="h-9 w-full max-w-xs rounded border border-chalk px-2 text-sm"
              >
                {editorialFormOptions.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs leading-relaxed text-gravel">{EDITORIAL_STATUS_FIELD_HINT}</p>
          </div>
          <Button
            type="button"
            data-testid="admin-save-item"
            disabled={saving}
            onClick={() => void save()}
            className="w-full shrink-0 sm:w-auto"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="flex flex-col gap-3 rounded-lg border border-chalk bg-white p-4">
          <p className="text-sm font-medium text-obsidian">Ubicación en el menú</p>

          <label className="text-xs font-medium text-gravel">Dominio</label>
          <select
            data-testid="admin-domain"
            value={domainId}
            onChange={(e) => {
              setDomainId(e.target.value)
              setCategoryId('')
              setSubcategoryId('')
              setElementId('')
            }}
            className="rounded border border-chalk px-2 py-1.5 text-sm"
            disabled={!isNew && Boolean(item)}
          >
            {taxonomy?.tree.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <label className="text-xs font-medium text-gravel">Categoría</label>
          <select
            data-testid="admin-category"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value)
              setSubcategoryId('')
              setElementId('')
            }}
            className="rounded border border-chalk px-2 py-1.5 text-sm"
            disabled={!isNew && Boolean(item)}
          >
            <option value="">—</option>
            {selectedDomain?.categories
              .filter((c) => c.isActive !== false)
              .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <label className="text-xs font-medium text-gravel">Subcategoría</label>
          <select
            data-testid="admin-subcategory"
            value={subcategoryId}
            onChange={(e) => {
              setSubcategoryId(e.target.value)
              setElementId('')
            }}
            className="rounded border border-chalk px-2 py-1.5 text-sm"
            disabled={!isNew && Boolean(item)}
          >
            <option value="">—</option>
            {selectedCategory?.subcategories
              .filter((s) => s.isActive !== false)
              .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {advisorMenuPreview ? (
            <div className="rounded-md bg-[#f7f6f4] px-2 py-2">
              <p className="text-xs font-medium text-gravel">{ADVISOR_MENU_PREVIEW_CAPTION}</p>
              <p className="mt-1 text-sm leading-snug text-obsidian">{advisorMenuPreview}</p>
            </div>
          ) : null}

          {missingApartado ? (
            <p className="text-xs text-amber-800">
              Falta el ancla de menú en esta subcategoría; se creará automáticamente al guardar.
            </p>
          ) : null}

          {!isNew && item ? (
            <div className="border-t border-chalk pt-2 text-xs text-gravel">
              <p>
                {item.versions.length}{' '}
                {item.versions.length === 1 ? 'versión guardada' : 'versiones guardadas'}
              </p>
            </div>
          ) : null}
        </aside>

        <div className="flex flex-col gap-4">
          {isDocumentation ? (
            <section className="flex flex-col gap-5 rounded-lg border border-chalk bg-white p-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gravel">Título</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej. Matrículas periodo abril–agosto 2026"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gravel">Subtítulo</label>
                <Input
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Línea breve que aparece bajo el título para el asesor"
                />
              </div>

              <AdminDocumentPeriodField
                periodLabel={periodLabel}
                validFrom={validFrom}
                validTo={validTo}
                onPeriodLabelChange={setPeriodLabel}
                onDatesChange={({ start, end }) => {
                  setValidFrom(start)
                  setValidTo(end)
                }}
              />

              <div>
                <label className="mb-1 block text-xs font-medium text-gravel">Contenido</label>
                <textarea
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  rows={14}
                  className="w-full rounded-md border border-chalk bg-white px-3 py-2 text-sm leading-relaxed"
                  placeholder="Información principal que verá el asesor"
                />
              </div>
            </section>
          ) : (
            <section className="rounded-lg border border-chalk bg-white p-4">
              <h3 className="mb-3 text-sm font-medium text-obsidian">Pregunta y respuesta</h3>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gravel">Título (opcional)</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Si lo deja vacío, se usará el texto de la pregunta"
                  />
                </div>

                {isNew ? (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gravel">
                      Responsable (opcional)
                    </label>
                    <Input
                      value={responsibleName}
                      onChange={(e) => setResponsibleName(e.target.value)}
                    />
                  </div>
                ) : null}

                <div>
                  <label className="mb-1 block text-xs font-medium text-gravel">Pregunta</label>
                  <textarea
                    data-testid="admin-question"
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-chalk bg-white px-3 py-2 text-sm"
                    placeholder="Redacte la pregunta tal como la buscaría un asesor"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gravel">Respuesta</label>
                  <textarea
                    data-testid="admin-answer"
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    rows={10}
                    className="w-full rounded-md border border-chalk bg-white px-3 py-2 text-sm leading-relaxed"
                    placeholder="Respuesta completa para el asesor"
                  />
                </div>
              </div>
            </section>
          )}

          <p className="rounded-md border border-chalk bg-[#f7f6f4] px-3 py-2 text-xs text-gravel">
            Las formas de búsqueda, frases relacionadas y sinónimos se generan automáticamente al
            guardar, en segundo plano. No hace falta escribirlas aquí.
          </p>
        </div>
      </div>
    </div>
  )
}
