'use client'

import { ChevronDown } from 'lucide-react'
import clsx from 'clsx'

import { Error } from '@/components/ui/error'

const sizes = {
  xsmall: 'h-6 text-xs pl-1.5 pr-7',
  small: 'h-8 text-sm pl-3 pr-9',
  medium: 'h-10 text-sm pl-3 pr-9',
  large: 'h-12 text-base pl-3 pr-9 rounded-lg',
}

export interface Option {
  value: string
  label: string
}

interface SelectProps {
  variant?: 'default' | 'ghost'
  options?: Option[]
  label?: string
  value?: string
  placeholder?: string
  size?: keyof typeof sizes
  disabled?: boolean
  error?: string
  onChange?: React.ChangeEventHandler<HTMLSelectElement>
}

export const Select = ({
  variant = 'default',
  options,
  label,
  value,
  size = 'medium',
  disabled = false,
  error,
  onChange,
}: SelectProps) => {
  return (
    <div>
      {label ? (
        <label className="mb-2 block font-sans text-[13px] capitalize text-gray-900">{label}</label>
      ) : null}
      <div className="relative flex items-center">
        <select
          disabled={disabled}
          value={value}
          onChange={onChange}
          className={clsx(
            'w-full appearance-none rounded-[5px] font-sans outline-none duration-200',
            sizes[size],
            disabled
              ? 'cursor-not-allowed bg-gray-100 text-gray-700'
              : variant === 'default'
                ? 'cursor-pointer border border-gray-alpha-400 bg-background-100 text-gray-1000 focus:shadow-focus-input'
                : 'border-transparent bg-transparent text-accents-5',
            error && 'ring-[3px] ring-red-900/20',
          )}
        >
          {options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 h-4 w-4 text-gray-700" />
      </div>
      {error ? (
        <div className="mt-2">
          <Error size="small">{error}</Error>
        </div>
      ) : null}
    </div>
  )
}
