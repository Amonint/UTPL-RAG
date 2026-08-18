import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Inter_Tight } from 'next/font/google'

import { SiteNavbar } from '@/components/site-navbar'

import './globals.css'

const interTight = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-inter-tight',
  weight: ['400', '500', '600'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Atenea',
  description: 'Base de conocimiento para asesores UTPL',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={interTight.variable}>
      <body className="flex h-dvh flex-col antialiased" suppressHydrationWarning>
        <SiteNavbar />
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
      </body>
    </html>
  )
}
