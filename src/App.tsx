import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import Layout from '@/components/layout/Layout'
import Auth from '@/pages/Auth'
import Onboarding from '@/pages/Onboarding'

// Apply saved theme before first render
const savedTheme = (localStorage.getItem('lifeos_theme') ?? 'dark') as 'dark' | 'light'
document.documentElement.setAttribute('data-theme', savedTheme)

// Lazy-load pages for code splitting
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Habits = lazy(() => import('@/pages/Habits'))
const Health = lazy(() => import('@/pages/Health'))
const EmotionalIntelligence = lazy(() => import('@/pages/EmotionalIntelligence'))
const Goals = lazy(() => import('@/pages/Goals'))
const WeeklyReport = lazy(() => import('@/pages/WeeklyReport'))
const Settings = lazy(() => import('@/pages/Settings'))

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-lime-500 border-t-transparent animate-spin" />
    </div>
  )
}

function AppRoutes() {
  const { user, loading, onboardingComplete } = useAuthStore()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-lime-500 border-t-transparent animate-spin" />
          <p className="text-sm text-[#8888aa]">Loading LifeOS…</p>
        </div>
      </div>
    )
  }

  if (!user) return <Auth />
  if (!onboardingComplete) return <Onboarding />

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/habits" element={<Habits />} />
          <Route path="/health" element={<Health />} />
          <Route path="/emotional" element={<EmotionalIntelligence />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/report" element={<WeeklyReport />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default function App() {
  const { setUser, setLoading, setOnboardingComplete, setAnthropicKey, setAiEnabled } = useAuthStore()
  const { setTheme } = useAppStore()

  // Sync store theme with the value already applied to the DOM
  useEffect(() => {
    const t = (localStorage.getItem('lifeos_theme') ?? 'dark') as 'dark' | 'light'
    setTheme(t)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        await loadUserProfile(session.user.id, session.user.user_metadata)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadUserProfile(session.user.id, session.user.user_metadata)
      } else {
        setOnboardingComplete(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadUserProfile(userId: string, metadata: Record<string, unknown>) {
    // Fast path: user metadata is available immediately from the session (no DB needed)
    if (metadata?.onboarding_complete === true) {
      setOnboardingComplete(true)
    }

    if (metadata?.anthropic_api_key) setAnthropicKey(String(metadata.anthropic_api_key))
    if (metadata?.ai_enabled !== undefined) setAiEnabled(Boolean(metadata.ai_enabled))

    // Authoritative check from DB — race against a 3s timeout so we never block the UI
    try {
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
      const query = supabase
        .from('user_profiles')
        .select('onboarding_complete')
        .eq('id', userId)
        .single()
        .then(({ data }) => data)

      const profile = await Promise.race([query, timeout])
      if (profile) setOnboardingComplete(profile.onboarding_complete)
    } catch {
      // DB unavailable or migrations not run — rely on metadata fast path above
    }
  }

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
