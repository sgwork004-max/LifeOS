import type { ReactNode } from 'react'
import { clsx } from 'clsx'

interface CardProps {
  children: ReactNode
  className?: string
  glow?: string
  onClick?: () => void
}

export function Card({ children, className, glow, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-all',
        onClick && 'cursor-pointer hover:border-[var(--border-hover)]',
        className,
      )}
      style={{ boxShadow: glow
        ? `0 1px 3px rgba(0,0,0,.15), 0 4px 14px rgba(0,0,0,.10), 0 0 18px ${glow}18`
        : '0 1px 3px rgba(0,0,0,.12), 0 4px 12px rgba(0,0,0,.08)' }}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('mb-4', className)}>{children}</div>
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={clsx('text-base font-semibold text-white leading-none', className)}>
      {children}
    </h3>
  )
}
