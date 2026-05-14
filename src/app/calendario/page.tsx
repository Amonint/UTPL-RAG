import Link from 'next/link'

import { CalendarioClient } from './calendario-client'

export default function CalendarioPage() {
  return (
    <div className="min-h-screen bg-powder p-4 text-foreground md:p-8 dark:bg-zinc-900">
      <div className="mx-auto w-full max-w-none space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-chalk/60 pb-4 dark:border-white/10">
          <h1 className="text-2xl font-normal tracking-tight">Calendario académico UTPL</h1>
          <Link href="/" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            Volver al inicio
          </Link>
        </header>
        <CalendarioClient />
      </div>
    </div>
  )
}
