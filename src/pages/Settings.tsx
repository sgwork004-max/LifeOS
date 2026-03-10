import { useState } from 'react'
import { Settings as SettingsIcon, Key, Brain, Save, Check, Eye, EyeOff, Sun, Moon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import Topbar from '@/components/layout/Topbar'
import { Card } from '@/components/ui/Card'

export default function Settings() {
  const { user, anthropicKey, aiEnabled, setAnthropicKey, setAiEnabled } = useAuthStore()
  const { theme, setTheme } = useAppStore()
  const [key, setKey] = useState(anthropicKey)
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null)

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
              className={`relative w-11 h-6 rounded-full transition-colors ${theme === 'light' ? 'bg-violet-500' : 'bg-[#2a2a3a]'}`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${theme === 'light' ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
          </div>

          {/* Dark / Light quick-select pills */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setTheme('dark')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-all ${
                theme === 'dark'
                  ? 'border-violet-500 bg-violet-500/10 text-violet-400'
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

        {/* AI Settings */}
        <Card glow="#f59e0b">
          <div className="flex items-center gap-2 mb-4">
            <Brain size={16} className="text-amber-400" />
            <h3 className="font-semibold text-white">AI Insights (Claude)</h3>
          </div>

          <div className="space-y-4">
            {/* Toggle */}
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

            {/* API Key input */}
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
              {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Settings'}
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
