import { useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts'
import { Brain, Heart, Zap, Flame, AlertTriangle, Plus, Sparkles, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { useEmotional } from '@/hooks/useEmotional'
import { useAuthStore } from '@/stores/authStore'
import { callClaude, buildEmotionalInsightPrompt } from '@/lib/anthropic'
import Topbar from '@/components/layout/Topbar'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import type { EmotionTag, CbtDistortion } from '@/types'

const EMOTION_TAGS: EmotionTag[] = ['Joy', 'Calm', 'Anxious', 'Angry', 'Sad', 'Focused', 'Overwhelmed', 'Grateful']
const EMOTION_COLORS: Record<EmotionTag, string> = {
  Joy: '#f59e0b', Calm: '#22c55e', Anxious: '#ef4444', Angry: '#dc2626',
  Sad: '#fb923c', Focused: '#f97316', Overwhelmed: '#f97316', Grateful: '#a3e635',
}

const CBT_DISTORTIONS: CbtDistortion[] = [
  'Catastrophizing', 'Black-and-White Thinking', 'Mind Reading', 'Fortune Telling',
  'Emotional Reasoning', 'Should Statements', 'Labeling', 'Personalization',
  'Magnification', 'Mental Filter',
]

const GRATITUDE_PROMPTS = [
  'Who made a positive impact on you today?',
  'What small moment brought you comfort?',
  'What ability or skill are you grateful for?',
  'What challenge helped you grow recently?',
  'What part of your environment do you appreciate?',
  'What about your health are you thankful for?',
  'What recent conversation left you feeling good?',
  'What future opportunity excites you?',
  'What habit or routine serves you well?',
  'What do you take for granted that others don\'t have?',
]

const SYMPTOMS = ['Racing heart', 'Tight chest', 'Shallow breathing', 'Sweating', 'Trembling', 'Headache', 'Stomach ache', 'Jaw tension']

type Tab = 'checkin' | 'gratitude' | 'anxiety' | 'cbt'

export default function EmotionalIntelligence() {
  const { checkins, gratitudeLogs, anxietyEvents, cbtLogs, loading, todayCheckin, todayGratitude, gratitudeStreak, logCheckin, logGratitude, logAnxiety, logCbt } = useEmotional()
  const { anthropicKey, aiEnabled } = useAuthStore()
  const [tab, setTab] = useState<Tab>('checkin')

  // Check-in form
  const [mood, setMood] = useState(5)
  const [energy, setEnergy] = useState(5)
  const [tags, setTags] = useState<EmotionTag[]>([])
  const [journal, setJournal] = useState('')

  // Gratitude form
  const [gratEntries, setGratEntries] = useState(['', '', ''])
  const prompts = useMemo(() => {
    const idx = new Date().getDate() % GRATITUDE_PROMPTS.length
    return [
      GRATITUDE_PROMPTS[idx],
      GRATITUDE_PROMPTS[(idx + 1) % GRATITUDE_PROMPTS.length],
      GRATITUDE_PROMPTS[(idx + 2) % GRATITUDE_PROMPTS.length],
    ]
  }, [])

  // Anxiety form
  const [trigger, setTrigger] = useState('')
  const [intensity, setIntensity] = useState(5)
  const [symptoms, setSymptoms] = useState<string[]>([])
  const [coping, setCoping] = useState('')

  // CBT form
  const [negThought, setNegThought] = useState('')
  const [distortions, setDistortions] = useState<CbtDistortion[]>([])
  const [reframe, setReframe] = useState('')

  // AI
  const [insight, setInsight] = useState<string | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)

  // Chart data: mood/energy over time
  const chartData = useMemo(() => checkins.slice().reverse().slice(-14).map((c) => ({
    date: format(new Date(c.logged_at), 'MMM d'),
    mood: c.mood,
    energy: c.energy,
  })), [checkins])

  // CBT distortion frequency
  const distortionFreq = useMemo(() => {
    const freq: Record<string, number> = {}
    for (const log of cbtLogs) for (const d of log.distortions) freq[d] = (freq[d] || 0) + 1
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [cbtLogs])

  const toggleTag = (t: EmotionTag) =>
    setTags((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])
  const toggleSymptom = (s: string) =>
    setSymptoms((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])
  const toggleDistortion = (d: CbtDistortion) =>
    setDistortions((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])

  const submitCheckin = async () => {
    await logCheckin({ mood, energy, emotion_tags: tags, journal_note: journal || undefined })
    setTags([]); setJournal('')
  }

  const submitGratitude = async () => {
    const entries = gratEntries.filter((e) => e.trim())
    if (entries.length === 0) return
    await logGratitude(entries)
    setGratEntries(['', '', ''])
  }

  const submitAnxiety = async () => {
    if (!trigger.trim()) return
    await logAnxiety({ trigger_desc: trigger, intensity, symptoms, coping_used: coping })
    setTrigger(''); setIntensity(5); setSymptoms([]); setCoping('')
  }

  const submitCbt = async () => {
    if (!negThought.trim()) return
    await logCbt({ negative_thought: negThought, distortions, reframe })
    setNegThought(''); setDistortions([]); setReframe('')
  }

  const fetchInsight = async () => {
    if (!anthropicKey || checkins.length === 0) return
    setInsightLoading(true)
    try {
      const summary = checkins.slice(0, 7).map((c) =>
        `${format(new Date(c.logged_at), 'EEE')}: mood ${c.mood}/10, energy ${c.energy}/10, tags: ${c.emotion_tags.join(', ')}`
      ).join('\n')
      const text = await callClaude(buildEmotionalInsightPrompt(summary), anthropicKey)
      setInsight(text)
    } catch {
      setInsight('Failed to load insight. Check API key in Settings.')
    } finally {
      setInsightLoading(false)
    }
  }

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'checkin', label: 'Check-in', icon: Heart },
    { id: 'gratitude', label: 'Gratitude', icon: Zap },
    { id: 'anxiety', label: 'Anxiety Log', icon: AlertTriangle },
    { id: 'cbt', label: 'CBT', icon: Brain },
  ]

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Emotional IQ" subtitle="Daily check-ins, journaling & patterns" accentColor="#f97316" />

      <div className="flex-1 p-6 space-y-5 overflow-y-auto">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <p className="text-xs text-[#8888aa] uppercase tracking-widest mb-1">Avg Mood (7d)</p>
            <p className="text-2xl font-black text-orange-400">
              {checkins.length ? (checkins.slice(0, 7).reduce((s, c) => s + c.mood, 0) / Math.min(checkins.length, 7)).toFixed(1) : '—'}/10
            </p>
          </Card>
          <Card>
            <p className="text-xs text-[#8888aa] uppercase tracking-widest mb-1">Avg Energy (7d)</p>
            <p className="text-2xl font-black text-orange-400">
              {checkins.length ? (checkins.slice(0, 7).reduce((s, c) => s + c.energy, 0) / Math.min(checkins.length, 7)).toFixed(1) : '—'}/10
            </p>
          </Card>
          <Card>
            <p className="text-xs text-[#8888aa] uppercase tracking-widest mb-1">Gratitude Streak</p>
            <div className="flex items-center gap-2">
              <Flame size={18} className={gratitudeStreak > 0 ? 'text-amber-400' : 'text-[#555570]'} fill={gratitudeStreak > 0 ? '#f59e0b' : 'none'} />
              <p className="text-2xl font-black text-white">{gratitudeStreak}d</p>
            </div>
          </Card>
          <Card>
            <p className="text-xs text-[#8888aa] uppercase tracking-widest mb-1">Anxiety Events (7d)</p>
            <p className={`text-2xl font-black ${anxietyEvents.filter((e) => e.logged_at >= new Date(Date.now() - 7 * 86400000).toISOString()).length >= 3 ? 'text-red-400' : 'text-white'}`}>
              {anxietyEvents.filter((e) => e.logged_at >= new Date(Date.now() - 7 * 86400000).toISOString()).length}
            </p>
          </Card>
        </div>

        {/* Mood chart */}
        {chartData.length > 0 && (
          <Card glow="#f97316">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">Mood & Energy Trend</h3>
              {aiEnabled && (
                <button onClick={fetchInsight} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-all">
                  <Sparkles size={12} /> AI Insight
                </button>
              )}
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="moodGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="energyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                <XAxis dataKey="date" tick={{ fill: '#8888aa', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 10]} tick={{ fill: '#8888aa', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 8 }} labelStyle={{ color: '#8888aa' }} />
                <Area type="monotone" dataKey="mood" stroke="#f97316" fill="url(#moodGrad)" strokeWidth={2} name="Mood" />
                <Area type="monotone" dataKey="energy" stroke="#22c55e" fill="url(#energyGrad)" strokeWidth={2} name="Energy" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* AI insight */}
        {(insightLoading || insight) && (
          <Card className="border-amber-500/20 bg-amber-500/5">
            <div className="flex items-start gap-3">
              <Sparkles size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-400 mb-1">AI Mentor Insight</p>
                {insightLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                    <p className="text-sm text-[#8888aa]">Analyzing…</p>
                  </div>
                ) : (
                  <p className="text-sm text-[#f0f0ff] leading-relaxed">{insight}</p>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Tab navigation */}
        <div className="flex gap-1 p-1 rounded-xl bg-[#1a1a24] border border-[#2a2a3a]">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                tab === id ? 'bg-[#2a2a3a] text-white' : 'text-[#8888aa] hover:text-white'
              }`}
            >
              <Icon size={13} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'checkin' && (
          <Card glow="#f97316">
            {todayCheckin ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <Heart size={12} className="text-orange-400" />
                  </div>
                  <p className="text-sm font-semibold text-white">Today's check-in complete</p>
                </div>
                <div className="flex gap-4">
                  <div className="p-3 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] flex-1 text-center">
                    <p className="text-xs text-[#8888aa]">Mood</p>
                    <p className="text-2xl font-black text-orange-400">{todayCheckin.mood}/10</p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] flex-1 text-center">
                    <p className="text-xs text-[#8888aa]">Energy</p>
                    <p className="text-2xl font-black text-emerald-400">{todayCheckin.energy}/10</p>
                  </div>
                </div>
                {todayCheckin.emotion_tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {todayCheckin.emotion_tags.map((t) => (
                      <Badge key={t} color={EMOTION_COLORS[t]}>{t}</Badge>
                    ))}
                  </div>
                )}
                {todayCheckin.journal_note && (
                  <p className="text-sm text-[#8888aa] italic">"{todayCheckin.journal_note}"</p>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                <h3 className="font-semibold text-white">Daily Check-in</h3>

                {/* Mood slider */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm text-[#8888aa]">Mood</label>
                    <span className="text-sm font-bold text-orange-400">{mood}/10</span>
                  </div>
                  <input type="range" min={1} max={10} value={mood} onChange={(e) => setMood(+e.target.value)}
                    className="w-full" style={{ accentColor: '#f97316' }} />
                  <div className="flex justify-between text-xs text-[#555570] mt-1"><span>Terrible</span><span>Amazing</span></div>
                </div>

                {/* Energy slider */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm text-[#8888aa]">Energy</label>
                    <span className="text-sm font-bold text-emerald-400">{energy}/10</span>
                  </div>
                  <input type="range" min={1} max={10} value={energy} onChange={(e) => setEnergy(+e.target.value)}
                    className="w-full" style={{ accentColor: '#22c55e' }} />
                  <div className="flex justify-between text-xs text-[#555570] mt-1"><span>Drained</span><span>Electric</span></div>
                </div>

                {/* Emotion tags */}
                <div>
                  <label className="text-sm text-[#8888aa] mb-2 block">How are you feeling?</label>
                  <div className="flex flex-wrap gap-2">
                    {EMOTION_TAGS.map((t) => (
                      <button key={t} onClick={() => toggleTag(t)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium transition-all border"
                        style={{
                          borderColor: tags.includes(t) ? EMOTION_COLORS[t] : '#2a2a3a',
                          background: tags.includes(t) ? `${EMOTION_COLORS[t]}20` : '#1a1a24',
                          color: tags.includes(t) ? EMOTION_COLORS[t] : '#8888aa',
                        }}
                      >{t}</button>
                    ))}
                  </div>
                </div>

                {/* Journal */}
                <div>
                  <label className="text-sm text-[#8888aa] mb-1.5 block">Journal (optional, 1-2 sentences)</label>
                  <textarea
                    value={journal} onChange={(e) => setJournal(e.target.value)}
                    placeholder="What's on your mind today?"
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-white text-sm placeholder:text-[#555570] focus:outline-none resize-none"
                  />
                </div>

                <button onClick={submitCheckin}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all"
                  style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', boxShadow: '0 0 20px #f9731640' }}
                >
                  Submit Check-in
                </button>
              </div>
            )}
          </Card>
        )}

        {tab === 'gratitude' && (
          <Card glow="#f97316">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">Gratitude Log</h3>
              <div className="flex items-center gap-2">
                <Flame size={14} className={gratitudeStreak > 0 ? 'text-amber-400' : 'text-[#555570]'} fill={gratitudeStreak > 0 ? '#f59e0b' : 'none'} />
                <span className="text-sm font-bold text-amber-400">{gratitudeStreak}d streak</span>
              </div>
            </div>

            {todayGratitude ? (
              <div className="space-y-2">
                <p className="text-sm text-emerald-400 font-medium">Today's gratitude logged ✓</p>
                {todayGratitude.entries.map((e, i) => (
                  <p key={i} className="text-sm text-[#f0f0ff] py-2 border-b border-[#2a2a3a] last:border-0">{e}</p>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {prompts.map((prompt, i) => (
                  <div key={i}>
                    <label className="text-xs text-[#8888aa] mb-1 block">{prompt}</label>
                    <input
                      value={gratEntries[i]}
                      onChange={(e) => setGratEntries((prev) => { const n = [...prev]; n[i] = e.target.value; return n })}
                      placeholder="I'm grateful for…"
                      className="w-full px-3 py-2 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-white text-sm placeholder:text-[#555570] focus:outline-none"
                    />
                  </div>
                ))}
                <button onClick={submitGratitude}
                  disabled={gratEntries.every((e) => !e.trim())}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40 transition-all"
                  style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', boxShadow: '0 0 20px #f9731640' }}
                >Log Gratitude</button>
              </div>
            )}
          </Card>
        )}

        {tab === 'anxiety' && (
          <div className="space-y-4">
            <Card glow="#ef4444">
              <h3 className="font-semibold text-white mb-4">Log Anxiety / Anger Event</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-[#8888aa] mb-1.5 block">Trigger Description *</label>
                  <textarea value={trigger} onChange={(e) => setTrigger(e.target.value)}
                    placeholder="What triggered this reaction?"
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-white text-sm placeholder:text-[#555570] focus:outline-none resize-none"
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm text-[#8888aa]">Intensity</label>
                    <span className="text-sm font-bold text-red-400">{intensity}/10</span>
                  </div>
                  <input type="range" min={1} max={10} value={intensity} onChange={(e) => setIntensity(+e.target.value)}
                    className="w-full" style={{ accentColor: '#ef4444' }} />
                </div>
                <div>
                  <label className="text-sm text-[#8888aa] mb-2 block">Physical Symptoms</label>
                  <div className="flex flex-wrap gap-2">
                    {SYMPTOMS.map((s) => (
                      <button key={s} onClick={() => toggleSymptom(s)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                          symptoms.includes(s) ? 'bg-red-500/20 border-red-500/60 text-red-300' : 'bg-[#1a1a24] border-[#2a2a3a] text-[#8888aa] hover:text-white'
                        }`}
                      >{s}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-[#8888aa] mb-1.5 block">Coping Used</label>
                  <input value={coping} onChange={(e) => setCoping(e.target.value)}
                    placeholder="e.g. Deep breathing, walked away, journaled…"
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-white text-sm placeholder:text-[#555570] focus:outline-none"
                  />
                </div>
                <button onClick={submitAnxiety} disabled={!trigger.trim()}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 0 20px #ef444440' }}
                >Log Event</button>
              </div>
            </Card>

            {anxietyEvents.length > 0 && (
              <Card>
                <h3 className="font-semibold text-white mb-3">Recent Events</h3>
                <div className="space-y-2">
                  {anxietyEvents.slice(0, 5).map((e) => (
                    <div key={e.id} className="flex items-start gap-3 py-2 border-b border-[#2a2a3a] last:border-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `rgba(239,68,68,${e.intensity / 10 * 0.3})`, border: '1px solid #ef444430' }}>
                        <span className="text-xs font-bold text-red-400">{e.intensity}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#f0f0ff] truncate">{e.trigger_desc}</p>
                        <p className="text-xs text-[#555570]">{format(new Date(e.logged_at), 'MMM d, h:mm a')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {tab === 'cbt' && (
          <div className="space-y-4">
            <Card glow="#f97316">
              <h3 className="font-semibold text-white mb-4">Cognitive Distortion Spotter</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-[#8888aa] mb-1.5 block">Negative Thought *</label>
                  <textarea value={negThought} onChange={(e) => setNegThought(e.target.value)}
                    placeholder="Write the thought exactly as it appeared…"
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-white text-sm placeholder:text-[#555570] focus:outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-[#8888aa] mb-2 block">Distortions Present</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CBT_DISTORTIONS.map((d) => (
                      <button key={d} onClick={() => toggleDistortion(d)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition-all border ${
                          distortions.includes(d) ? 'bg-orange-500/20 border-orange-500/60 text-orange-300' : 'bg-[#1a1a24] border-[#2a2a3a] text-[#8888aa] hover:text-white'
                        }`}
                      >{d}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-[#8888aa] mb-1.5 block">Reframe — write a balanced version</label>
                  <textarea value={reframe} onChange={(e) => setReframe(e.target.value)}
                    placeholder="A more balanced way to see this is…"
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-white text-sm placeholder:text-[#555570] focus:outline-none resize-none"
                  />
                </div>
                <button onClick={submitCbt} disabled={!negThought.trim()}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', boxShadow: '0 0 20px #f9731640' }}
                >Log CBT Entry</button>
              </div>
            </Card>

            {distortionFreq.length > 0 && (
              <Card>
                <h3 className="font-semibold text-white mb-4">Top Distortions</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={distortionFreq.map(([name, count]) => ({ name: name.split(' ')[0], count }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                    <XAxis dataKey="name" tick={{ fill: '#8888aa', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#8888aa', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 8 }} labelStyle={{ color: '#8888aa' }} />
                    <Bar dataKey="count" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
