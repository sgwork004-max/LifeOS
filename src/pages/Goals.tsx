import { useState } from 'react'
import { Target, Plus, ChevronDown, ChevronRight, Check, Trash2, Sparkles, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { useGoals } from '@/hooks/useGoals'
import { useAuthStore } from '@/stores/authStore'
import { callClaude, buildGoalGapPrompt } from '@/lib/anthropic'
import Topbar from '@/components/layout/Topbar'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import type { GoalHorizon, GoalCategory, GoalWithProgress } from '@/types'

const HORIZON_COLORS: Record<GoalHorizon, string> = {
  'monthly': '#22c55e', 'yearly': '#06b6d4', '5-year': '#7c3aed',
}
const CAT_LABELS: Record<GoalCategory, string> = {
  career: 'Career', health: 'Health', relationships: 'Relationships',
  finance: 'Finance', personal_growth: 'Personal Growth',
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 rounded-full bg-[#2a2a3a] overflow-hidden">
      <div
        className="h-1.5 rounded-full transition-all duration-700"
        style={{ width: `${value}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}60` }}
      />
    </div>
  )
}

function GoalCard({
  goal,
  onDelete,
  onToggleMilestone,
  onAddMilestone,
  onToggleTask,
  onAddTask,
  onInsight,
}: {
  goal: GoalWithProgress
  onDelete: () => void
  onToggleMilestone: (id: string, completed: boolean) => void
  onAddMilestone: (goalId: string) => void
  onToggleTask: (id: string, completed: boolean) => void
  onAddTask: (milestoneId: string) => void
  onInsight: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const { aiEnabled } = useAuthStore()
  const color = HORIZON_COLORS[goal.horizon]

  const daysOld = Math.floor((Date.now() - new Date(goal.created_at).getTime()) / 86400000)
  const stalled = goal.progress === 0 && daysOld >= 14

  return (
    <Card className="animate-slide-up" glow={stalled ? '#ef4444' : color}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${color}20`, border: `1px solid ${color}30` }}>
          <Target size={18} style={{ color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-white leading-tight">{goal.title}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge color={color}>{goal.horizon}</Badge>
                <Badge>{CAT_LABELS[goal.category]}</Badge>
                {goal.deadline && (
                  <span className="text-xs text-[#555570]">Due {format(new Date(goal.deadline), 'MMM d, yyyy')}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {aiEnabled && (
                <button onClick={onInsight}
                  className="w-7 h-7 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] flex items-center justify-center text-[#8888aa] hover:text-amber-400 hover:border-amber-500/30 transition-all"
                >
                  <Sparkles size={13} />
                </button>
              )}
              <button onClick={onDelete}
                className="w-7 h-7 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] flex items-center justify-center text-[#555570] hover:text-red-400 hover:border-red-500/30 transition-all"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {goal.success_metric && (
            <p className="text-xs text-[#8888aa] mt-1.5">✓ {goal.success_metric}</p>
          )}

          {/* Progress */}
          <div className="mt-3">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs text-[#8888aa]">{goal.milestones.length} milestones</span>
              <span className="text-xs font-bold" style={{ color }}>{goal.progress}%</span>
            </div>
            <ProgressBar value={goal.progress} color={color} />
          </div>

          {stalled && (
            <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertTriangle size={12} className="text-red-400 shrink-0" />
              <p className="text-xs text-red-300">0% progress in {daysOld} days. This goal is stalling.</p>
            </div>
          )}

          {/* Expand button */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 mt-3 text-xs text-[#8888aa] hover:text-white transition-colors"
          >
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            {expanded ? 'Hide' : 'View'} milestones
          </button>

          {/* Milestones */}
          {expanded && (
            <div className="mt-3 space-y-2 pl-2 border-l-2" style={{ borderColor: `${color}40` }}>
              {goal.milestones.map((m) => (
                <div key={m.id} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onToggleMilestone(m.id, !m.completed_at)}
                      className={`w-5 h-5 rounded flex items-center justify-center border transition-all shrink-0 ${
                        m.completed_at ? 'border-emerald-500 bg-emerald-500/20' : 'border-[#3a3a50]'
                      }`}
                    >
                      {m.completed_at && <Check size={11} className="text-emerald-400" strokeWidth={3} />}
                    </button>
                    <span className={`text-sm ${m.completed_at ? 'line-through text-[#555570]' : 'text-[#f0f0ff]'}`}>
                      {m.title}
                    </span>
                    {m.due_date && (
                      <span className="text-xs text-[#555570] ml-auto">{format(new Date(m.due_date), 'MMM d')}</span>
                    )}
                  </div>

                  {/* Tasks */}
                  {m.tasks.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 ml-6">
                      <button
                        onClick={() => onToggleTask(t.id, !t.completed_at)}
                        className={`w-4 h-4 rounded flex items-center justify-center border transition-all shrink-0 ${
                          t.completed_at ? 'border-cyan-500 bg-cyan-500/20' : 'border-[#3a3a50]'
                        }`}
                      >
                        {t.completed_at && <Check size={9} className="text-cyan-400" strokeWidth={3} />}
                      </button>
                      <span className={`text-xs ${t.completed_at ? 'line-through text-[#555570]' : 'text-[#8888aa]'}`}>
                        {t.title}
                      </span>
                    </div>
                  ))}

                  <button
                    onClick={() => onAddTask(m.id)}
                    className="ml-6 text-xs text-[#555570] hover:text-[#8888aa] flex items-center gap-1"
                  >
                    <Plus size={11} /> Add task
                  </button>
                </div>
              ))}

              <button
                onClick={() => onAddMilestone(goal.id)}
                className="flex items-center gap-1.5 text-xs font-medium mt-2 px-2.5 py-1.5 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-[#8888aa] hover:text-white transition-all"
              >
                <Plus size={12} /> Add milestone
              </button>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

export default function Goals() {
  const { goals, loading, createGoal, deleteGoal, createMilestone, toggleMilestone, createTask, toggleTask } = useGoals()
  const { anthropicKey, aiEnabled } = useAuthStore()

  const [showCreate, setShowCreate] = useState(false)
  const [milestoneModal, setMilestoneModal] = useState<{ goalId: string } | null>(null)
  const [taskModal, setTaskModal] = useState<{ milestoneId: string } | null>(null)
  const [insight, setInsight] = useState<{ goal: string; text: string } | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)

  // Goal form
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [horizon, setHorizon] = useState<GoalHorizon>('monthly')
  const [category, setCategory] = useState<GoalCategory>('personal_growth')
  const [metric, setMetric] = useState('')
  const [deadline, setDeadline] = useState('')

  // Milestone form
  const [mTitle, setMTitle] = useState('')
  const [mDue, setMDue] = useState('')

  // Task form
  const [tTitle, setTTitle] = useState('')

  const handleCreate = async () => {
    if (!title.trim()) return
    await createGoal({ title: title.trim(), description: desc || undefined, horizon, category, success_metric: metric || 'TBD', deadline: deadline || undefined })
    setTitle(''); setDesc(''); setHorizon('monthly'); setCategory('personal_growth'); setMetric(''); setDeadline('')
    setShowCreate(false)
  }

  const handleAddMilestone = async () => {
    if (!milestoneModal || !mTitle.trim()) return
    await createMilestone(milestoneModal.goalId, mTitle.trim(), mDue || undefined)
    setMTitle(''); setMDue('')
    setMilestoneModal(null)
  }

  const handleAddTask = async () => {
    if (!taskModal || !tTitle.trim()) return
    await createTask(taskModal.milestoneId, tTitle.trim())
    setTTitle('')
    setTaskModal(null)
  }

  const fetchInsight = async (goal: GoalWithProgress) => {
    if (!anthropicKey) return
    setInsightLoading(true)
    try {
      const daysOld = Math.floor((Date.now() - new Date(goal.created_at).getTime()) / 86400000)
      const completed = goal.milestones.filter((m) => m.completed_at).length
      const text = await callClaude(buildGoalGapPrompt(goal.title, daysOld, completed, goal.milestones.length, goal.deadline), anthropicKey)
      setInsight({ goal: goal.title, text })
    } catch {
      setInsight({ goal: goal.title, text: 'Failed to load insight.' })
    } finally {
      setInsightLoading(false)
    }
  }

  const byHorizon = (h: GoalHorizon) => goals.filter((g) => g.horizon === h)

  const horizons: { key: GoalHorizon; label: string }[] = [
    { key: 'monthly', label: 'Monthly' },
    { key: 'yearly', label: 'Yearly' },
    { key: '5-year', label: '5-Year Vision' },
  ]

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Goals" subtitle="Monthly · Yearly · 5-Year" accentColor="#f59e0b" />

      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          {horizons.map(({ key, label }) => (
            <Card key={key}>
              <p className="text-xs text-[#8888aa] uppercase tracking-widest mb-1">{label}</p>
              <p className="text-2xl font-black" style={{ color: HORIZON_COLORS[key] }}>{byHorizon(key).length}</p>
              <p className="text-xs text-[#555570] mt-0.5">
                {byHorizon(key).filter((g) => g.progress === 100).length} complete
              </p>
            </Card>
          ))}
        </div>

        {/* Add goal button */}
        <button
          onClick={() => setShowCreate(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-[#2a2a3a] text-[#8888aa] hover:text-white hover:border-[#3a3a50] transition-all text-sm font-medium"
        >
          <Plus size={16} /> Add New Goal
        </button>

        {/* Goals by horizon */}
        {loading ? (
          <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-28 rounded-xl bg-[#111118] border border-[#2a2a3a] animate-pulse" />)}</div>
        ) : goals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Target size={40} className="text-[#2a2a3a] mb-4" />
            <p className="text-[#8888aa] font-medium">No goals yet</p>
            <p className="text-sm text-[#555570] mt-1">Set your first goal to start tracking progress</p>
          </div>
        ) : (
          horizons.map(({ key, label }) => byHorizon(key).length > 0 && (
            <div key={key}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: HORIZON_COLORS[key] }} />
                <h2 className="text-sm font-semibold text-[#8888aa] uppercase tracking-widest">{label}</h2>
              </div>
              <div className="space-y-3">
                {byHorizon(key).map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onDelete={() => deleteGoal(goal.id)}
                    onToggleMilestone={toggleMilestone}
                    onAddMilestone={(id) => setMilestoneModal({ goalId: id })}
                    onToggleTask={toggleTask}
                    onAddTask={(id) => setTaskModal({ milestoneId: id })}
                    onInsight={() => fetchInsight(goal)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create goal modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Goal" size="lg">
        <div className="space-y-4">
          <div>
            <label className="text-sm text-[#8888aa] mb-1.5 block">Goal Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Run a marathon…"
              className="w-full px-3 py-2 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-white text-sm placeholder:text-[#555570] focus:outline-none focus:border-amber-500/60" />
          </div>
          <div>
            <label className="text-sm text-[#8888aa] mb-1.5 block">Description (optional)</label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} placeholder="Why does this goal matter?"
              className="w-full px-3 py-2 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-white text-sm placeholder:text-[#555570] focus:outline-none resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-[#8888aa] mb-1.5 block">Horizon</label>
              <div className="flex flex-col gap-1.5">
                {(['monthly', 'yearly', '5-year'] as GoalHorizon[]).map((h) => (
                  <button key={h} onClick={() => setHorizon(h)}
                    className={`py-1.5 px-3 rounded-lg text-xs font-medium capitalize transition-all text-left border ${
                      horizon === h ? 'text-white border-amber-500/60 bg-amber-500/20' : 'text-[#8888aa] border-[#2a2a3a] bg-[#1a1a24] hover:text-white'
                    }`}
                  >{h}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm text-[#8888aa] mb-1.5 block">Category</label>
              <div className="flex flex-col gap-1.5">
                {(Object.keys(CAT_LABELS) as GoalCategory[]).map((c) => (
                  <button key={c} onClick={() => setCategory(c)}
                    className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-all text-left border ${
                      category === c ? 'text-white border-amber-500/60 bg-amber-500/20' : 'text-[#8888aa] border-[#2a2a3a] bg-[#1a1a24] hover:text-white'
                    }`}
                  >{CAT_LABELS[c]}</button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="text-sm text-[#8888aa] mb-1.5 block">Success Metric *</label>
            <input value={metric} onChange={(e) => setMetric(e.target.value)} placeholder="How will you know you've succeeded?"
              className="w-full px-3 py-2 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-white text-sm placeholder:text-[#555570] focus:outline-none" />
          </div>
          <div>
            <label className="text-sm text-[#8888aa] mb-1.5 block">Deadline (optional)</label>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-white text-sm focus:outline-none" />
          </div>
          <button onClick={handleCreate} disabled={!title.trim()}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 0 20px #f59e0b40' }}
          >Create Goal</button>
        </div>
      </Modal>

      {/* Add milestone modal */}
      <Modal open={!!milestoneModal} onClose={() => setMilestoneModal(null)} title="Add Milestone">
        <div className="space-y-4">
          <input value={mTitle} onChange={(e) => setMTitle(e.target.value)} placeholder="Milestone title…"
            className="w-full px-3 py-2 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-white text-sm placeholder:text-[#555570] focus:outline-none" />
          <input type="date" value={mDue} onChange={(e) => setMDue(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-white text-sm focus:outline-none" />
          <button onClick={handleAddMilestone} disabled={!mTitle.trim()}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 0 20px #f59e0b40' }}
          >Add Milestone</button>
        </div>
      </Modal>

      {/* Add task modal */}
      <Modal open={!!taskModal} onClose={() => setTaskModal(null)} title="Add Weekly Task">
        <div className="space-y-4">
          <input value={tTitle} onChange={(e) => setTTitle(e.target.value)} placeholder="Task title…"
            className="w-full px-3 py-2 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-white text-sm placeholder:text-[#555570] focus:outline-none" />
          <button onClick={handleAddTask} disabled={!tTitle.trim()}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 0 20px #f59e0b40' }}
          >Add Task</button>
        </div>
      </Modal>

      {/* AI insight modal */}
      <Modal open={!!insight || insightLoading} onClose={() => setInsight(null)} title="AI Gap Analysis">
        {insightLoading ? (
          <div className="flex flex-col items-center py-6 gap-3">
            <div className="w-6 h-6 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            <p className="text-sm text-[#8888aa]">Analyzing goal trajectory…</p>
          </div>
        ) : insight ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-amber-400">{insight.goal}</p>
            <div className="p-4 rounded-xl bg-[#1a1a24] border border-amber-500/20">
              <p className="text-sm text-[#f0f0ff] leading-relaxed">{insight.text}</p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
