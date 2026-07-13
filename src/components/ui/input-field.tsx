'use client'

import { useEffect, useId, useRef, useState } from 'react'
import clsx from 'clsx'

import { Error } from '@/components/ui/error'

const sizes = {
  xSmall: 'h-6 text-xs rounded-md',
  small: 'h-8 text-sm rounded-md',
  mediumSmall: 'h-10 text-sm rounded-md',
  medium: 'h-10 text-sm rounded-md',
  large: 'h-12 text-base rounded-lg',
}

export interface FieldInputProps {
  placeholder?: string
  size?: keyof typeof sizes
  prefix?: React.ReactNode
  suffix?: React.ReactNode
  prefixStyling?: boolean | string
  suffixStyling?: boolean | string
  disabled?: boolean
  error?: string | boolean
  label?: string
  value?: string
  onChange?: (value: string) => void
  onFocus?: () => void
  onBlur?: () => void
  className?: string
  wrapperClassName?: string
}

export const FieldInput = ({
  placeholder,
  size = 'medium',
  prefix,
  suffix,
  prefixStyling = true,
  suffixStyling = true,
  disabled = false,
  error,
  label,
  value,
  onChange,
  onFocus,
  onBlur,
  className,
  wrapperClassName,
}: FieldInputProps) => {
  const id = useId()
  const [inner, setInner] = useState(value ?? '')
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (value !== undefined) setInner(value)
  }, [value])

  return (
    <div className="flex flex-col gap-2" onClick={() => ref.current?.focus()}>
      {label ? <div className="text-[13px] capitalize text-gray-900">{label}</div> : null}
      <div
        className={clsx(
          'flex items-center font-sans duration-150',
          error
            ? 'shadow-error-input hover:shadow-error-input-hover'
            : 'border border-gray-alpha-400 hover:border-gray-alpha-500 focus-within:border-transparent focus-within:shadow-focus-input',
          sizes[size],
          disabled ? 'cursor-not-allowed bg-gray-100' : 'bg-background-100',
          wrapperClassName,
        )}
      >
        {prefix ? (
          <div
            className={clsx(
              'flex h-full items-center justify-center text-gray-700',
              prefixStyling === true
                ? 'border-r border-gray-alpha-400 bg-background-200 px-3'
                : `pl-3 ${typeof prefixStyling === 'string' ? prefixStyling : ''}`,
            )}
          >
            {prefix}
          </div>
        ) : null}
        <input
          id={id}
          ref={ref}
          disabled={disabled}
          value={inner}
          placeholder={placeholder}
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={(e) => {
            setInner(e.target.value)
            onChange?.(e.target.value)
          }}
          className={clsx(
            'inline-flex w-full appearance-none outline-none placeholder:text-gray-900 placeholder:opacity-70',
            size === 'xSmall' || size === 'mediumSmall' ? 'px-2' : 'px-3',
            disabled ? 'cursor-not-allowed bg-gray-100 text-gray-700' : 'bg-background-100 text-geist-foreground',
            className,
          )}
        />
        {suffix ? (
          <div
            className={clsx(
              'flex h-full items-center justify-center text-gray-700',
              suffixStyling === true
                ? 'border-l border-gray-alpha-400 bg-background-200 px-3'
                : `pr-3 ${typeof suffixStyling === 'string' ? suffixStyling : ''}`,
            )}
          >
            {suffix}
          </div>
        ) : null}
      </div>
      {typeof error === 'string' ? <Error size={size === 'large' ? 'large' : 'small'}>{error}</Error> : null}
    </div>
  )
}
