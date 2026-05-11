import Link from 'next/link'

import { CalendarioClient } from './calendario-client'

export default function CalendarioPage() {
  return (
    <div className="min-h-screen bg-background p-4 text-foreground md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
          <h1 className="text-2xl font-semibold tracking-tight">Calendario académico UTPL</h1>
          <Link href="/" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            Volver al inicio
          </Link>
        </header>
        <CalendarioClient />
      </div>
    </div>
  )
}
