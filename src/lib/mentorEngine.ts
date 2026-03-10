/* LifeOS AI Mentor Engine
 * Generates a daily proactive insight (pattern, motivation, prompt to act).
 * If an Anthropic key is configured it calls Claude; otherwise falls back
 * to a deterministic rule-based insight so the feature always works.
 */

import { callClaude } from '@/lib/anthropic'
import { today } from '@/lib/supabase'
import type { HabitWithStats, HealthLog, EmotionalCheckin, GoalWithProgress } from '@/types'

export interface MentorInsight {
  title: string
  body: string
  type: 'pattern' | 'motivation' | 'prompt' | 'observation'
  url: string
  generatedAt: string
}

const STORAGE_KEY_INSIGHT = 'lifeos_mentor_insight'
const STORAGE_KEY_RUN     = 'lifeos_mentor_run'

/* Return cached insight for today if it exists */
export function getCachedInsight(): MentorInsight | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_INSIGHT)
    if (!raw) return null
    const ins: MentorInsight = JSON.parse(raw)
    if (ins.generatedAt === today()) return ins
  } catch { /* ignore */ }
  return null
}

interface EngineData {
  habits: HabitWithStats[]
  healthLogs: HealthLog[]
  checkins: EmotionalCheckin[]
  goals: GoalWithProgress[]
  anthropicKey: string
  aiEnabled: boolean
}

export async function runMentorEngine(data: EngineData): Promise<MentorInsight | null> {
  // Only run once per day
  if (localStorage.getItem(STORAGE_KEY_RUN) === today()) return getCachedInsight()

  const insight = data.aiEnabled && data.anthropicKey
    ? await aiInsight(data)
    : ruleBasedInsight(data)

  if (!insight) return null

  localStorage.setItem(STORAGE_KEY_INSIGHT, JSON.stringify(insight))
  localStorage.setItem(STORAGE_KEY_RUN, today())
  return insight
}

/* ── AI-powered insight ──────────────────────────────────────────────── */
async function aiInsight(data: EngineData): Promise<MentorInsight | null> {
  const completedToday = data.habits.filter(h =>
    h.logs?.some(l => l.logged_at?.startsWith(today()))
  ).length

  const avgMood = data.checkins.length
    ? Math.round(data.checkins.slice(0, 7).reduce((s, c) => s + c.mood, 0) / Math.min(data.checkins.length, 7))
    : null

  const activeGoals = data.goals.filter(g => g.progress < 100).length

  const prompt = `You are the LifeOS AI Mentor — a direct, insightful coach. Based on the data below, give ONE proactive message (2-3 sentences max). Alternate between: catching a pattern, offering motivation, asking a provocative question, or giving a concrete micro-action. Be specific, personal, and a bit challenging. Never be generic.

Data:
- Habits completed today: ${completedToday} / ${data.habits.length}
- Average mood this week: ${avgMood ?? 'no data'}/10
- Active goals: ${activeGoals}
- Recent habit names: ${data.habits.slice(0, 4).map(h => h.name).join(', ') || 'none'}

Reply as JSON ONLY:
{"title":"<short punchy title>","body":"<2-3 sentence insight>","type":"pattern|motivation|prompt|observation","url":"/"}`

  try {
    const raw = await callClaude(prompt, data.anthropicKey)
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
    return { ...parsed, generatedAt: today() }
  } catch {
    return ruleBasedInsight(data)
  }
}

/* ── Rule-based fallback (no API key needed) ─────────────────────────── */
function ruleBasedInsight(data: EngineData): MentorInsight {
  const completedToday = data.habits.filter(h =>
    h.logs?.some(l => l.logged_at?.startsWith(today()))
  ).length
  const total = data.habits.length

  const recentMoods = data.checkins.slice(0, 5).map(c => c.mood)
  const avgMood = recentMoods.length
    ? recentMoods.reduce((a, b) => a + b, 0) / recentMoods.length
    : null

  const insights: MentorInsight[] = [
    {
      title: completedToday === total && total > 0 ? '🔥 Perfect day so far' : '⚡ Push to the finish',
      body: completedToday === total && total > 0
        ? `You've completed all ${total} habits today. That's compound interest on your future self. Keep the streak going.`
        : `${completedToday} of ${total} habits done. The gap between who you are and who you want to be closes one habit at a time. What's stopping the rest?`,
      type: 'motivation',
      url: '/habits',
      generatedAt: today(),
    },
    {
      title: avgMood !== null ? (avgMood >= 7 ? '😊 Your energy is high' : '🌧️ Low tide detected') : '📊 Start tracking your mood',
      body: avgMood !== null
        ? avgMood >= 7
          ? `Your average mood this week is ${avgMood.toFixed(1)}/10. High-energy periods are the best time to tackle hard goals. What's the one big thing you've been avoiding?`
          : `Average mood of ${avgMood.toFixed(1)}/10 this week suggests something needs attention. Are you sleeping enough? Moving your body? Being honest with yourself?`
        : 'Daily emotional check-ins create self-awareness. Log your first mood today and watch patterns emerge over time.',
      type: avgMood !== null ? 'observation' : 'prompt',
      url: '/emotional',
      generatedAt: today(),
    },
    {
      title: '🎯 Goals need weekly fuel',
      body: `Goals without weekly action are just wishes. Open your goals page now and add one concrete task for this week — something small enough to do today.`,
      type: 'prompt',
      url: '/goals',
      generatedAt: today(),
    },
  ]

  const idx = new Date().getDay() % insights.length
  return insights[idx]
}
