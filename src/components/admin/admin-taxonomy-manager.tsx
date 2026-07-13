'use client'

import { AdminCatalogSettings } from '@/components/admin/admin-catalog-settings'

export function AdminTaxonomyManager() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-xl font-medium tracking-tight text-obsidian">Administrar filtros</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-gravel">
          Cree o edite los filtros del listado de información: secciones, áreas, modalidades, tipos de
          estudiante, estados editoriales y periodos académicos.
        </p>
      </header>

      <div className="rounded-2xl border border-chalk bg-white p-4 shadow-sm sm:p-6">
        <AdminCatalogSettings />
      </div>
    </div>
  )
}
