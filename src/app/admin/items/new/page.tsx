import { Suspense } from 'react'

import { AdminItemEditor } from '@/components/admin/admin-item-editor'

export default function AdminNewItemPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-gravel">Cargando editor…</p>}>
      <AdminItemEditor />
    </Suspense>
  )
}
