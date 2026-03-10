import type { ReactNode } from 'react'
import { clsx } from 'clsx'

interface BadgeProps {
  children: ReactNode
  color?: string
  className?: string
}

export function Badge({ children, color, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        !color && 'bg-[#2a2a3a] text-[#8888aa]',
        className,
      )}
      style={
        color
          ? {
              background: `${color}20`,
              color,
              border: `1px solid ${color}40`,
            }
          : undefined
      }
    >
      {children}
    </span>
  )
}
