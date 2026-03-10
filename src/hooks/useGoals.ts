import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Goal, Milestone, WeeklyTask, GoalWithProgress, MilestoneWithTasks } from '@/types'

export function useGoals() {
  const { user } = useAuthStore()
  const [goals, setGoals] = useState<GoalWithProgress[]>([])
  const [loading, setLoading] = useState(true)

  const fetchGoals = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data: goalsData } = await supabase
      .from('goals').select('*').eq('user_id', user.id).order('created_at', { ascending: false })

    if (!goalsData) { setLoading(false); return }

    const withProgress = await Promise.all(goalsData.map(async (goal: Goal) => {
      const { data: milestonesData } = await supabase
        .from('milestones').select('*').eq('goal_id', goal.id).order('due_date', { ascending: true })

      const milestones = await Promise.all((milestonesData ?? []).map(async (m: Milestone) => {
        const { data: tasksData } = await supabase
          .from('weekly_tasks').select('*').eq('milestone_id', m.id).order('due_date', { ascending: true })
        return { ...m, tasks: tasksData ?? [] } as MilestoneWithTasks
      }))

      const total = milestones.length
      const completed = milestones.filter((m) => m.completed_at).length
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0

      return { ...goal, milestones, progress } as GoalWithProgress
    }))

    setGoals(withProgress)
    setLoading(false)
  }, [user])

  useEffect(() => { fetchGoals() }, [fetchGoals])

  const createGoal = async (data: Omit<Goal, 'id' | 'user_id' | 'created_at'>) => {
    if (!user) return
    await supabase.from('goals').insert({ ...data, user_id: user.id })
    await fetchGoals()
  }

  const deleteGoal = async (id: string) => {
    await supabase.from('goals').delete().eq('id', id)
    await fetchGoals()
  }

  const createMilestone = async (goalId: string, title: string, dueDate?: string) => {
    if (!user) return
    await supabase.from('milestones').insert({ goal_id: goalId, user_id: user.id, title, due_date: dueDate ?? null })
    await fetchGoals()
  }

  const toggleMilestone = async (milestoneId: string, completed: boolean) => {
    await supabase.from('milestones').update({ completed_at: completed ? new Date().toISOString() : null }).eq('id', milestoneId)
    await fetchGoals()
  }

  const createTask = async (milestoneId: string, title: string, dueDate?: string) => {
    if (!user) return
    await supabase.from('weekly_tasks').insert({ milestone_id: milestoneId, user_id: user.id, title, due_date: dueDate ?? null })
    await fetchGoals()
  }

  const toggleTask = async (taskId: string, completed: boolean) => {
    await supabase.from('weekly_tasks').update({ completed_at: completed ? new Date().toISOString() : null }).eq('id', taskId)
    await fetchGoals()
  }

  return { goals, loading, createGoal, deleteGoal, createMilestone, toggleMilestone, createTask, toggleTask, refetch: fetchGoals }
}
