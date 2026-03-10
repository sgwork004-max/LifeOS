import { useEffect, useState } from 'react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
} from 'recharts'
import { Flame, Activity, Brain, Target, AlertTriangle, X, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { useHabits } from '@/hooks/useHabits'
import { useHealth } from '@/hooks/useHealth'
import { useEmotional } from '@/hooks/useEmotional'
import { useGoals } from '@/hooks/useGoals'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import { computeTodayScore, scoreColor, scoreLabel } from '@/lib/scoreEngine'
import { runPatternEngine } from '@/lib/patternEngine'
import { getCachedInsight, runMentorEngine } from '@/lib/mentorEngine'
import { loadPrefs, scheduleAll } from '@/lib/notifications'
import type { MentorInsight } from '@/lib/mentorEngine'
import { supabase, today } from '@/lib/supabase'
import Topbar from '@/components/layout/Topbar'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useNavigate } from 'react-router-dom'

const INSIGHT_TYPE_COLOR: Record<string, string> = {
  pattern: '#f59e0b',
  motivation: '#84cc16',
  prompt: '#f97316',
  observation: '#06b6d4',
}

const LAYER_CONFIGS = [
  { key: 'habit', label: 'Habits', color: '#84cc16', icon: Flame, path: '/habits' },
  { key: 'health', label: 'Health', color: '#22c55e', icon: Activity, path: '/health' },
  { key: 'emotional', label: 'Emotional IQ', color: '#f97316', icon: Brain, path: '/emotional' },
  { key: 'goal', label: 'Goals', color: '#f59e0b', icon: Target, path: '/goals' },
] as const

export default function Dashboard() {
  const { user, anthropicKey, aiEnabled } = useAuthStore()
  const { habits } = useHabits()
  const { todayLog, logs: healthLogs } = useHealth()
  const { todayCheckin, checkins, anxietyEvents } = useEmotional()
  const { goals } = useGoals()
  const { todayScore, setTodayScore, alerts, setAlerts, dismissAlert } = useAppStore()
  const navigate = useNavigate()
  const [mentorInsight, setMentorInsight] = useState<MentorInsight | null>(() => getCachedInsight())

  // Compute today's score whenever data changes
  useEffect(() => {
    const score = computeTodayScore(habits, todayCheckin ?? null, todayLog ?? null, goals)
    setTodayScore(score)
  }, [habits, todayCheckin, todayLog, goals])

  // Compute global streak from consecutive daily check-ins and persist
  useEffect(() => {
    if (checkins.length === 0) return
    const dates = checkins.map((c) => c.logged_at.slice(0, 10))
    let streak = 0
    const cursor = new Date()
    while (true) {
      const str = cursor.toISOString().slice(0, 10)
      if (dates.includes(str)) {
        streak++
        cursor.setDate(cursor.getDate() - 1)
      } else {
        break
      }
    }
    localStorage.setItem('lifeos_streak', String(streak))
  }, [checkins])

  // Run pattern engine once per day
  useEffect(() => {
    if (!user || habits.length === 0) return
    const lastRun = localStorage.getItem('lifeos_pattern_run')
    if (lastRun === today()) return
    runPatternEngine(user.id, { habits, healthLogs, anxietyEvents, goals }).then(() => {
      localStorage.setItem('lifeos_pattern_run', today())
    })
  }, [user, habits, healthLogs, anxietyEvents, goals])

  // Run mentor engine once per day
  useEffect(() => {
    if (!user || habits.length === 0) return
    runMentorEngine({ habits, healthLogs, checkins, goals, anthropicKey, aiEnabled }).then((insight) => {
      if (insight) setMentorInsight(insight)
    })
  }, [user, habits])

  // Schedule notifications on app open
  useEffect(() => {
    if (!user || habits.length === 0) return
    const prefs = loadPrefs()
    if (!prefs.enabled) return
    const habitNames = Object.fromEntries(habits.map((h) => [h.id, h.name]))
    scheduleAll(prefs, habitNames)
  }, [user, habits])

  // Load alerts
  useEffect(() => {
    if (!user) return
    supabase.from('pattern_alerts').select('*').eq('user_id', user.id).eq('dismissed', false)
      .order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => setAlerts(data ?? []))
  }, [user])

  const handleDismissAlert = async (id: string) => {
    await supabase.from('pattern_alerts').update({ dismissed: true }).eq('id', id)
    dismissAlert(id)
  }

  const color = scoreColor(todayScore.total)

  const radarData = [
    { subject: 'Habits', value: todayScore.habit },
    { subject: 'Health', value: todayScore.health },
    { subject: 'Emotional', value: todayScore.emotional },
    { subject: 'Goals', value: todayScore.goal },
  ]

  // Quick stats
  const habitsToday = habits.filter((h) => h.completed_today).length
  const habitsTotal = habits.length
  const avgMood = todayCheckin?.mood ?? null
  const latestGoalProgress = goals.reduce((s, g) => s + g.progress, 0) / Math.max(goals.length, 1)

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Dashboard" subtitle={`${format(new Date(), 'EEEE, MMMM d, yyyy')}`} />

      <div className="flex-1 p-6 space-y-5 overflow-y-auto">
        {/* Pattern Alerts */}
        {alerts.filter((a) => !a.dismissed).slice(0, 3).map((alert) => (
          <div
            key={alert.id}
            className="flex items-start gap-3 p-4 rounded-xl border bg-red-500/5 border-red-500/20 animate-fade-in"
          >
            <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge color="#ef4444">
                  {alert.layer.toUpperCase()}
                </Badge>
                <span className="text-xs text-red-400 font-medium">{alert.alert_type.replace(/_/g, ' ')}</span>
              </div>
              <p className="text-sm text-[#f0f0ff]">{alert.data_summary}</p>
            </div>
            <button
              onClick={() => handleDismissAlert(alert.id)}
              className="text-[#555570] hover:text-white transition-colors shrink-0"
            >
              <X size={15} />
            </button>
          </div>
        ))}

        {/* Mentor Insight */}
        {mentorInsight && (
          <Card glow="#84cc16" className="border-lime-500/20">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#84cc1620' }}>
                <Brain size={16} style={{ color: '#84cc16' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs font-semibold text-lime-400">AI Mentor</p>
                  <Badge color={INSIGHT_TYPE_COLOR[mentorInsight.type] ?? '#84cc16'}>
                    {mentorInsight.type}
                  </Badge>
                </div>
                <p className="text-sm font-semibold text-white">{mentorInsight.title}</p>
                <p className="text-sm text-[#c0c0cc] mt-1 leading-relaxed">{mentorInsight.body}</p>
              </div>
              <button
                onClick={() => navigate(mentorInsight.url)}
                className="shrink-0 w-7 h-7 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] flex items-center justify-center text-[#8888aa] hover:text-white transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </Card>
        )}

        {/* Score + radar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Today's score */}
          <Card glow={color}>
            <div className="flex flex-col items-center py-4">
              <div className="relative" style={{ width: 120, height: 120 }}>
                <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#2a2a3a" strokeWidth="8" />
                  <circle
                    cx="60" cy="60" r="50" fill="none"
                    stroke={color} strokeWidth="8"
                    strokeDasharray={2 * Math.PI * 50}
                    strokeDashoffset={2 * Math.PI * 50 * (1 - todayScore.total / 100)}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.8s ease', filter: `drop-shadow(0 0 8px ${color})` }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-white">{todayScore.total}</span>
                  <span className="text-xs text-[#8888aa]">/ 100</span>
                </div>
              </div>
              <p className="mt-3 font-semibold text-white text-lg">{scoreLabel(todayScore.total)}</p>
              <p className="text-sm text-[#8888aa]">Today's composite score</p>
            </div>
          </Card>

          {/* Radar chart */}
          <Card>
            <h3 className="font-semibold text-white mb-1 text-sm">Layer Breakdown</h3>
            <ResponsiveContainer width="100%" height={180}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#2a2a3a" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#8888aa', fontSize: 11 }} />
                <Radar dataKey="value" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Layer score cards */}
        <div className="grid grid-cols-2 gap-4">
          {LAYER_CONFIGS.map(({ key, label, color: c, icon: Icon, path }) => {
            const score = todayScore[key as keyof typeof todayScore] as number
            const layerColor = scoreColor(score)
            return (
              <Card
                key={key}
                onClick={() => navigate(path)}
                className="cursor-pointer group"
                glow={c}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${c}20` }}>
                      <Icon size={16} style={{ color: c }} />
                    </div>
                    <span className="text-sm font-semibold text-white">{label}</span>
                  </div>
                  <span className="text-lg font-black" style={{ color: layerColor }}>{score}%</span>
                </div>
                <div className="h-1 rounded-full bg-[#2a2a3a]">
                  <div
                    className="h-1 rounded-full transition-all duration-700"
                    style={{ width: `${score}%`, backgroundColor: c, boxShadow: `0 0 6px ${c}60` }}
                  />
                </div>
              </Card>
            )
          })}
        </div>

        {/* Quick wins / quick look */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <p className="text-xs text-[#8888aa] uppercase tracking-widest mb-2">Habits Today</p>
            <p className="text-2xl font-black text-lime-400">{habitsToday} / {habitsTotal}</p>
            <p className="text-xs text-[#555570] mt-1">{habitsTotal > 0 ? Math.round((habitsToday / habitsTotal) * 100) : 0}% complete</p>
          </Card>
          <Card>
            <p className="text-xs text-[#8888aa] uppercase tracking-widest mb-2">Mood Today</p>
            <p className="text-2xl font-black text-orange-400">{avgMood ? `${avgMood}/10` : '—'}</p>
            <p className="text-xs text-[#555570] mt-1">{todayCheckin ? 'Checked in' : 'Not logged yet'}</p>
          </Card>
          <Card>
            <p className="text-xs text-[#8888aa] uppercase tracking-widest mb-2">Goal Progress</p>
            <p className="text-2xl font-black text-amber-400">{Math.round(latestGoalProgress)}%</p>
            <p className="text-xs text-[#555570] mt-1">avg across {goals.length} goal{goals.length !== 1 ? 's' : ''}</p>
          </Card>
        </div>
      </div>
    </div>
  )
}
