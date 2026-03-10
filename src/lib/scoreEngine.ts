import type { HabitWithStats, EmotionalCheckin, HealthLog, GoalWithProgress, TodayScore } from '@/types'
import { today } from './supabase'

export function computeTodayScore(
  habits: HabitWithStats[],
  checkin: EmotionalCheckin | null,
  healthLog: HealthLog | null,
  goals: GoalWithProgress[],
): TodayScore {
  const todayStr = today()

  // Habit score (40%): weighted completion rate for today
  let habitScore = 0
  if (habits.length > 0) {
    const totalWeight = habits.reduce((s, h) => s + h.importance_weight, 0)
    const completedWeight = habits
      .filter((h) => h.completed_today)
      .reduce((s, h) => s + h.importance_weight, 0)
    habitScore = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0
  }

  // Emotional score (20%): did user check in today?
  const emotionalScore = checkin ? 100 : 0

  // Health score (20%): did user log health today?
  const healthScore = healthLog ? 100 : 0

  // Goal score (20%): any weekly tasks completed today?
  let goalScore = 0
  const allTasks = goals.flatMap((g) => g.milestones.flatMap((m) => m.tasks))
  const todayTasks = allTasks.filter((t) => t.completed_at?.startsWith(todayStr))
  const dueTodayOrPast = allTasks.filter((t) => !t.completed_at)
  if (allTasks.length > 0) {
    goalScore = todayTasks.length > 0 ? 100 : dueTodayOrPast.length > 0 ? 0 : 50
  } else {
    goalScore = 50 // neutral when no goals
  }

  const total = Math.round(
    habitScore * 0.4 + emotionalScore * 0.2 + healthScore * 0.2 + goalScore * 0.2,
  )

  return { total, habit: habitScore, emotional: emotionalScore, health: healthScore, goal: goalScore }
}

export function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#f59e0b'
  if (score >= 40) return '#06b6d4'
  return '#ef4444'
}

export function scoreLabel(score: number): string {
  if (score >= 80) return 'Crushing it'
  if (score >= 60) return 'On track'
  if (score >= 40) return 'Average'
  return 'Needs work'
}
