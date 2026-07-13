import type { ReactNode } from 'react'

import { AdminGate } from '@/components/admin/admin-gate'
import { AdminNav } from '@/components/admin/admin-nav'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminGate>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f7f6f4]">
        <AdminNav />
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="mx-auto max-w-6xl p-4 md:p-6">{children}</div>
        </div>
      </div>
    </AdminGate>
  )
}
