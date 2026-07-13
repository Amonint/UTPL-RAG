'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const quickLinks = [{ label: 'Correo', href: 'https://utpl.edu.ec/mail' }] as const

function isCargarRoute(pathname: string | null): boolean {
  if (!pathname) return false
  const normalized = pathname.replace(/\/+$/, '') || '/'
  return normalized === '/cargar'
}

export function SiteNavbar() {
  const pathname = usePathname()
  const hideQuickNav = isCargarRoute(pathname)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#003978] pt-[max(0.5rem,env(safe-area-inset-top))] text-white shadow-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pb-4 pt-3 md:gap-4 md:px-6 md:pb-5 md:pt-4">
        <Link href="/" className="shrink-0 py-0.5">
          <Image
            src="/utpl-nav-logo.png"
            alt="Logo UTPL"
            width={255}
            height={80}
            className="h-9 w-auto md:h-10"
            priority
          />
        </Link>

        {!hideQuickNav && (
          <div className="flex min-w-0 flex-1 items-center justify-end gap-3 sm:gap-4">
            <div className="flex items-center gap-x-3 text-xs text-white/85 sm:gap-4 sm:text-sm">
              {quickLinks.map((q) => (
                <a
                  key={q.href}
                  href={q.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="whitespace-nowrap hover:text-white"
                >
                  {q.label}
                </a>
              ))}
            </div>

            <Link
              href="/cargar"
              className="inline-flex items-center rounded border border-white/35 bg-white/10 px-3 py-2 text-left text-sm font-normal text-white transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <span className="hidden sm:inline">Cargar contenido</span>
              <span className="sm:hidden">Cargar</span>
            </Link>

            <Link
              href="/calendario"
              className="inline-flex items-center rounded border border-white/35 bg-white/10 px-3 py-2 text-left text-sm font-normal text-white transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <span className="hidden sm:inline">Calendario académico</span>
              <span className="sm:hidden">Calendario</span>
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}
