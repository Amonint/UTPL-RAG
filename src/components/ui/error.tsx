import type { ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'

import { cn } from '@/lib/utils'

export function Error({
  children,
  size = 'medium',
  className,
}: {
  children?: ReactNode
  size?: 'small' | 'medium' | 'large'
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 font-sans text-red-900',
        size === 'small' && 'text-[13px]',
        size === 'medium' && 'text-sm',
        size === 'large' && 'text-base',
        className,
      )}
    >
      <AlertCircle className="h-4 w-4 shrink-0" />
      {children}
    </div>
  )
}
