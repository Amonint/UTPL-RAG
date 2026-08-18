'use client'

import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'

interface StatsResponse {
  stats: {
    domains: number
    categories: number
    subcategories: number
    elements: number
    items: number
    versions: number
    publishedItems: number
    draftItems: number
  }
  byDomain: Array<{ domainCode: string; domainName: string; itemCount: number }>
}

export function AdminDashboard() {
  const [data, setData] = useState<StatsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    const res = await fetch('/api/admin/stats')
    const body = await res.json()
    if (!res.ok) {
      setError(body.error ?? 'No se pudieron cargar las estadísticas. Recargue la página e intente de nuevo.')
      return
    }
    setData(body)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const runSearchReindex = async () => {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const res = await fetch('/api/admin/sync/search-index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize: 80 }),
      })
      const body = await res.json()
      if (!res.ok) {
        setSyncMessage(body.error ?? 'No se pudo actualizar la búsqueda. Intente de nuevo.')
        return
      }
      const remaining = body.remainingMissingEmbeddings ?? 0
      setSyncMessage(
        `Se actualizaron ${body.processed} entradas en la búsqueda. Quedan ${remaining} por procesar.` +
          (body.embeddingsConfigured ? '' : ' La búsqueda por significado aún no está disponible.'),
      )
    } catch {
      setSyncMessage('No se pudo conectar con el servidor. Intente de nuevo.')
    } finally {
      setSyncing(false)
    }
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        <p className="font-medium">{error}</p>
        {data?.stats.items === 0 && (
          <p className="mt-2">
            Si la base de datos está vacía, ejecute primero la carga institucional:{' '}
            <code className="rounded bg-white px-1">npm run etl:faq:xlsx</code>
          </p>
        )}
      </div>
    )
  }

  if (!data) {
    return <p className="text-sm text-gravel">Cargando estadísticas…</p>
  }

  const { stats } = data
  const empty = stats.items === 0

  return (
    <div className="flex flex-col gap-6">
      {empty ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          Aún no hay contenido publicado. Ejecute primero la carga institucional de preguntas frecuentes (
          <code className="rounded bg-white px-1">npm run etl:faq:xlsx</code>) o cree una entrada desde
          Administrar información.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Entradas', value: stats.items },
          { label: 'Publicados', value: stats.publishedItems },
          { label: 'En borrador', value: stats.draftItems },
          { label: 'Versiones', value: stats.versions },
          { label: 'Categorías', value: stats.categories },
          { label: 'Subcategorías', value: stats.subcategories },
          { label: 'Elementos', value: stats.elements },
          { label: 'Dominios', value: stats.domains },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border border-chalk bg-white p-4 shadow-sm">
            <p className="text-xs text-gravel">{card.label}</p>
            <p className="text-2xl font-medium text-obsidian">{card.value}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium text-obsidian">Entradas por área</h2>
        <ul className="divide-y divide-chalk rounded-lg border border-chalk bg-white">
          {data.byDomain.map((d) => (
            <li key={d.domainCode} className="flex justify-between px-4 py-2 text-sm">
              <span>{d.domainName}</span>
              <span className="text-gravel">{d.itemCount}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => void runSearchReindex()} disabled={syncing || empty}>
          {syncing ? 'Actualizando…' : 'Actualizar búsqueda'}
        </Button>
        <p className="text-xs text-gravel">
          La búsqueda por texto está siempre activa. La búsqueda por significado depende de la
          configuración del equipo técnico.
        </p>
        {syncMessage ? <p className="text-sm text-obsidian">{syncMessage}</p> : null}
      </section>
    </div>
  )
}
