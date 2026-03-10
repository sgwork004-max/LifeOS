import { useState } from 'react'
import { CheckCircle, Zap, Flame, Activity, Target, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

const STEPS = [
  { id: 1, title: 'Welcome to LifeOS', icon: Zap },
  { id: 2, title: 'Your First Habit', icon: Flame },
  { id: 3, title: 'Baseline Health', icon: Activity },
  { id: 4, title: 'Your First Goal', icon: Target },
  { id: 5, title: "You're ready", icon: CheckCircle },
]

const HABIT_CATEGORIES = ['Fitness', 'Mindfulness', 'Learning', 'Nutrition', 'Sleep', 'Other']

export default function Onboarding() {
  const { user, setOnboardingComplete } = useAuthStore()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 2 state
  const [habitName, setHabitName] = useState('')
  const [habitCat, setHabitCat] = useState('Fitness')
  const [habitWeight, setHabitWeight] = useState(3)

  // Step 3 state
  const [weight, setWeight] = useState('')

  // Step 4 state
  const [goalTitle, setGoalTitle] = useState('')
  const [goalHorizon, setGoalHorizon] = useState<'monthly' | 'yearly' | '5-year'>('monthly')
  const [goalMetric, setGoalMetric] = useState('')

  const progress = ((step - 1) / (STEPS.length - 1)) * 100

  const next = async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      if (step === 2 && habitName.trim()) {
        const { error: e } = await supabase.from('habits').insert({
          user_id: user.id,
          name: habitName.trim(),
          category: habitCat,
          frequency: 'daily',
          importance_weight: habitWeight,
          color: '#84cc16',
        })
        if (e) { setError(`Failed to save habit: ${e.message}. Have you run the SQL migrations in Supabase?`); return }
      }
      if (step === 3 && weight) {
        const { error: e } = await supabase.from('health_logs').insert({
          user_id: user.id,
          weight_kg: parseFloat(weight),
          notes: 'Onboarding baseline',
        })
        if (e) { setError(`Failed to save health log: ${e.message}. Have you run the SQL migrations in Supabase?`); return }
      }
      if (step === 4 && goalTitle.trim()) {
        const { error: e } = await supabase.from('goals').insert({
          user_id: user.id,
          title: goalTitle.trim(),
          horizon: goalHorizon,
          category: 'personal_growth',
          success_metric: goalMetric || 'Define measurable outcome',
        })
        if (e) { setError(`Failed to save goal: ${e.message}. Have you run the SQL migrations in Supabase?`); return }
      }
      if (step === 5) {
        // Write to user metadata first (survives refresh without DB tables)
        await supabase.auth.updateUser({ data: { onboarding_complete: true } })
        // Also persist to user_profiles table (may fail if migrations not run, non-fatal)
        await supabase.from('user_profiles').upsert({ id: user.id, onboarding_complete: true })
        setOnboardingComplete(true)
        return
      }
      setStep((s) => s + 1)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const skip = () => setStep((s) => Math.min(s + 1, STEPS.length))

  const canContinue = () => {
    if (step === 2) return habitName.trim().length > 0
    if (step === 3) return weight.length > 0 && !isNaN(parseFloat(weight))
    if (step === 4) return goalTitle.trim().length > 0
    return true
  }

  const currentStep = STEPS[step - 1]

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 0%, #84cc1610 0%, transparent 70%)',
        }}
      />
      <div className="relative w-full max-w-[520px] animate-fade-in">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            {STEPS.map((s) => (
              <div
                key={s.id}
                className="flex flex-col items-center gap-1"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    s.id < step
                      ? 'bg-lime-600 text-white'
                      : s.id === step
                      ? 'bg-lime-600/30 border-2 border-lime-500 text-lime-400'
                      : 'bg-[#1a1a24] border border-[#2a2a3a] text-[#555570]'
                  }`}
                >
                  {s.id < step ? <CheckCircle size={14} /> : s.id}
                </div>
              </div>
            ))}
          </div>
          <div className="relative h-1 bg-[#2a2a3a] rounded-full">
            <div
              className="absolute left-0 top-0 h-1 rounded-full bg-lime-600 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-[#555570] mt-1 text-right">
            Step {step} of {STEPS.length}
          </p>
        </div>

        <div className="rounded-2xl border border-[#2a2a3a] bg-[#111118] p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-lime-600/20 flex items-center justify-center">
              <currentStep.icon size={20} className="text-lime-400" />
            </div>
            <h2 className="text-xl font-bold text-white">{currentStep.title}</h2>
          </div>

          {/* Step content */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-[#8888aa] leading-relaxed">
                LifeOS is your personal life operating system. It tracks habits, health, emotions, and goals — then acts as a data-driven mentor that tells you exactly where you're winning and where you're failing.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Habit Tracking', color: '#84cc16' },
                  { label: 'Health Metrics', color: '#22c55e' },
                  { label: 'Emotional IQ', color: '#f97316' },
                  { label: 'Goal System', color: '#f59e0b' },
                ].map(({ label, color }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 p-3 rounded-lg bg-[#1a1a24] border border-[#2a2a3a]"
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-sm text-[#f0f0ff]">{label}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-[#555570]">
                Setup takes under 3 minutes. Let's go.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-[#8888aa]">
                What's one habit you want to build consistently? Start with your most important one.
              </p>
              <input
                type="text"
                placeholder="e.g. Morning workout, Meditate, Read 20 pages…"
                value={habitName}
                onChange={(e) => setHabitName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-white text-sm placeholder:text-[#555570] focus:outline-none focus:border-lime-500/60 transition-colors"
              />
              <div>
                <label className="text-sm text-[#8888aa] mb-2 block">Category</label>
                <div className="flex flex-wrap gap-2">
                  {HABIT_CATEGORIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setHabitCat(c)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        habitCat === c
                          ? 'bg-lime-600/30 border border-lime-500/60 text-lime-300'
                          : 'bg-[#1a1a24] border border-[#2a2a3a] text-[#8888aa] hover:text-white'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm text-[#8888aa] mb-2 block">
                  Importance (1 = nice to have, 5 = non-negotiable)
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((w) => (
                    <button
                      key={w}
                      onClick={() => setHabitWeight(w)}
                      className={`w-9 h-9 rounded-lg text-sm font-bold transition-all ${
                        habitWeight === w
                          ? 'bg-lime-600 text-white'
                          : 'bg-[#1a1a24] border border-[#2a2a3a] text-[#8888aa] hover:text-white'
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-[#8888aa]">
                Log your baseline weight to start tracking your health trend.
              </p>
              <div>
                <label className="text-sm text-[#8888aa] mb-1.5 block">Current Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  min="30"
                  max="300"
                  placeholder="e.g. 75.5"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-white text-sm placeholder:text-[#555570] focus:outline-none focus:border-emerald-500/60 transition-colors"
                />
              </div>
              <p className="text-xs text-[#555570]">
                Don't worry — you can log weight anytime. This is just your starting point.
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-[#8888aa]">
                Set one meaningful goal. LifeOS will track your progress and call out stalling.
              </p>
              <input
                type="text"
                placeholder="e.g. Run a 5K, Get promoted, Save $10k…"
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-white text-sm placeholder:text-[#555570] focus:outline-none focus:border-amber-500/60 transition-colors"
              />
              <div>
                <label className="text-sm text-[#8888aa] mb-2 block">Time Horizon</label>
                <div className="flex gap-2">
                  {(['monthly', 'yearly', '5-year'] as const).map((h) => (
                    <button
                      key={h}
                      onClick={() => setGoalHorizon(h)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                        goalHorizon === h
                          ? 'bg-amber-600/30 border border-amber-500/60 text-amber-300'
                          : 'bg-[#1a1a24] border border-[#2a2a3a] text-[#8888aa] hover:text-white'
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="text"
                placeholder="Success looks like… (measurable outcome)"
                value={goalMetric}
                onChange={(e) => setGoalMetric(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-white text-sm placeholder:text-[#555570] focus:outline-none focus:border-amber-500/60 transition-colors"
              />
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-600/20 flex items-center justify-center mx-auto">
                <CheckCircle size={32} className="text-emerald-400" />
              </div>
              <p className="text-[#8888aa] leading-relaxed">
                Your foundation is set. LifeOS is now tracking your life. Check in daily — the data is only useful if you feed it consistently.
              </p>
              <div className="p-3 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-sm text-[#8888aa]">
                <strong className="text-white">Pro tip:</strong> Hit the "Daily Check-in" button every day. Your weekly report will be ready every Sunday.
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-4">
            {step > 1 && step < 5 && (
              <button
                onClick={skip}
                className="flex-1 py-2.5 rounded-lg text-sm text-[#8888aa] hover:text-white bg-[#1a1a24] border border-[#2a2a3a] transition-all"
              >
                Skip
              </button>
            )}
            <button
              onClick={next}
              disabled={!canContinue() || loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, #84cc16, #65a30d)',
                boxShadow: '0 0 20px #84cc1640',
              }}
            >
              {loading
                ? 'Saving…'
                : step === 5
                ? 'Enter LifeOS'
                : (
                  <>
                    Continue <ArrowRight size={15} />
                  </>
                )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
