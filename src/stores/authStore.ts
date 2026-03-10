import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthState {
  user: User | null
  loading: boolean
  onboardingComplete: boolean
  anthropicKey: string
  aiEnabled: boolean
  setUser: (user: User | null) => void
  setLoading: (v: boolean) => void
  setOnboardingComplete: (v: boolean) => void
  setAnthropicKey: (key: string) => void
  setAiEnabled: (v: boolean) => void
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  onboardingComplete: false,
  anthropicKey: '',
  aiEnabled: false,

  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  setOnboardingComplete: (v) => set({ onboardingComplete: v }),
  setAnthropicKey: (key) => set({ anthropicKey: key }),
  setAiEnabled: (v) => set({ aiEnabled: v }),

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, onboardingComplete: false, anthropicKey: '', aiEnabled: false })
  },
}))
