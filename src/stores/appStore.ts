import { create } from 'zustand'
import type { PatternAlert, TodayScore } from '@/types'

type Theme = 'dark' | 'light'

function applyTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t)
  localStorage.setItem('lifeos_theme', t)
}

interface AppState {
  todayScore: TodayScore
  alerts: PatternAlert[]
  theme: Theme
  setTodayScore: (score: TodayScore) => void
  setAlerts: (alerts: PatternAlert[]) => void
  dismissAlert: (id: string) => void
  setTheme: (t: Theme) => void
}

export const useAppStore = create<AppState>((set) => ({
  todayScore: { total: 0, habit: 0, emotional: 0, health: 0, goal: 0 },
  alerts: [],
  theme: 'dark',

  setTodayScore: (score) => set({ todayScore: score }),
  setAlerts: (alerts) => set({ alerts }),
  dismissAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.filter((a) => a.id !== id),
    })),
  setTheme: (t) => {
    applyTheme(t)
    set({ theme: t })
  },
}))
