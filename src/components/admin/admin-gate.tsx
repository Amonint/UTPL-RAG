import Link from 'next/link'

import { isAdminEnabled } from '@/lib/admin/config'

export function AdminGate({ children }: { children: React.ReactNode }) {
  if (!isAdminEnabled()) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 p-8">
        <h1 className="text-xl font-medium text-obsidian">Panel deshabilitado</h1>
        <p className="text-sm text-gravel">
          Active el panel en el archivo de configuración del proyecto (
          <code className="rounded bg-chalk px-1">ADMIN_ENABLED=true</code> y conexión a la base de
          datos). La carga masiva inicial sigue haciéndose con el proceso institucional (ETL), no desde
          esta pantalla.
        </p>
        <Link href="/" className="text-sm text-obsidian underline">
          Ir al panel de asesores
        </Link>
      </div>
    )
  }

  return children
}
