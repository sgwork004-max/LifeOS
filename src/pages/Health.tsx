import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { Activity, Plus, Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { useHealth } from '@/hooks/useHealth'
import { useAuthStore } from '@/stores/authStore'
import { callClaude, buildHealthInsightPrompt } from '@/lib/anthropic'
import Topbar from '@/components/layout/Topbar'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'

const PERIODS = [7, 30, 90] as const

function bmi(weight: number, heightCm: number = 175): number {
  const h = heightCm / 100
  return Math.round((weight / (h * h)) * 10) / 10
}

function bmiCategory(b: number): { label: string; color: string } {
  if (b < 18.5) return { label: 'Underweight', color: '#f97316' }
  if (b < 25) return { label: 'Normal', color: '#22c55e' }
  if (b < 30) return { label: 'Overweight', color: '#f59e0b' }
  return { label: 'Obese', color: '#ef4444' }
}

// Moving average
function movingAvg(data: number[], window: number = 7): (number | null)[] {
  return data.map((_, i) => {
    if (i < window - 1) return null
    const slice = data.slice(i - window + 1, i + 1)
    return Math.round((slice.reduce((a, b) => a + b, 0) / window) * 100) / 100
  })
}

export default function Health() {
  const { logs, loading, logToday, todayLog } = useHealth()
  const { anthropicKey, aiEnabled } = useAuthStore()
  const [period, setPeriod] = useState<typeof PERIODS[number]>(30)
  const [showLog, setShowLog] = useState(false)
  const [insight, setInsight] = useState<string | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)

  // Form
  const [weight, setWeight] = useState('')
  const [fat, setFat] = useState('')
  const [notes, setNotes] = useState('')

  // Chart data
  const chartData = useMemo(() => {
    const cutoff = subDays(new Date(), period)
    const filtered = logs
      .filter((l) => new Date(l.logged_at) >= cutoff)
      .reverse()
    const weights = filtered.map((l) => l.weight_kg)
    const avgs = movingAvg(weights, Math.min(7, filtered.length))
    return filtered.map((l, i) => ({
      date: format(new Date(l.logged_at), 'MMM d'),
      weight: l.weight_kg,
      ma: avgs[i],
      fat: l.body_fat_pct ?? null,
    }))
  }, [logs, period])

  const latest = logs[0]
  const prev = logs[1]
  const delta = latest && prev ? Math.round((latest.weight_kg - prev.weight_kg) * 100) / 100 : 0
  const weekDelta = useMemo(() => {
    const weekAgo = logs.find((l) => new Date(l.logged_at) <= subDays(new Date(), 7))
    if (!latest || !weekAgo) return 0
    return Math.round((latest.weight_kg - weekAgo.weight_kg) * 100) / 100
  }, [logs])
  const bmiVal = latest ? bmi(latest.weight_kg) : null
  const bmiInfo = bmiVal ? bmiCategory(bmiVal) : null

  const handleLog = async () => {
    if (!weight) return
    await logToday(parseFloat(weight), fat ? parseFloat(fat) : undefined, notes || undefined)
    setWeight(''); setFat(''); setNotes('')
    setShowLog(false)
  }

  const fetchInsight = async () => {
    if (!anthropicKey || logs.length === 0) return
    setInsightLoading(true)
    try {
      const summary = logs.slice(0, 14).map((l) => `${format(new Date(l.logged_at), 'MMM d')}: ${l.weight_kg}kg`).join(', ')
      const text = await callClaude(buildHealthInsightPrompt(summary), anthropicKey)
      setInsight(text)
    } catch {
      setInsight('Failed to load insight. Check your API key in Settings.')
    } finally {
      setInsightLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Health" subtitle="Body metrics & trends" accentColor="#22c55e" />

      <div className="flex-1 p-6 space-y-5 overflow-y-auto">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <p className="text-xs text-[#8888aa] uppercase tracking-widest mb-1">Current Weight</p>
            <p className="text-2xl font-black text-white">{latest ? `${latest.weight_kg}kg` : '—'}</p>
            {delta !== 0 && (
              <div className={`flex items-center gap-1 text-xs mt-1 ${delta > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {delta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {delta > 0 ? '+' : ''}{delta}kg from last
              </div>
            )}
          </Card>
          <Card>
            <p className="text-xs text-[#8888aa] uppercase tracking-widest mb-1">7-Day Delta</p>
            <p className={`text-2xl font-black ${weekDelta > 1 ? 'text-red-400' : weekDelta < -0.5 ? 'text-emerald-400' : 'text-white'}`}>
              {weekDelta > 0 ? '+' : ''}{weekDelta}kg
            </p>
            {weekDelta > 1 && <p className="text-xs text-red-400 mt-1">⚠ Above 1kg threshold</p>}
          </Card>
          <Card>
            <p className="text-xs text-[#8888aa] uppercase tracking-widest mb-1">BMI</p>
            {bmiVal && bmiInfo ? (
              <>
                <p className="text-2xl font-black" style={{ color: bmiInfo.color }}>{bmiVal}</p>
                <p className="text-xs mt-1" style={{ color: bmiInfo.color }}>{bmiInfo.label}</p>
              </>
            ) : (
              <p className="text-2xl font-black text-white">—</p>
            )}
          </Card>
          <Card>
            <p className="text-xs text-[#8888aa] uppercase tracking-widest mb-1">Body Fat</p>
            <p className="text-2xl font-black text-white">
              {latest?.body_fat_pct ? `${latest.body_fat_pct}%` : '—'}
            </p>
          </Card>
        </div>

        {/* Chart */}
        <Card glow="#22c55e">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Weight Trend</h3>
            <div className="flex items-center gap-3">
              {aiEnabled && (
                <button
                  onClick={fetchInsight}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-all"
                >
                  <Sparkles size={12} /> AI Insight
                </button>
              )}
              <div className="flex gap-1">
                {PERIODS.map((p) => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                      period === p ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40' : 'text-[#555570] hover:text-[#8888aa]'
                    }`}
                  >{p}d</button>
                ))}
              </div>
              <button
                onClick={() => setShowLog(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 text-xs font-medium"
              >
                <Plus size={12} /> Log
              </button>
            </div>
          </div>

          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                <XAxis dataKey="date" tick={{ fill: '#8888aa', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fill: '#8888aa', fontSize: 11 }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `${v}kg`}
                />
                <Tooltip
                  contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 8 }}
                  labelStyle={{ color: '#8888aa' }}
                  itemStyle={{ color: '#f0f0ff' }}
                  formatter={(v) => [`${v}kg`]}
                />
                <Line type="monotone" dataKey="weight" stroke="#22c55e" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="ma" stroke="#22c55e50" strokeWidth={2} dot={false} strokeDasharray="5 3" name="7d avg" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-[#555570]">
              <Activity size={32} className="mb-2" />
              <p className="text-sm">Log more data to see your trend</p>
            </div>
          )}

          {/* BMI gauge */}
          {bmiVal && (
            <div className="mt-4 p-3 rounded-lg bg-[#1a1a24] border border-[#2a2a3a]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[#8888aa]">BMI Gauge</span>
                <span className="text-xs font-bold" style={{ color: bmiInfo?.color }}>{bmiInfo?.label}</span>
              </div>
              <div className="relative h-2 rounded-full" style={{ background: 'linear-gradient(90deg, #f97316, #22c55e, #f59e0b, #ef4444)' }}>
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-white shadow"
                  style={{ left: `${Math.min(Math.max(((bmiVal - 15) / 25) * 100, 0), 100)}%`, transform: 'translate(-50%,-50%)' }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-[#555570] mt-1">
                <span>15</span><span>18.5</span><span>25</span><span>30</span><span>40</span>
              </div>
            </div>
          )}
        </Card>

        {/* AI Insight */}
        {insight && (
          <Card className="border-amber-500/20 bg-amber-500/5">
            <div className="flex items-start gap-3">
              <Sparkles size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-400 mb-1">AI Insight</p>
                <p className="text-sm text-[#f0f0ff] leading-relaxed">{insight}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Log history */}
        <Card>
          <h3 className="font-semibold text-white mb-3">Recent Logs</h3>
          {logs.length === 0 ? (
            <p className="text-sm text-[#555570]">No logs yet. Log your weight to start tracking.</p>
          ) : (
            <div className="space-y-2">
              {logs.slice(0, 10).map((l) => (
                <div key={l.id} className="flex items-center justify-between py-2 border-b border-[#2a2a3a] last:border-0">
                  <span className="text-sm text-[#8888aa]">{format(new Date(l.logged_at), 'MMM d, yyyy')}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold text-white">{l.weight_kg}kg</span>
                    {l.body_fat_pct && <span className="text-xs text-[#8888aa]">{l.body_fat_pct}% fat</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Log modal */}
      <Modal open={showLog} onClose={() => setShowLog(false)} title="Log Health Data">
        <div className="space-y-4">
          <div>
            <label className="text-sm text-[#8888aa] mb-1.5 block">Weight (kg) *</label>
            <input
              type="number" step="0.1" min="30" max="300"
              value={weight} onChange={(e) => setWeight(e.target.value)}
              placeholder="e.g. 75.5"
              className="w-full px-3 py-2 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-white text-sm placeholder:text-[#555570] focus:outline-none focus:border-emerald-500/60"
            />
          </div>
          <div>
            <label className="text-sm text-[#8888aa] mb-1.5 block">Body Fat % (optional)</label>
            <input
              type="number" step="0.1" min="3" max="50"
              value={fat} onChange={(e) => setFat(e.target.value)}
              placeholder="e.g. 18.5"
              className="w-full px-3 py-2 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-white text-sm placeholder:text-[#555570] focus:outline-none focus:border-emerald-500/60"
            />
          </div>
          <div>
            <label className="text-sm text-[#8888aa] mb-1.5 block">Notes (optional)</label>
            <input
              value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Any relevant context…"
              className="w-full px-3 py-2 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-white text-sm placeholder:text-[#555570] focus:outline-none"
            />
          </div>
          <button
            onClick={handleLog}
            disabled={!weight}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40 transition-all"
            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 0 20px #22c55e40' }}
          >
            Log Entry
          </button>
        </div>
      </Modal>
    </div>
  )
}
