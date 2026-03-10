import { NavLink, useLocation } from 'react-router-dom'
import {
  Zap, Activity, Brain, Target, BarChart2,
  Settings, LogOut, Flame, User,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import { scoreColor } from '@/lib/scoreEngine'

const NAV = [
  { to: '/', label: 'Dashboard', icon: Zap, color: '#f0f0ff' },
  { to: '/habits', label: 'Habits', icon: Flame, color: '#84cc16' },
  { to: '/health', label: 'Health', icon: Activity, color: '#22c55e' },
  { to: '/emotional', label: 'Emotional IQ', icon: Brain, color: '#f97316' },
  { to: '/goals', label: 'Goals', icon: Target, color: '#f59e0b' },
  { to: '/report', label: 'Weekly Report', icon: BarChart2, color: '#f0f0ff' },
]

// Circular score ring SVG
function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 28
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  return (
    <div className="relative flex items-center justify-center" style={{ width: 72, height: 72 }}>
      <svg width="72" height="72" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="36" cy="36" r={r} fill="none" stroke="#2a2a3a" strokeWidth="5" />
        <circle
          cx="36" cy="36" r={r} fill="none"
          stroke={color} strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease', filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <span className="absolute text-lg font-bold" style={{ color }}>
        {score}
      </span>
    </div>
  )
}

export default function Sidebar() {
  const location = useLocation()
  const { user, signOut } = useAuthStore()
  const { todayScore, alerts } = useAppStore()
  const color = scoreColor(todayScore.total)
  const undismissed = alerts.filter((a) => !a.dismissed).length

  return (
    <aside className="flex flex-col h-screen w-[220px] border-r border-[var(--border)] bg-[var(--sidebar-bg)] overflow-hidden shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#1c1917', border: '1px solid #44403c' }}>
            <svg width="20" height="20" viewBox="0 0 512 512" fill="none">
              <path d="M 172 152 L 172 360 L 348 360" stroke="#a3e635" strokeWidth="80" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-lg font-bold text-white tracking-tight">LifeOS</span>
        </div>
      </div>

      {/* Today's Score ring */}
      <div className="flex flex-col items-center py-5 border-b border-[var(--border)]">
        <ScoreRing score={todayScore.total} color={color} />
        <p className="text-xs text-[#8888aa] mt-1 uppercase tracking-widest">Today's Score</p>
        {undismissed > 0 && (
          <div className="mt-2 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-medium">
            {undismissed} alert{undismissed > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV.map(({ to, label, icon: Icon, color: c }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-white/5 text-white'
                  : 'text-[#8888aa] hover:text-white hover:bg-white/5'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={17}
                  style={{ color: isActive ? c : undefined }}
                  className={isActive ? '' : 'opacity-60'}
                />
                <span>{label}</span>
                {isActive && (
                  <div
                    className="ml-auto w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: c, boxShadow: `0 0 6px ${c}` }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: settings + user */}
      <div className="border-t border-[var(--border)] px-2 py-3 space-y-1">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              isActive ? 'bg-white/5 text-white' : 'text-[#8888aa] hover:text-white hover:bg-white/5'
            }`
          }
        >
          <Settings size={17} className="opacity-60" />
          Settings
        </NavLink>
        <div className="flex items-center gap-2 px-3 py-2.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-lime-500 to-emerald-600 flex items-center justify-center shrink-0">
            <User size={13} className="text-white" />
          </div>
          <span className="text-xs text-[#8888aa] truncate flex-1">
            {user?.email?.split('@')[0] ?? 'User'}
          </span>
          <button
            onClick={signOut}
            className="text-[#555570] hover:text-red-400 transition-colors"
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}
