import type { ReactNode, ButtonHTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  accent?: string
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  accent,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed'

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  }

  const variants = {
    primary: accent
      ? ''
      : 'bg-violet-600 hover:bg-violet-500 text-white border border-violet-500/50',
    secondary: 'bg-[#1a1a24] hover:bg-[#22223a] text-[#f0f0ff] border border-[#2a2a3a]',
    ghost: 'text-[#8888aa] hover:text-white hover:bg-white/5',
    danger: 'bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30',
  }

  const style =
    accent && variant === 'primary'
      ? {
          background: `linear-gradient(135deg, ${accent}dd, ${accent}99)`,
          border: `1px solid ${accent}60`,
          color: 'white',
          boxShadow: `0 0 12px ${accent}30`,
        }
      : undefined

  return (
    <button
      className={clsx(base, sizes[size], variants[variant], className)}
      style={style}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
