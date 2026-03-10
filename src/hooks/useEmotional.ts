import { useState, useEffect, useCallback } from 'react'
import { supabase, today, daysAgo } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { EmotionalCheckin, GratitudeLog, AnxietyEvent, CbtLog, EmotionTag } from '@/types'

export function useEmotional() {
  const { user } = useAuthStore()
  const [checkins, setCheckins] = useState<EmotionalCheckin[]>([])
  const [gratitudeLogs, setGratitudeLogs] = useState<GratitudeLog[]>([])
  const [anxietyEvents, setAnxietyEvents] = useState<AnxietyEvent[]>([])
  const [cbtLogs, setCbtLogs] = useState<CbtLog[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const thirtyDaysAgo = daysAgo(30)
    const [c, g, a, cb] = await Promise.all([
      supabase.from('emotional_checkins').select('*').eq('user_id', user.id)
        .gte('logged_at', thirtyDaysAgo).order('logged_at', { ascending: false }),
      supabase.from('gratitude_logs').select('*').eq('user_id', user.id)
        .gte('logged_at', thirtyDaysAgo).order('logged_at', { ascending: false }),
      supabase.from('anxiety_events').select('*').eq('user_id', user.id)
        .gte('logged_at', daysAgo(60)).order('logged_at', { ascending: false }),
      supabase.from('cbt_logs').select('*').eq('user_id', user.id)
        .gte('logged_at', daysAgo(60)).order('logged_at', { ascending: false }),
    ])
    setCheckins(c.data ?? [])
    setGratitudeLogs(g.data ?? [])
    setAnxietyEvents(a.data ?? [])
    setCbtLogs(cb.data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { fetchAll() }, [fetchAll])

  const logCheckin = async (data: { mood: number; energy: number; emotion_tags: EmotionTag[]; journal_note?: string }) => {
    if (!user) return
    await supabase.from('emotional_checkins').insert({ user_id: user.id, ...data })
    await fetchAll()
  }

  const logGratitude = async (entries: string[]) => {
    if (!user) return
    await supabase.from('gratitude_logs').insert({ user_id: user.id, entries })
    await fetchAll()
  }

  const logAnxiety = async (data: Omit<AnxietyEvent, 'id' | 'user_id' | 'logged_at'>) => {
    if (!user) return
    await supabase.from('anxiety_events').insert({ user_id: user.id, ...data })
    await fetchAll()
  }

  const logCbt = async (data: Omit<CbtLog, 'id' | 'user_id' | 'logged_at'>) => {
    if (!user) return
    await supabase.from('cbt_logs').insert({ user_id: user.id, ...data })
    await fetchAll()
  }

  const todayCheckin = checkins.find((c) => c.logged_at.startsWith(today()))
  const todayGratitude = gratitudeLogs.find((g) => g.logged_at.startsWith(today()))

  // Gratitude streak
  const gratitudeStreak = (() => {
    let streak = 0
    const dates = gratitudeLogs.map((g) => g.logged_at.slice(0, 10))
    let cursor = new Date()
    while (true) {
      const str = cursor.toISOString().slice(0, 10)
      if (dates.includes(str)) { streak++; cursor.setDate(cursor.getDate() - 1) }
      else break
    }
    return streak
  })()

  return {
    checkins, gratitudeLogs, anxietyEvents, cbtLogs, loading,
    todayCheckin, todayGratitude, gratitudeStreak,
    logCheckin, logGratitude, logAnxiety, logCbt,
  }
}
