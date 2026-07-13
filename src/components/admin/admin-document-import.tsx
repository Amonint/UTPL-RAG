'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'

type ImportWarning = {
  index: number
  reason: string
}

type ImportCreated = {
  id: string
  sectionCode: 'faq' | 'general_info'
  title: string
}

type ImportResult = {
  processedBlocks: number
  createdCount: number
  skippedCount: number
  created: ImportCreated[]
  warnings: ImportWarning[]
}

export function AdminDocumentImport() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  const canSubmit = useMemo(() => Boolean(file) && !loading, [file, loading])

  const onSubmit = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const formData = new FormData()
      formData.set('file', file)
      const res = await fetch('/api/admin/items/import-document', {
        method: 'POST',
        body: formData,
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? 'No se pudo procesar el documento.')
        return
      }
      setResult(body as ImportResult)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo procesar el documento.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-medium text-obsidian">Cargar desde documento</h2>
          <p className="text-sm text-gravel">
            Suba un PDF para autocompletar contenido con Gemini. Todo se guarda en estado En revisión.
          </p>
        </div>
        <Link href="/admin/items" className="text-sm text-gravel underline">
          Volver a la lista
        </Link>
      </div>

      <section className="rounded-lg border border-chalk bg-white p-4">
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gravel">Documento PDF</label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(event) => {
                const picked = event.target.files?.[0] ?? null
                setFile(picked)
              }}
              className="block w-full rounded border border-chalk px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-gravel">
              El sistema clasificará el contenido en Preguntas frecuentes o Información.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" onClick={() => void onSubmit()} disabled={!canSubmit}>
              {loading ? 'Procesando…' : 'Procesar documento'}
            </Button>
          </div>
        </div>
      </section>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {result ? (
        <section className="rounded-lg border border-chalk bg-white p-4">
          <h3 className="text-sm font-medium text-obsidian">Resultado de la carga</h3>
          <div className="mt-2 grid gap-2 text-sm text-gravel sm:grid-cols-3">
            <p>Bloques analizados: {result.processedBlocks}</p>
            <p>Entradas creadas: {result.createdCount}</p>
            <p>Bloques omitidos: {result.skippedCount}</p>
          </div>

          {result.created.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-medium text-gravel">Entradas creadas</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-obsidian">
                {result.created.map((row) => (
                  <li key={row.id}>
                    [{row.sectionCode === 'faq' ? 'FAQ' : 'Información'}]{' '}
                    <Link href={`/admin/items/${row.id}`} className="underline">
                      {row.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.warnings.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-medium text-amber-800">Advertencias</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-amber-900">
                {result.warnings.map((warning) => (
                  <li key={`${warning.index}-${warning.reason}`}>
                    Bloque #{warning.index}: {warning.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
