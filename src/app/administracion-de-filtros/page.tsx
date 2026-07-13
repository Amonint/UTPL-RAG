import { AdminCatalogSettings } from '@/components/admin/admin-catalog-settings'
import { AdminGate } from '@/components/admin/admin-gate'
import { AdminNav } from '@/components/admin/admin-nav'

export default function AdminFilterManagementPage() {
  return (
    <AdminGate>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f7f6f4]">
        <AdminNav />
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium text-obsidian">Administrar filtros</h2>
                <p className="text-sm text-gravel">
                  Cree, edite o desactive filtros para organizar la información de asesores.
                </p>
              </div>
            </div>
            <AdminCatalogSettings />
          </div>
        </div>
      </div>
    </AdminGate>
  )
}
