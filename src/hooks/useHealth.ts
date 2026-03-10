import { useState, useEffect, useCallback } from 'react'
import { supabase, daysAgo, today } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { HealthLog } from '@/types'

export function useHealth() {
  const { user } = useAuthStore()
  const [logs, setLogs] = useState<HealthLog[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLogs = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('health_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false })
      .limit(90)
    setLogs(data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const logToday = async (weight_kg: number, body_fat_pct?: number, notes?: string) => {
    if (!user) return
    await supabase.from('health_logs').insert({
      user_id: user.id,
      weight_kg,
      body_fat_pct: body_fat_pct ?? null,
      notes: notes ?? null,
    })
    await fetchLogs()
  }

  const deleteLog = async (id: string) => {
    await supabase.from('health_logs').delete().eq('id', id)
    await fetchLogs()
  }

  const todayLog = logs.find((l) => l.logged_at.startsWith(today()))

  return { logs, loading, logToday, deleteLog, todayLog, refetch: fetchLogs }
}
