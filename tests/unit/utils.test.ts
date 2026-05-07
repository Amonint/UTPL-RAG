import { describe, expect, it } from 'vitest'

import { cn } from '@/lib/utils'

describe('cn', () => {
  it('merges Tailwind class conflicts predictably', () => {
    expect(cn('px-2', 'px-4', 'text-sm')).toBe('px-4 text-sm')
  })

  it('handles clsx-style arrays, objects, and falsy values', () => {
    expect(
      cn(
        'flex',
        ['items-center', false && 'hidden'],
        {
          'font-medium': true,
          hidden: false,
        },
        null,
        undefined,
        0 && 'opacity-0',
      ),
    ).toBe('flex items-center font-medium')
  })
})
