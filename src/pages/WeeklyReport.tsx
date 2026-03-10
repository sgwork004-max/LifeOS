import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { BarChart2, RefreshCw, Sparkles, ChevronDown, ChevronRight } from 'lucide-react'
import { format, endOfWeek } from 'date-fns'
import { supabase, weekStart, daysAgo } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useHabits } from '@/hooks/useHabits'
import { useHealth } from '@/hooks/useHealth'
import { useEmotional } from '@/hooks/useEmotional'
import { useGoals } from '@/hooks/useGoals'
import { callClaude, buildWeeklyReportPrompt } from '@/lib/anthropic'
import Topbar from '@/components/layout/Topbar'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { WeeklyReport, WeeklyReportData } from '@/types'
import { scoreColor } from '@/lib/scoreEngine'

function generateRuleBasedReport(data: {
  habitRate: number
  checkinsDone: number
  totalDays: number
  weightDelta: number
  goalProgress: number
  emotionTags: string[]
  anxietyCount: number
}): WeeklyReportData {
  const habitScore = Math.round(data.habitRate * 100)
  const emotionalScore = Math.round((data.checkinsDone / Math.max(data.totalDays, 7)) * 100)
  const healthScore = data.weightDelta !== null ? (Math.abs(data.weightDelta) <= 0.5 ? 80 : data.weightDelta < 0 ? 100 : 40) : 50
  const goalScore = Math.round(data.goalProgress)
  const overall = Math.round(habitScore * 0.4 + emotionalScore * 0.2 + healthScore * 0.2 + goalScore * 0.2)

  const wins: string[] = []
  const failures: string[] = []
  const patterns: string[] = []
  const focus: string[] = []

  if (habitScore >= 80) wins.push(`Habit completion: ${habitScore}% — strong execution`)
  else failures.push(`Habit completion: only ${habitScore}% — ${100 - habitScore}% gap to close`)

  if (emotionalScore >= 80) wins.push(`Checked in ${data.checkinsDone}/${data.totalDays} days — consistent self-awareness`)
  else failures.push(`Only ${data.checkinsDone} emotional check-ins this week`)

  if (data.weightDelta < -0.3) wins.push(`Weight down ${Math.abs(data.weightDelta).toFixed(1)}kg — trending in the right direction`)
  else if (data.weightDelta > 1) failures.push(`Weight increased ${data.weightDelta.toFixed(1)}kg this week — above 1kg warning threshold`)

  if (goalScore >= 70) wins.push(`Goal tasks: ${goalScore}% completion rate`)
  else failures.push(`Goal momentum: ${goalScore}% — insufficient weekly execution`)

  if (data.anxietyCount >= 3) patterns.push(`${data.anxietyCount} anxiety/anger events logged — elevated stress pattern`)

  const topEmotion = data.emotionTags[0]
  if (topEmotion) patterns.push(`Dominant emotional state: ${topEmotion}`)

  // Focus recommendations (lowest scoring areas)
  const scores = [
    { label: 'habits', score: habitScore },
    { label: 'emotional check-ins', score: emotionalScore },
    { label: 'health logging', score: healthScore },
    { label: 'goal tasks', score: goalScore },
  ].sort((a, b) => a.score - b.score)

  focus.push(`Improve ${scores[0].label} — currently your lowest area at ${scores[0].score}%`)
  if (scores[1].score < 60) focus.push(`Address ${scores[1].label} — ${scores[1].score}%`)
  focus.push('Review and add milestones to any stalled goals this week')

  return { overall_score: overall, habit_score: habitScore, emotional_score: emotionalScore, health_score: healthScore, goal_score: goalScore, wins, failures, patterns, focus_next_week: focus }
}

export default function WeeklyReport() {
  const { user, anthropicKey, aiEnabled } = useAuthStore()
  const { habits } = useHabits()
  const { logs: healthLogs } = useHealth()
  const { checkins, anxietyEvents } = useEmotional()
  const { goals } = useGoals()
  const [reports, setReports] = useState<WeeklyReport[]>([])
  const [generating, setGenerating] = useState(false)
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null)
  const [expandSection, setExpandSection] = useState<string | null>('wins')

  useEffect(() => {
    if (!user) return
    supabase.from('weekly_reports').select('*').eq('user_id', user.id)
      .order('week_start', { ascending: false }).limit(12)
      .then(({ data }) => {
        const r = data ?? []
        setReports(r)
        if (r.length > 0) setSelectedReport(r[0])
      })
  }, [user])

  const generateReport = async () => {
    if (!user) return
    setGenerating(true)
    try {
      const ws = weekStart()
      const totalDays = 7
      const weekCheckins = checkins.filter((c) => c.logged_at >= daysAgo(7))
      const weekAnxiety = anxietyEvents.filter((e) => e.logged_at >= daysAgo(7))

      // Habit completion rate
      const habitRate = habits.length > 0
        ? habits.reduce((sum, h) => {
            const daysLogged = h.logs.filter((l) => l.completed_at >= daysAgo(7)).length
            return sum + (daysLogged / 7)
          }, 0) / habits.length
        : 0.5

      // Weight delta
      const weekHealthLogs = healthLogs.filter((l) => l.logged_at >= daysAgo(7))
      const weightDelta = weekHealthLogs.length >= 2
        ? weekHealthLogs[0].weight_kg - weekHealthLogs[weekHealthLogs.length - 1].weight_kg
        : 0

      // Goal progress avg
      const goalProgress = goals.length > 0
        ? goals.reduce((s, g) => s + g.progress, 0) / goals.length
        : 50

      // Top emotion tags
      const tagFreq: Record<string, number> = {}
      for (const c of weekCheckins) for (const t of c.emotion_tags) tagFreq[t] = (tagFreq[t] || 0) + 1
      const topTags = Object.entries(tagFreq).sort((a, b) => b[1] - a[1]).map(([t]) => t)

      const reportData = generateRuleBasedReport({
        habitRate, checkinsDone: weekCheckins.length, totalDays,
        weightDelta, goalProgress, emotionTags: topTags, anxietyCount: weekAnxiety.length,
      })

      // AI narrative if enabled
      if (aiEnabled && anthropicKey) {
        try {
          const summaryStr = `Habit completion: ${reportData.habit_score}%, Emotional check-ins: ${weekCheckins.length}/7, Weight delta: ${weightDelta.toFixed(1)}kg, Goal progress avg: ${reportData.goal_score}%, Anxiety events: ${weekAnxiety.length}, Top emotions: ${topTags.slice(0, 3).join(', ')}`
          const narrative = await callClaude(buildWeeklyReportPrompt(summaryStr), anthropicKey)
          reportData.ai_narrative = narrative
        } catch {
          // AI failed, continue with rule-based only
        }
      }

      const { data: newReport } = await supabase.from('weekly_reports').insert({
        user_id: user.id,
        week_start: ws,
        score: reportData.overall_score,
        report_json: reportData,
      }).select().single()

      if (newReport) {
        setReports((prev) => [newReport, ...prev])
        setSelectedReport(newReport)
      }
    } finally {
      setGenerating(false)
    }
  }

  const rd = selectedReport?.report_json as WeeklyReportData | null

  const chartData = rd ? [
    { name: 'Habits', score: rd.habit_score, color: '#7c3aed' },
    { name: 'Emotional', score: rd.emotional_score, color: '#06b6d4' },
    { name: 'Health', score: rd.health_score, color: '#22c55e' },
    { name: 'Goals', score: rd.goal_score, color: '#f59e0b' },
  ] : []

  const SECTIONS = [
    { key: 'wins', label: 'What You Crushed', items: rd?.wins ?? [], color: '#22c55e', icon: '✓' },
    { key: 'failures', label: 'Where You Failed', items: rd?.failures ?? [], color: '#ef4444', icon: '✗' },
    { key: 'patterns', label: 'Patterns Detected', items: rd?.patterns ?? [], color: '#f59e0b', icon: '⚠' },
    { key: 'focus', label: "Next Week's Focus", items: rd?.focus_next_week ?? [], color: '#7c3aed', icon: '→' },
  ]

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Weekly Report" subtitle="Brutally honest performance analysis" accentColor="#7c3aed" />

      <div className="flex-1 p-6 space-y-5 overflow-y-auto">
        {/* Generate button */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#8888aa]">
            {reports.length > 0
              ? `Last report: ${format(new Date(reports[0].week_start), 'MMM d, yyyy')}`
              : 'No reports yet'}
          </p>
          <button
            onClick={generateReport}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 0 16px #7c3aed40' }}
          >
            <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
            {generating ? 'Generating…' : 'Generate Report'}
          </button>
        </div>

        {/* Report archive pills */}
        {reports.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {reports.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedReport(r)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                  selectedReport?.id === r.id
                    ? 'bg-violet-600/30 border-violet-500/60 text-violet-300'
                    : 'bg-[#1a1a24] border-[#2a2a3a] text-[#8888aa] hover:text-white'
                }`}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ backgroundColor: `${scoreColor(r.score)}20`, color: scoreColor(r.score) }}
                >
                  {r.score}
                </span>
                {format(new Date(r.week_start), 'MMM d')}
              </button>
            ))}
          </div>
        )}

        {rd ? (
          <>
            {/* Score + chart */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Card glow={scoreColor(rd.overall_score)}>
                <div className="flex flex-col items-center py-4">
                  <div className="relative" style={{ width: 100, height: 100 }}>
                    <svg width="100" height="100" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#2a2a3a" strokeWidth="7" />
                      <circle
                        cx="50" cy="50" r="42" fill="none"
                        stroke={scoreColor(rd.overall_score)} strokeWidth="7"
                        strokeDasharray={2 * Math.PI * 42}
                        strokeDashoffset={2 * Math.PI * 42 * (1 - rd.overall_score / 100)}
                        strokeLinecap="round"
                        style={{ filter: `drop-shadow(0 0 6px ${scoreColor(rd.overall_score)})` }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-black text-white">{rd.overall_score}</span>
                    </div>
                  </div>
                  <p className="mt-2 font-semibold text-white">Week Score</p>
                  <p className="text-xs text-[#8888aa]">
                    {selectedReport && format(new Date(selectedReport.week_start), 'MMM d')} — {selectedReport && format(endOfWeek(new Date(selectedReport.week_start), { weekStartsOn: 1 }), 'MMM d, yyyy')}
                  </p>
                </div>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold text-white mb-3">Layer Scores</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={chartData} barSize={24}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                    <XAxis dataKey="name" tick={{ fill: '#8888aa', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#8888aa', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 8 }} labelStyle={{ color: '#8888aa' }} formatter={(v) => [`${v}%`]} />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* AI narrative */}
            {rd.ai_narrative && (
              <Card className="border-amber-500/20 bg-amber-500/5">
                <div className="flex items-start gap-3">
                  <Sparkles size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-400 mb-2">AI Mentor Report</p>
                    <p className="text-sm text-[#f0f0ff] leading-relaxed">{rd.ai_narrative}</p>
                  </div>
                </div>
              </Card>
            )}

            {/* Report sections */}
            <div className="space-y-3">
              {SECTIONS.map(({ key, label, items, color, icon }) => (
                <Card key={key}>
                  <button
                    onClick={() => setExpandSection(expandSection === key ? null : key)}
                    className="w-full flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold"
                        style={{ background: `${color}20`, color }}>
                        {icon}
                      </span>
                      <span className="text-sm font-semibold text-white">{label}</span>
                      <span className="text-xs text-[#555570]">{items.length} item{items.length !== 1 ? 's' : ''}</span>
                    </div>
                    {expandSection === key ? <ChevronDown size={16} className="text-[#555570]" /> : <ChevronRight size={16} className="text-[#555570]" />}
                  </button>

                  {expandSection === key && items.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {items.map((item, i) => (
                        <div key={i} className="flex items-start gap-2 py-2 border-t border-[#2a2a3a]">
                          <span className="text-xs font-bold mt-0.5 shrink-0" style={{ color }}>{icon}</span>
                          <p className="text-sm text-[#f0f0ff]">{item}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {expandSection === key && items.length === 0 && (
                    <p className="mt-3 text-sm text-[#555570] border-t border-[#2a2a3a] pt-3">No data for this section.</p>
                  )}
                </Card>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BarChart2 size={40} className="text-[#2a2a3a] mb-4" />
            <p className="text-[#8888aa] font-medium">No reports yet</p>
            <p className="text-sm text-[#555570] mt-1">Generate your first weekly report to see your performance breakdown</p>
          </div>
        )}
      </div>
    </div>
  )
}
