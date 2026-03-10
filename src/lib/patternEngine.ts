import type { HabitWithStats, HealthLog, AnxietyEvent, GoalWithProgress, PatternAlert } from '@/types'
import { supabase, daysAgo, today } from './supabase'

// Check all pattern rules and upsert alerts
export async function runPatternEngine(userId: string, data: {
  habits: HabitWithStats[]
  healthLogs: HealthLog[]
  anxietyEvents: AnxietyEvent[]
  goals: GoalWithProgress[]
}) {
  const alerts: Omit<PatternAlert, 'id' | 'user_id' | 'dismissed' | 'created_at'>[] = []

  // ─── Habit rules ────────────────────────────────────────────────────────
  for (const habit of data.habits) {
    // Rule: missed 3 days in a row
    const last3 = habit.logs
      .map((l) => l.completed_at.slice(0, 10))
      .filter((d) => {
        const date = new Date(d)
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - 3)
        return date >= cutoff
      })
    const last3Unique = new Set(last3)
    if (last3Unique.size < 3 && habit.current_streak === 0) {
      alerts.push({
        layer: 'habits',
        alert_type: 'missed_3_days',
        data_summary: `"${habit.name}" has been missed for 3+ consecutive days. Completion this month: ${habit.completion_30d}%.`,
      })
    }
  }

  // ─── Health rules ────────────────────────────────────────────────────────
  if (data.healthLogs.length >= 2) {
    const sorted = [...data.healthLogs].sort(
      (a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime(),
    )
    const latest = sorted[0]
    const sevenDaysAgo = sorted.find(
      (l) => new Date(l.logged_at) <= new Date(daysAgo(7)),
    )
    if (sevenDaysAgo && latest.weight_kg - sevenDaysAgo.weight_kg > 1) {
      const delta = (latest.weight_kg - sevenDaysAgo.weight_kg).toFixed(1)
      alerts.push({
        layer: 'health',
        alert_type: 'weight_spike',
        data_summary: `Weight increased ${delta}kg over the last 7 days (${sevenDaysAgo.weight_kg}kg → ${latest.weight_kg}kg). This is above the 1kg threshold.`,
      })
    }
  }

  // ─── Anxiety/Anger rules ─────────────────────────────────────────────────
  const last7daysAnxiety = data.anxietyEvents.filter(
    (e) => e.logged_at >= daysAgo(7),
  )
  if (last7daysAnxiety.length >= 3) {
    // Simple keyword extraction from trigger descriptions
    const words = last7daysAnxiety
      .flatMap((e) => e.trigger_desc.toLowerCase().split(/\s+/))
      .filter((w) => w.length > 4)
    const freq: Record<string, number> = {}
    for (const w of words) freq[w] = (freq[w] || 0) + 1
    const topWord = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]
    alerts.push({
      layer: 'emotional',
      alert_type: 'anxiety_pattern',
      data_summary: `${last7daysAnxiety.length} high-intensity anxiety/anger events in the last 7 days.${topWord ? ` Common trigger keyword: "${topWord[0]}".` : ''} Average intensity: ${(last7daysAnxiety.reduce((s, e) => s + e.intensity, 0) / last7daysAnxiety.length).toFixed(1)}/10.`,
    })
  }

  // ─── Goal rules ──────────────────────────────────────────────────────────
  for (const goal of data.goals) {
    if (goal.horizon === 'monthly' && goal.progress === 0) {
      const createdDate = new Date(goal.created_at)
      const now = new Date()
      const daysSinceCreated = Math.floor(
        (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24),
      )
      if (daysSinceCreated >= 14) {
        alerts.push({
          layer: 'goals',
          alert_type: 'stalled_goal',
          data_summary: `Goal "${goal.title}" has had 0% progress for ${daysSinceCreated} days. Monthly horizon — time is running out.`,
        })
      }
    }
  }

  // ─── Write alerts to Supabase (skip duplicates) ──────────────────────────
  for (const alert of alerts) {
    // Check if a non-dismissed alert of this type already exists
    const { data: existing } = await supabase
      .from('pattern_alerts')
      .select('id')
      .eq('user_id', userId)
      .eq('alert_type', alert.alert_type)
      .eq('dismissed', false)
      .gte('created_at', daysAgo(3))
      .limit(1)

    if (!existing || existing.length === 0) {
      await supabase.from('pattern_alerts').insert({
        user_id: userId,
        ...alert,
        dismissed: false,
      })
    }
  }
}
