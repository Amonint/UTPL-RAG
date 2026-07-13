'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type ContentKind = 'info' | 'faq' | 'calendar'

type TaxonomyElement = {
  id: string
  slug: string
  name: string
}

type TaxonomySubcategory = {
  id: string
  slug: string
  name: string
  isActive: boolean
  elements: TaxonomyElement[]
}

type TaxonomyCategory = {
  id: string
  slug: string
  name: string
  isActive: boolean
  subcategories: TaxonomySubcategory[]
}

type TaxonomyDomain = {
  id: string
  code: string
  name: string
  categories: TaxonomyCategory[]
}

type CatalogDomain = { id: string; code: string; name: string }
type CatalogProfileType = { id: string; profileCode: string; typeCode: string; name: string }
type CatalogStudentType = { id: string; code: string; name: string }
type CatalogCyclePeriod = {
  id: string
  code: string
  name: string
  startsOn: string | null
  endsOn: string | null
}
type CatalogSection = { code: string; name: string; hint?: string | null }

type PeriodOption = {
  id: string
  code: string
  name: string
  label: string
  validFrom: string
  validTo: string
}

const selectClass =
  'mt-1 w-full rounded-md border border-chalk bg-white px-3 py-2 text-sm text-obsidian disabled:opacity-50'
const labelClass = 'block text-sm font-medium text-obsidian'
const textareaClass =
  'mt-1 w-full rounded-md border border-chalk bg-white px-3 py-2 text-sm text-obsidian'

const SECTION_TO_KIND: Record<string, ContentKind> = {
  general_info: 'info',
  faq: 'faq',
}

/** Propósito de cada tipo (para quién/para qué sirve), no pasos de carga. */
const CARGAR_KIND_COPY: Record<ContentKind, { fallbackTitle: string; description: string }> = {
  faq: {
    fallbackTitle: 'Preguntas frecuentes',
    description:
      'Consultas habituales de estudiantes (trámites, servicios, incidencias) y sus respuestas, para que el asesor las tenga a mano.',
  },
  info: {
    fallbackTitle: 'Información',
    description:
      'Guías, avisos y material de consulta que el asesor usa para orientar con claridad sobre procesos y servicios UTPL.',
  },
  calendar: {
    fallbackTitle: 'Calendario',
    description:
      'Fechas clave del periodo académico (matrículas, evaluaciones, plazos) según modalidad, área y tipo de estudiante.',
  },
}

export function CargarContent() {
  const [kind, setKind] = useState<ContentKind | null>(null)
  const [sections, setSections] = useState<CatalogSection[]>([])
  const [loadingKinds, setLoadingKinds] = useState(true)
  const [kindsError, setKindsError] = useState<string | null>(null)

  useEffect(() => {
    setLoadingKinds(true)
    setKindsError(null)
    fetch('/api/advisor/catalogs')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('No se pudieron cargar las secciones'))))
      .then((data: { sections?: CatalogSection[] }) => {
        setSections(data.sections ?? [])
      })
      .catch((err: unknown) => {
        setKindsError(err instanceof Error ? err.message : 'No se pudieron cargar las secciones')
      })
      .finally(() => setLoadingKinds(false))
  }, [])

  const kindCards = useMemo(() => {
    const fromSections = sections
      .map((section) => {
        const mapped = SECTION_TO_KIND[section.code]
        if (!mapped) return null
        const copy = CARGAR_KIND_COPY[mapped]
        return {
          kind: mapped,
          title: section.name.trim() || copy.fallbackTitle,
          description: copy.description,
        }
      })
      .filter((c): c is { kind: ContentKind; title: string; description: string } => c != null)

    return [
      ...fromSections,
      {
        kind: 'calendar' as const,
        title: CARGAR_KIND_COPY.calendar.fallbackTitle,
        description: CARGAR_KIND_COPY.calendar.description,
      },
    ]
  }, [sections])

  const currentTitle = kindCards.find((c) => c.kind === kind)?.title ?? 'Cargar contenido'

  if (!kind) {
    return (
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-medium tracking-tight text-obsidian">Cargar contenido</h1>
          <p className="max-w-2xl text-sm text-gravel">
            Elija el tipo de contenido. Quedará en estado <strong>En revisión</strong> hasta que
            administración lo publique.
          </p>
        </header>

        {kindsError ? (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{kindsError}</div>
        ) : null}

        {loadingKinds ? (
          <p className="text-sm text-gravel">Cargando tipos de contenido…</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {kindCards.map((card) => (
              <button
                key={card.kind}
                type="button"
                onClick={() => setKind(card.kind)}
                className="rounded-lg border border-chalk bg-white p-5 text-left shadow-sm transition hover:border-[#003978]/40 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003978]"
              >
                <h2 className="text-base font-medium text-obsidian">{card.title}</h2>
                <p className="mt-2 text-sm text-gravel">{card.description}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-medium tracking-tight text-obsidian">{currentTitle}</h1>
        <Button type="button" variant="outline" onClick={() => setKind(null)}>
          Cargar otro contenido
        </Button>
      </div>

      {kind === 'info' ? <KnowledgeForm sectionCode="general_info" /> : null}
      {kind === 'faq' ? <KnowledgeForm sectionCode="faq" /> : null}
      {kind === 'calendar' ? <CalendarForm /> : null}
    </div>
  )
}

function KnowledgeForm({ sectionCode }: { sectionCode: 'faq' | 'general_info' }) {
  const isFaq = sectionCode === 'faq'
  const [taxonomy, setTaxonomy] = useState<TaxonomyDomain[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [domainId, setDomainId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')
  const [title, setTitle] = useState('')
  const [questionText, setQuestionText] = useState('')
  const [answerText, setAnswerText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/advisor/taxonomy?section=${sectionCode}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('No se pudo cargar la taxonomía'))))
      .then((data: { tree?: TaxonomyDomain[] }) => setTaxonomy(data.tree ?? []))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'No se pudo cargar la taxonomía')
      })
      .finally(() => setLoading(false))
  }, [sectionCode])

  const selectedDomain = taxonomy?.find((d) => d.id === domainId)
  const categories = selectedDomain?.categories.filter((c) => c.isActive) ?? []
  const selectedCategory = categories.find((c) => c.id === categoryId)
  const subcategories = selectedCategory?.subcategories.filter((s) => s.isActive) ?? []

  const canSubmit =
    Boolean(domainId && categoryId && subcategoryId && answerText.trim().length >= 10) &&
    (isFaq ? questionText.trim().length >= 10 : title.trim().length >= 1) &&
    !saving

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/advisor/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionCode,
          domainId,
          subcategoryId,
          title: isFaq ? undefined : title.trim(),
          questionText: isFaq ? questionText.trim() : '',
          answerText: answerText.trim(),
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'No se pudo guardar')
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="text-lg font-medium text-obsidian">Enviado a revisión</p>
        <p className="mt-2 text-sm text-gravel">
          El contenido quedó en estado <strong>En revisión</strong>. Administración podrá publicarlo
          cuando corresponda.
        </p>
        <Button type="button" className="mt-4" onClick={() => window.location.reload()}>
          Cargar otro contenido
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="max-w-2xl space-y-4 rounded-lg border border-chalk bg-white p-5">
      {error ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <p className="text-sm text-gravel">Cargando ubicaciones del menú…</p>
      ) : (
        <>
          <fieldset className="space-y-3">
            <legend className="text-xs font-medium uppercase tracking-wide text-gravel">
              Ubicación en el menú
            </legend>

            <div>
              <label htmlFor="domain" className={labelClass}>
                Dominio
              </label>
              <select
                id="domain"
                className={selectClass}
                value={domainId}
                onChange={(e) => {
                  setDomainId(e.target.value)
                  setCategoryId('')
                  setSubcategoryId('')
                }}
                required
              >
                <option value="">Seleccione un dominio</option>
                {taxonomy?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="category" className={labelClass}>
                Categoría
              </label>
              <select
                id="category"
                className={selectClass}
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value)
                  setSubcategoryId('')
                }}
                disabled={!domainId}
                required
              >
                <option value="">Seleccione una categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="subcategory" className={labelClass}>
                Subcategoría
              </label>
              <select
                id="subcategory"
                className={selectClass}
                value={subcategoryId}
                onChange={(e) => setSubcategoryId(e.target.value)}
                disabled={!categoryId}
                required
              >
                <option value="">Seleccione una subcategoría</option>
                {subcategories.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </fieldset>

          {isFaq ? (
            <>
              <div>
                <label htmlFor="question" className={labelClass}>
                  Pregunta
                </label>
                <textarea
                  id="question"
                  className={textareaClass}
                  rows={3}
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="Escriba la pregunta"
                  required
                />
              </div>
              <div>
                <label htmlFor="answer" className={labelClass}>
                  Respuesta
                </label>
                <textarea
                  id="answer"
                  className={textareaClass}
                  rows={5}
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="Escriba la respuesta"
                  required
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="title" className={labelClass}>
                  Título
                </label>
                <Input
                  id="title"
                  className="mt-1"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Título de la información"
                  required
                />
              </div>
              <div>
                <label htmlFor="content" className={labelClass}>
                  Contenido
                </label>
                <textarea
                  id="content"
                  className={textareaClass}
                  rows={8}
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="Escriba el contenido"
                  required
                />
              </div>
            </>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        <Button type="submit" disabled={!canSubmit || loading}>
          {saving ? 'Enviando…' : 'Enviar a revisión'}
        </Button>
      </div>
    </form>
  )
}

function CalendarForm() {
  const [domains, setDomains] = useState<CatalogDomain[]>([])
  const [profileTypes, setProfileTypes] = useState<CatalogProfileType[]>([])
  const [studentTypes, setStudentTypes] = useState<CatalogStudentType[]>([])
  const [cyclePeriods, setCyclePeriods] = useState<CatalogCyclePeriod[]>([])
  const [eventCategories, setEventCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [eventType, setEventType] = useState('')
  const [startsOn, setStartsOn] = useState('')
  const [endsOn, setEndsOn] = useState('')
  const [domainCode, setDomainCode] = useState('')
  const [profileTypeCode, setProfileTypeCode] = useState('')
  const [studentTypeCode, setStudentTypeCode] = useState('')
  const [periodSelect, setPeriodSelect] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const studentModalities = useMemo(
    () => profileTypes.filter((p) => p.profileCode === 'student'),
    [profileTypes],
  )

  const periodOptions = useMemo((): PeriodOption[] => {
    return cyclePeriods
      .filter((p) => p.startsOn && p.endsOn)
      .map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        label: `${p.code} — ${p.name}`,
        validFrom: p.startsOn!,
        validTo: p.endsOn!,
      }))
      .sort((a, b) => a.code.localeCompare(b.code, 'es'))
  }, [cyclePeriods])

  const selectedPeriod = periodOptions.find((p) => p.id === periodSelect)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch('/api/advisor/catalogs')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('No se pudieron cargar los catálogos'))))
      .then(
        (data: {
          domains?: CatalogDomain[]
          profileTypes?: CatalogProfileType[]
          studentTypes?: CatalogStudentType[]
          cyclePeriods?: CatalogCyclePeriod[]
          eventCategories?: string[]
        }) => {
          const categories = data.eventCategories ?? []
          setDomains(data.domains ?? [])
          setProfileTypes(data.profileTypes ?? [])
          setStudentTypes(data.studentTypes ?? [])
          setCyclePeriods(data.cyclePeriods ?? [])
          setEventCategories(categories)
          setEventType((prev) => prev || categories[0] || '')
        },
      )
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar los catálogos')
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const preset = periodOptions.find((p) => p.id === periodSelect)
    if (!preset) {
      setError('Elija un periodo del listado.')
      setSaving(false)
      return
    }
    if (!eventType.trim()) {
      setError('Elija una categoría de evento.')
      setSaving(false)
      return
    }

    try {
      const res = await fetch('/api/advisor/calendar-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          eventType,
          startsOn,
          endsOn,
          scope: {
            domainCode: domainCode.trim(),
            profileTypeCode: profileTypeCode.trim(),
            studentTypeCode: studentTypeCode.trim(),
            periodLabel: preset.name,
            periodCode: preset.code,
            periodValidFrom: preset.validFrom,
            periodValidTo: preset.validTo,
          },
        }),
      })
      const data = (await res.json()) as { error?: string; adminPath?: string }
      if (!res.ok) throw new Error(data.error ?? 'No se pudo crear el evento')
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el evento')
    } finally {
      setSaving(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="text-lg font-medium text-obsidian">Enviado a revisión</p>
        <p className="mt-2 text-sm text-gravel">
          El evento quedó pendiente de validación. Administración puede revisarlo y publicarlo en{' '}
          <Link href="/admin/calendar" className="font-medium text-[#003978] underline-offset-4 hover:underline">
            Administrar calendario
          </Link>
          .
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button type="button" asChild>
            <Link href="/admin/calendar">Ir a administrar calendario</Link>
          </Button>
          <Button type="button" variant="outline" onClick={() => window.location.reload()}>
            Cargar otro contenido
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="max-w-2xl space-y-4 rounded-lg border border-chalk bg-white p-5"
    >
      {error ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <p className="text-sm text-gravel">Cargando catálogos…</p>
      ) : (
        <>
          <fieldset className="space-y-3">
            <legend className="text-xs font-medium uppercase tracking-wide text-gravel">
              Alcance
            </legend>

            <div>
              <label htmlFor="cal-domain" className={labelClass}>
                Área
              </label>
              <select
                id="cal-domain"
                className={selectClass}
                value={domainCode}
                onChange={(e) => setDomainCode(e.target.value)}
                required
              >
                <option value="">Seleccione un área</option>
                {domains.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="cal-modality" className={labelClass}>
                Modalidad
              </label>
              <select
                id="cal-modality"
                className={selectClass}
                value={profileTypeCode}
                onChange={(e) => setProfileTypeCode(e.target.value)}
                required
              >
                <option value="">Seleccione una modalidad</option>
                {studentModalities.map((m) => (
                  <option key={m.typeCode} value={m.typeCode}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="cal-student" className={labelClass}>
                Tipo de estudiante
              </label>
              <select
                id="cal-student"
                className={selectClass}
                value={studentTypeCode}
                onChange={(e) => setStudentTypeCode(e.target.value)}
                required
              >
                <option value="">Seleccione un tipo</option>
                {studentTypes.map((st) => (
                  <option key={st.code} value={st.code}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="cal-period" className={labelClass}>
                Periodo
              </label>
              <select
                id="cal-period"
                className={selectClass}
                value={periodSelect}
                onChange={(e) => setPeriodSelect(e.target.value)}
                required
              >
                <option value="">Seleccione un periodo</option>
                {periodOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              {periodOptions.length === 0 ? (
                <p className="mt-1 text-xs text-red-700">
                  No hay periodos activos en la base de datos.
                </p>
              ) : null}
              {selectedPeriod ? (
                <p className="mt-1 text-xs text-gravel">
                  Vigencia: {selectedPeriod.validFrom} — {selectedPeriod.validTo}
                </p>
              ) : null}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-xs font-medium uppercase tracking-wide text-gravel">
              Evento
            </legend>

            <div>
              <label htmlFor="cal-title" className={labelClass}>
                Título
              </label>
              <Input
                id="cal-title"
                className="mt-1"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título del evento"
                required
              />
            </div>

            <div>
              <label htmlFor="cal-type" className={labelClass}>
                Categoría
              </label>
              <select
                id="cal-type"
                className={selectClass}
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                required
              >
                <option value="">Seleccione una categoría</option>
                {eventCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              {eventCategories.length === 0 ? (
                <p className="mt-1 text-xs text-red-700">
                  No hay categorías de evento en la base de datos.
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="cal-start" className={labelClass}>
                  Inicio
                </label>
                <Input
                  id="cal-start"
                  type="date"
                  className="mt-1"
                  value={startsOn}
                  onChange={(e) => setStartsOn(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="cal-end" className={labelClass}>
                  Fin
                </label>
                <Input
                  id="cal-end"
                  type="date"
                  className="mt-1"
                  value={endsOn}
                  onChange={(e) => setEndsOn(e.target.value)}
                  required
                />
              </div>
            </div>
          </fieldset>
        </>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        <Button type="submit" disabled={saving || loading || periodOptions.length === 0 || !eventType}>
          {saving ? 'Guardando…' : 'Guardar evento'}
        </Button>
      </div>
    </form>
  )
}
