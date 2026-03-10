import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-[#8888aa]">{label}</label>
        )}
        <input
          ref={ref}
          className={clsx(
            'w-full px-3 py-2 rounded-lg bg-[#1a1a24] border text-white text-sm',
            'placeholder:text-[#555570] focus:outline-none transition-colors',
            error
              ? 'border-red-500/50 focus:border-red-500'
              : 'border-[#2a2a3a] focus:border-[#3a3a50]',
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    )
  },
)

Input.displayName = 'Input'

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

export function TextArea({ label, className, ...props }: TextAreaProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-[#8888aa]">{label}</label>}
      <textarea
        className={clsx(
          'w-full px-3 py-2 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-white text-sm',
          'placeholder:text-[#555570] focus:outline-none focus:border-[#3a3a50] transition-colors resize-none',
          className,
        )}
        {...props}
      />
    </div>
  )
}
