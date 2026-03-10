import { useState } from 'react'
import { Flame, Plus, Trash2, Check, X, AlertTriangle, Sparkles } from 'lucide-react'
import { useHabits } from '@/hooks/useHabits'
import { useAuthStore } from '@/stores/authStore'
import { callClaude, buildHabitInsightPrompt } from '@/lib/anthropic'
import Topbar from '@/components/layout/Topbar'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import HabitHeatmap from '@/components/charts/HabitHeatmap'
import type { Habit } from '@/types'

const CATEGORIES = ['Fitness', 'Mindfulness', 'Learning', 'Nutrition', 'Sleep', 'Productivity', 'Other']
const COLORS = ['#7c3aed', '#22c55e', '#06b6d4', '#f59e0b', '#ef4444', '#ec4899', '#f97316']

function HabitCard({
  habit,
  onCheck,
  onDelete,
  onInsight,
}: {
  habit: ReturnType<typeof useHabits>['habits'][0]
  onCheck: () => void
  onDelete: () => void
  onInsight: () => void
}) {
  const [checking, setChecking] = useState(false)
  const { aiEnabled } = useAuthStore()

  const handleCheck = async () => {
    setChecking(true)
    await onCheck()
    setChecking(false)
  }

  const missed3 =
    !habit.completed_today && habit.current_streak === 0 && habit.completion_30d < 30

  return (
    <Card className="animate-slide-up">
      <div className="flex items-start gap-4">
        {/* Check button */}
        <button
          onClick={handleCheck}
          disabled={checking}
          className={`mt-0.5 w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${
            habit.completed_today
              ? 'text-white animate-check-bounce'
              : 'border-2 border-[#3a3a50] text-[#555570] hover:border-[#5a5a70] hover:text-[#8888aa]'
          }`}
          style={
            habit.completed_today
              ? {
                  backgroundColor: habit.color || '#7c3aed',
                  boxShadow: `0 0 12px ${habit.color || '#7c3aed'}60`,
                }
              : undefined
          }
        >
          {habit.completed_today ? <Check size={16} strokeWidth={3} /> : null}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white">{habit.name}</span>
            <Badge color={habit.color}>{habit.category}</Badge>
            {habit.importance_weight === 5 && (
              <Badge color="#ef4444">Critical</Badge>
            )}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <Flame
                size={14}
                className={habit.current_streak > 0 ? 'text-amber-400' : 'text-[#555570]'}
                fill={habit.current_streak > 0 ? '#f59e0b' : 'none'}
              />
              <span className={`text-sm font-bold ${habit.current_streak > 0 ? 'text-amber-400' : 'text-[#555570]'}`}>
                {habit.current_streak}d streak
              </span>
            </div>
            <span className="text-xs text-[#555570]">Best: {habit.longest_streak}d</span>
            <span className="text-xs text-[#555570]">{habit.completion_30d}% last 30d</span>
          </div>

          {/* Mentor message for broken streak */}
          {missed3 && (
            <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertTriangle size={13} className="text-red-400 shrink-0" />
              <p className="text-xs text-red-300">
                Pattern detected: low consistency. Only {habit.completion_30d}% completion in 30 days.
              </p>
            </div>
          )}

          {/* Heatmap */}
          <div className="mt-3">
            <HabitHeatmap logs={habit.logs} color={habit.color || '#7c3aed'} days={63} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1.5 shrink-0">
          {aiEnabled && (
            <button
              onClick={onInsight}
              className="w-7 h-7 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] flex items-center justify-center text-[#8888aa] hover:text-amber-400 hover:border-amber-500/30 transition-all"
              title="AI Insight"
            >
              <Sparkles size={13} />
            </button>
          )}
          <button
            onClick={onDelete}
            className="w-7 h-7 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] flex items-center justify-center text-[#555570] hover:text-red-400 hover:border-red-500/30 transition-all"
            title="Delete habit"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </Card>
  )
}

export default function Habits() {
  const { habits, loading, checkHabit, createHabit, deleteHabit } = useHabits()
  const { anthropicKey, aiEnabled } = useAuthStore()
  const [showCreate, setShowCreate] = useState(false)
  const [insight, setInsight] = useState<{ habit: string; text: string } | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)

  // New habit form
  const [name, setName] = useState('')
  const [cat, setCat] = useState('Fitness')
  const [freq, setFreq] = useState<'daily' | 'weekly'>('daily')
  const [weight, setWeight] = useState(3)
  const [color, setColor] = useState(COLORS[0])

  const handleCreate = async () => {
    if (!name.trim()) return
    await createHabit({ name: name.trim(), category: cat, frequency: freq, importance_weight: weight, color })
    setName(''); setCat('Fitness'); setFreq('daily'); setWeight(3); setColor(COLORS[0])
    setShowCreate(false)
  }

  const fetchInsight = async (habit: typeof habits[0]) => {
    if (!anthropicKey) return
    setInsightLoading(true)
    try {
      const historyStr = `Completion rate: ${habit.completion_30d}%, Current streak: ${habit.current_streak} days, Longest streak: ${habit.longest_streak} days`
      const text = await callClaude(buildHabitInsightPrompt(habit.name, historyStr), anthropicKey)
      setInsight({ habit: habit.name, text })
    } catch (e) {
      setInsight({ habit: habit.name, text: 'Failed to load AI insight. Check your API key in Settings.' })
    } finally {
      setInsightLoading(false)
    }
  }

  const completed = habits.filter((h) => h.completed_today).length
  const total = habits.length
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Habits"
        subtitle={`${completed}/${total} completed today`}
        accentColor="#7c3aed"
      />

      <div className="flex-1 p-6 space-y-5 overflow-y-auto">
        {/* Summary bar */}
        <Card glow="#7c3aed">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-2xl font-black text-white">{pct}%</p>
              <p className="text-sm text-[#8888aa]">Daily completion rate</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-[#8888aa]">{completed} / {total} habits done</p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/20 border border-violet-500/40 text-violet-300 text-sm font-medium hover:bg-violet-600/30 transition-all"
              >
                <Plus size={13} /> New Habit
              </button>
            </div>
          </div>
          <div className="h-2 rounded-full bg-[#2a2a3a] overflow-hidden">
            <div
              className="h-2 rounded-full transition-all duration-700"
              style={{
                width: `${pct}%`,
                background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
                boxShadow: '0 0 8px #7c3aed60',
              }}
            />
          </div>
        </Card>

        {/* Habit list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-xl bg-[#111118] border border-[#2a2a3a] animate-pulse" />
            ))}
          </div>
        ) : habits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Flame size={40} className="text-[#2a2a3a] mb-4" />
            <p className="text-[#8888aa] font-medium">No habits yet</p>
            <p className="text-sm text-[#555570] mt-1">Create your first habit to start tracking</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600/20 border border-violet-500/40 text-violet-300 text-sm font-medium"
            >
              <Plus size={14} /> Add Habit
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {habits.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                onCheck={() => checkHabit(habit.id)}
                onDelete={() => deleteHabit(habit.id)}
                onInsight={() => fetchInsight(habit)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Habit">
        <div className="space-y-4">
          <div>
            <label className="text-sm text-[#8888aa] mb-1.5 block">Habit Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Morning run, Meditate…"
              className="w-full px-3 py-2 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-white text-sm placeholder:text-[#555570] focus:outline-none focus:border-violet-500/60"
            />
          </div>

          <div>
            <label className="text-sm text-[#8888aa] mb-1.5 block">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button key={c} onClick={() => setCat(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    cat === c ? 'bg-violet-600/30 border border-violet-500/60 text-violet-300' : 'bg-[#1a1a24] border border-[#2a2a3a] text-[#8888aa] hover:text-white'
                  }`}
                >{c}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-[#8888aa] mb-1.5 block">Frequency</label>
            <div className="flex gap-2">
              {(['daily', 'weekly'] as const).map((f) => (
                <button key={f} onClick={() => setFreq(f)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                    freq === f ? 'bg-violet-600/30 border border-violet-500/60 text-violet-300' : 'bg-[#1a1a24] border border-[#2a2a3a] text-[#8888aa] hover:text-white'
                  }`}
                >{f}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-[#8888aa] mb-1.5 block">Importance (1–5)</label>
            <div className="flex gap-2">
              {[1,2,3,4,5].map((w) => (
                <button key={w} onClick={() => setWeight(w)}
                  className={`w-9 h-9 rounded-lg text-sm font-bold transition-all ${
                    weight === w ? 'bg-violet-600 text-white' : 'bg-[#1a1a24] border border-[#2a2a3a] text-[#8888aa] hover:text-white'
                  }`}
                >{w}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-[#8888aa] mb-1.5 block">Color</label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? 'white' : c,
                    boxShadow: color === c ? `0 0 8px ${c}` : undefined,
                  }}
                />
              ))}
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 0 20px #7c3aed40' }}
          >
            Create Habit
          </button>
        </div>
      </Modal>

      {/* AI Insight modal */}
      <Modal open={!!insight || insightLoading} onClose={() => setInsight(null)} title="AI Insight">
        {insightLoading ? (
          <div className="flex flex-col items-center py-6 gap-3">
            <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
            <p className="text-sm text-[#8888aa]">Analyzing your pattern…</p>
          </div>
        ) : insight ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-violet-400">{insight.habit}</p>
            <div className="p-4 rounded-xl bg-[#1a1a24] border border-violet-500/20">
              <p className="text-sm text-[#f0f0ff] leading-relaxed">{insight.text}</p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
