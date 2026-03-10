import { useState, useEffect, useCallback } from 'react'
import { supabase, today, daysAgo } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Habit, HabitLog, HabitWithStats } from '@/types'

function computeStreak(logs: HabitLog[]): { current: number; longest: number } {
  const dates = [...new Set(logs.map((l) => l.completed_at.slice(0, 10)))].sort().reverse()
  if (dates.length === 0) return { current: 0, longest: 0 }

  let current = 0
  const todayStr = today()
  let cursor = new Date(todayStr)

  for (const d of dates) {
    const cursorStr = cursor.toISOString().slice(0, 10)
    if (d === cursorStr) {
      current++
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }

  // Longest streak
  let longest = 0
  let streak = 1
  const sorted = [...new Set(logs.map((l) => l.completed_at.slice(0, 10)))].sort()
  for (let i = 1; i < sorted.length; i++) {
    const diff =
      (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / 86400000
    if (diff === 1) {
      streak++
      longest = Math.max(longest, streak)
    } else {
      streak = 1
    }
  }
  longest = Math.max(longest, streak, current)

  return { current, longest }
}

export function useHabits() {
  const { user } = useAuthStore()
  const [habits, setHabits] = useState<HabitWithStats[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHabits = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data: habitsData } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      if (!habitsData) return

      const thirtyDaysAgo = daysAgo(30)
      const todayStr = today()

      const withStats = await Promise.all(
        habitsData.map(async (habit: Habit) => {
          const { data: logs } = await supabase
            .from('habit_logs')
            .select('*')
            .eq('habit_id', habit.id)
            .gte('completed_at', thirtyDaysAgo)
            .order('completed_at', { ascending: false })

          const allLogs: HabitLog[] = logs ?? []
          const { current, longest } = computeStreak(allLogs)
          const uniqueDays = new Set(allLogs.map((l) => l.completed_at.slice(0, 10))).size
          const completion30d = Math.round((uniqueDays / 30) * 100)
          const completedToday = allLogs.some((l) => l.completed_at.startsWith(todayStr))

          return {
            ...habit,
            current_streak: current,
            longest_streak: longest,
            completion_30d: completion30d,
            completed_today: completedToday,
            logs: allLogs,
          } as HabitWithStats
        }),
      )

      setHabits(withStats)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchHabits()
  }, [fetchHabits])

  const checkHabit = async (habitId: string) => {
    if (!user) return
    const todayStr = today()
    const habit = habits.find((h) => h.id === habitId)
    if (!habit) return

    if (habit.completed_today) {
      // Uncheck: remove today's log
      await supabase
        .from('habit_logs')
        .delete()
        .eq('habit_id', habitId)
        .eq('user_id', user.id)
        .gte('completed_at', todayStr + 'T00:00:00')
    } else {
      await supabase.from('habit_logs').insert({
        habit_id: habitId,
        user_id: user.id,
        completed_at: new Date().toISOString(),
      })
    }
    await fetchHabits()
  }

  const createHabit = async (data: Omit<Habit, 'id' | 'user_id' | 'created_at'>) => {
    if (!user) return
    await supabase.from('habits').insert({ ...data, user_id: user.id })
    await fetchHabits()
  }

  const deleteHabit = async (id: string) => {
    await supabase.from('habits').delete().eq('id', id)
    await fetchHabits()
  }

  return { habits, loading, checkHabit, createHabit, deleteHabit, refetch: fetchHabits }
}
