import { useState } from 'react'
import { Settings as SettingsIcon, Key, Brain, Save, Check, Eye, EyeOff, Sun, Moon, Bell, BellOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import { useHabits } from '@/hooks/useHabits'
import { loadPrefs, savePrefs, scheduleAll, requestPermission, permissionGranted } from '@/lib/notifications'
import type { NotifPrefs } from '@/lib/notifications'
import Topbar from '@/components/layout/Topbar'
import { Card } from '@/components/ui/Card'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function Settings() {
  const { user, anthropicKey, aiEnabled, setAnthropicKey, setAiEnabled } = useAuthStore()
  const { theme, setTheme } = useAppStore()
  const { habits } = useHabits()

  // AI key state
  const [key, setKey] = useState(anthropicKey)
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null)

  // Notification prefs state
  const [prefs, setPrefs] = useState<NotifPrefs>(() => loadPrefs())
  const [notifSaving, setNotifSaving] = useState(false)
  const [notifSaved, setNotifSaved] = useState(false)
  const [permStatus, setPermStatus] = useState<'granted' | 'denied' | 'default'>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )

  const saveKey = async () => {
    if (!user) return
    setSaving(true)
    try {
      await supabase.auth.updateUser({ data: { anthropic_api_key: key, ai_enabled: aiEnabled } })
      setAnthropicKey(key)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const testKey = async () => {
    if (!key) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 5, messages: [{ role: 'user', content: 'Hi' }] }),
      })
      setTestResult(res.ok ? 'ok' : 'fail')
    } catch {
      setTestResult('fail')
    } finally {
      setTesting(false)
    }
  }

  const handleToggleNotifs = async () => {
    if (!prefs.enabled) {
      const granted = await requestPermission()
      setPermStatus(granted ? 'granted' : 'denied')
      if (!granted) return
    }
    setPrefs((p) => ({ ...p, enabled: !p.enabled }))
  }

  const saveNotifs = async () => {
    setNotifSaving(true)
    try {
      savePrefs(prefs)
      const habitNames = Object.fromEntries(habits.map((h) => [h.id, h.name]))
      await scheduleAll(prefs, habitNames)
      setNotifSaved(true)
      setTimeout(() => setNotifSaved(false), 2000)
    } finally {
      setNotifSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Settings" subtitle="Configure your LifeOS" />

      <div className="flex-1 p-6 space-y-5 overflow-y-auto max-w-2xl">
        {/* Account */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <SettingsIcon size={16} className="text-[#8888aa]" />
            <h3 className="font-semibold text-white">Account</h3>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-2 border-b border-[#2a2a3a]">
              <span className="text-sm text-[#8888aa]">Email</span>
              <span className="text-sm text-white">{user?.email}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-[#8888aa]">User ID</span>
              <span className="text-xs text-[#555570] font-mono">{user?.id?.slice(0, 8)}…</span>
            </div>
          </div>
        </Card>

        {/* Appearance */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            {theme === 'light' ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-[#8888aa]" />}
            <h3 className="font-semibold text-white">Appearance</h3>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-[#1a1a24] border border-[#2a2a3a]">
            <div>
              <p className="text-sm font-medium text-white">Light Mode</p>
              <p className="text-xs text-[#8888aa]">Switch between dark and light interface</p>
            </div>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`relative w-11 h-6 rounded-full transition-colors ${theme === 'light' ? 'bg-lime-500' : 'bg-[#2a2a3a]'}`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${theme === 'light' ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
          </div>

          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setTheme('dark')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-all ${
                theme === 'dark'
                  ? 'border-lime-500 bg-lime-500/10 text-lime-400'
                  : 'border-[#2a2a3a] text-[#8888aa] hover:border-[#3a3a50]'
              }`}
            >
              <Moon size={14} /> Dark
            </button>
            <button
              onClick={() => setTheme('light')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-all ${
                theme === 'light'
                  ? 'border-amber-400 bg-amber-400/10 text-amber-400'
                  : 'border-[#2a2a3a] text-[#8888aa] hover:border-[#3a3a50]'
              }`}
            >
              <Sun size={14} /> Light
            </button>
          </div>
        </Card>

        {/* Notifications */}
        <Card glow="#84cc16">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={16} className="text-lime-400" />
            <h3 className="font-semibold text-white">Notifications</h3>
          </div>

          <div className="space-y-4">
            {/* Enable toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#1a1a24] border border-[#2a2a3a]">
              <div>
                <p className="text-sm font-medium text-white">Enable Notifications</p>
                <p className="text-xs text-[#8888aa]">Get reminders for habits, check-ins, and mentor insights</p>
              </div>
              <button
                onClick={handleToggleNotifs}
                className={`relative w-11 h-6 rounded-full transition-colors ${prefs.enabled ? 'bg-lime-500' : 'bg-[#2a2a3a]'}`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${prefs.enabled ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>

            {/* Permission denied warning */}
            {permStatus === 'denied' && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <BellOff size={14} className="text-red-400 shrink-0" />
                <p className="text-xs text-red-300">
                  Notifications are blocked in your browser. Enable them in site settings and try again.
                </p>
              </div>
            )}

            {/* Time pickers — only when enabled */}
            {prefs.enabled && (
              <div className="space-y-3">
                {/* Daily check-in */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white">✨ Daily Check-in</p>
                    <p className="text-xs text-[#8888aa]">Log mood and intentions</p>
                  </div>
                  <input
                    type="time"
                    value={prefs.checkinTime}
                    onChange={(e) => setPrefs((p) => ({ ...p, checkinTime: e.target.value }))}
                    className="px-3 py-1.5 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-white text-sm focus:outline-none focus:border-lime-500/60"
                  />
                </div>

                {/* Gratitude */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white">🙏 Gratitude Reminder</p>
                    <p className="text-xs text-[#8888aa]">Evening gratitude log</p>
                  </div>
                  <input
                    type="time"
                    value={prefs.gratitudeTime}
                    onChange={(e) => setPrefs((p) => ({ ...p, gratitudeTime: e.target.value }))}
                    className="px-3 py-1.5 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-white text-sm focus:outline-none focus:border-lime-500/60"
                  />
                </div>

                {/* Weekly weight */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm text-white">⚖️ Weight Reminder</p>
                    <p className="text-xs text-[#8888aa]">Weekly weigh-in prompt</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={prefs.weightDay}
                      onChange={(e) => setPrefs((p) => ({ ...p, weightDay: Number(e.target.value) }))}
                      className="px-2 py-1.5 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-white text-xs focus:outline-none focus:border-lime-500/60"
                    >
                      {DAYS.map((d, i) => (
                        <option key={d} value={i}>{d}</option>
                      ))}
                    </select>
                    <input
                      type="time"
                      value={prefs.weightTime}
                      onChange={(e) => setPrefs((p) => ({ ...p, weightTime: e.target.value }))}
                      className="px-3 py-1.5 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-white text-sm focus:outline-none focus:border-lime-500/60"
                    />
                  </div>
                </div>

                {/* AI Mentor insight */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white">🧠 AI Mentor Insight</p>
                    <p className="text-xs text-[#8888aa]">Daily proactive nudge</p>
                  </div>
                  <input
                    type="time"
                    value={prefs.mentorTime}
                    onChange={(e) => setPrefs((p) => ({ ...p, mentorTime: e.target.value }))}
                    className="px-3 py-1.5 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-white text-sm focus:outline-none focus:border-lime-500/60"
                  />
                </div>
              </div>
            )}

            <button
              onClick={saveNotifs}
              disabled={notifSaving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #84cc16, #65a30d)', boxShadow: '0 0 16px #84cc1640' }}
            >
              {notifSaved ? <Check size={14} /> : <Save size={14} />}
              {notifSaved ? 'Saved!' : notifSaving ? 'Saving…' : 'Save Notification Settings'}
            </button>
          </div>
        </Card>

        {/* AI Settings */}
        <Card glow="#f59e0b">
          <div className="flex items-center gap-2 mb-4">
            <Brain size={16} className="text-amber-400" />
            <h3 className="font-semibold text-white">AI Insights (Claude)</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#1a1a24] border border-[#2a2a3a]">
              <div>
                <p className="text-sm font-medium text-white">Enable AI Insights</p>
                <p className="text-xs text-[#8888aa]">Unlock habit patterns, health commentary, goal gap analysis, and weekly AI report</p>
              </div>
              <button
                onClick={() => setAiEnabled(!aiEnabled)}
                className={`relative w-11 h-6 rounded-full transition-colors ${aiEnabled ? 'bg-amber-500' : 'bg-[#2a2a3a]'}`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${aiEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-sm text-[#8888aa] mb-1.5">
                <Key size={13} /> Anthropic API Key
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="sk-ant-api03-…"
                    className="w-full px-3 py-2 pr-10 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] text-white text-sm placeholder:text-[#555570] focus:outline-none focus:border-amber-500/60"
                  />
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555570] hover:text-[#8888aa]"
                  >
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <button
                  onClick={testKey}
                  disabled={!key || testing}
                  className="px-3 py-2 rounded-lg text-xs font-medium bg-[#1a1a24] border border-[#2a2a3a] text-[#8888aa] hover:text-white disabled:opacity-40 transition-all"
                >
                  {testing ? 'Testing…' : 'Test'}
                </button>
              </div>

              {testResult === 'ok' && (
                <p className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1"><Check size={12} /> API key is valid</p>
              )}
              {testResult === 'fail' && (
                <p className="text-xs text-red-400 mt-1.5">Invalid key or API error. Check your key.</p>
              )}

              <p className="text-xs text-[#555570] mt-2">
                Your API key is stored in your Supabase user metadata. It is never logged or shared.
                Get a key at <span className="text-[#8888aa]">console.anthropic.com</span>
              </p>
            </div>

            <button
              onClick={saveKey}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 0 16px #f59e0b40' }}
            >
              {saved ? <Check size={14} /> : <Save size={14} />}
              {saved ? 'Saved!' : saving ? 'Saving…' : 'Save AI Settings'}
            </button>
          </div>
        </Card>

        {/* About */}
        <Card>
          <h3 className="font-semibold text-white mb-3">About LifeOS</h3>
          <div className="space-y-2 text-sm text-[#8888aa]">
            <p>LifeOS v1.0 — Personal Life Operating System</p>
            <p>Built with React, TypeScript, Supabase, and Claude AI.</p>
            <p className="text-xs text-[#555570] mt-4">
              Data is stored securely in your personal Supabase database with Row Level Security. Only you can access your data.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
