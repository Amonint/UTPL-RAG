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
  title: 'UTPL RAG',
  description: 'Herramientas y demo UTPL',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={interTight.variable}>
      <body className="min-h-screen antialiased">
        <SiteNavbar />
        {children}
      </body>
    </html>
  )
}
