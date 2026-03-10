import { format } from 'date-fns'
import { Flame, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/appStore'

interface TopbarProps {
  title: string
  subtitle?: string
  accentColor?: string
}

export default function Topbar({ title, subtitle, accentColor = '#84cc16' }: TopbarProps) {
  const navigate = useNavigate()
  const { alerts } = useAppStore()
  const activeAlerts = alerts.filter((a) => !a.dismissed)

  // Compute a global streak from localStorage (simplified)
  const streak = parseInt(localStorage.getItem('lifeos_streak') ?? '0', 10)

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--sidebar-bg)]/80 backdrop-blur-sm">
      <div>
        <h1 className="text-xl font-bold text-white leading-none">{title}</h1>
        {subtitle && <p className="text-sm text-[#8888aa] mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {/* Date */}
        <div className="text-sm text-[#8888aa] hidden sm:block">
          {format(new Date(), 'EEEE, MMM d')}
        </div>

        {/* Streak badge */}
        {streak > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30">
            <Flame size={14} className="text-amber-400 animate-streak-pulse" />
            <span className="text-amber-400 text-sm font-bold">{streak}d</span>
          </div>
        )}

        {/* Daily Check-in CTA */}
        <button
          onClick={() => navigate('/emotional')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all"
          style={{
            background: `linear-gradient(135deg, ${accentColor}cc, ${accentColor}88)`,
            border: `1px solid ${accentColor}60`,
            boxShadow: `0 0 12px ${accentColor}30`,
          }}
        >
          <Plus size={15} />
          Daily Check-in
        </button>
      </div>
    </header>
  )
}
