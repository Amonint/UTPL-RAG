'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/admin/items', label: 'Administrar información y preguntas frecuentes' },
  { href: '/admin/organizacion-menu', label: 'Organizar menú del asesor' },
  { href: '/administracion-de-filtros', label: 'Administrar filtros' },
  { href: '/admin/calendar', label: 'Administrar calendario' },
] as const

export function AdminNav() {
  const pathname = usePathname()

  return (
    <header className="border-b border-chalk bg-white px-4 py-3 md:px-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gravel">Atenea</p>
          <h1 className="text-lg font-medium text-obsidian">Administración de contenido para asesores</h1>
        </div>
        <nav className="flex flex-wrap items-center gap-2">
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  active
                    ? 'rounded-md bg-obsidian px-3 py-1.5 text-sm text-white'
                    : 'rounded-md px-3 py-1.5 text-sm text-obsidian hover:bg-chalk'
                }
              >
                {link.label}
              </Link>
            )
          })}
          <Link href="/" className="rounded-md px-3 py-1.5 text-sm text-gravel hover:text-obsidian">
            Vista de asesor
          </Link>
        </nav>
      </div>
    </header>
  )
}
