/* LifeOS Notification Manager
 * Schedules browser / PWA notifications via the Service Worker.
 * Preferences are stored in localStorage so they survive refreshes.
 */

export interface NotifPrefs {
  enabled: boolean
  checkinTime: string        // 'HH:MM' e.g. '08:00'
  gratitudeTime: string      // 'HH:MM'
  weightDay: number          // 0=Sun … 6=Sat
  weightTime: string         // 'HH:MM'
  mentorTime: string         // 'HH:MM' — daily AI insight
  habitTimes: Record<string, string[]>  // habitId → ['HH:MM', ...]
}

const PREF_KEY = 'lifeos_notif_prefs'

export const defaultPrefs: NotifPrefs = {
  enabled: false,
  checkinTime: '09:00',
  gratitudeTime: '21:00',
  weightDay: 1,   // Monday
  weightTime: '08:00',
  mentorTime: '09:00',
  habitTimes: {},
}

export function loadPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(PREF_KEY)
    return raw ? { ...defaultPrefs, ...JSON.parse(raw) } : { ...defaultPrefs }
  } catch {
    return { ...defaultPrefs }
  }
}

export function savePrefs(p: NotifPrefs) {
  localStorage.setItem(PREF_KEY, JSON.stringify(p))
}

/* Request notification permission and return whether it was granted */
export async function requestPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function permissionGranted(): boolean {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted'
}

/* Convert 'HH:MM' to a Date object for today (or next occurrence) */
function todayAt(timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d
}

function nextWeekday(day: number, timeStr: string): Date {
  const now = new Date()
  const d = new Date()
  d.setHours(...(timeStr.split(':').map(Number) as [number, number]), 0, 0)
  const diff = (day - now.getDay() + 7) % 7
  d.setDate(now.getDate() + (diff === 0 && d <= now ? 7 : diff))
  return d
}

interface ScheduledNotif {
  tag: string
  title: string
  body: string
  timestamp: number
  url: string
}

/* Build the list of notifications for today and send to SW */
export async function scheduleAll(
  prefs: NotifPrefs,
  habitNames: Record<string, string>,
) {
  if (!prefs.enabled || !permissionGranted()) return

  const sw = navigator.serviceWorker?.controller
  if (!sw) return

  const notifs: ScheduledNotif[] = []

  // Daily emotional check-in
  const checkin = todayAt(prefs.checkinTime)
  if (checkin > new Date()) {
    notifs.push({
      tag: 'checkin',
      title: '✨ Daily Check-in',
      body: 'How are you feeling today? Log your mood and set your intentions.',
      timestamp: checkin.getTime(),
      url: '/emotional',
    })
  }

  // Gratitude log
  const gratitude = todayAt(prefs.gratitudeTime)
  if (gratitude > new Date()) {
    notifs.push({
      tag: 'gratitude',
      title: '🙏 Gratitude Moment',
      body: "Take 2 minutes to log what you're grateful for today.",
      timestamp: gratitude.getTime(),
      url: '/emotional',
    })
  }

  // Weekly weight log
  const weight = nextWeekday(prefs.weightDay, prefs.weightTime)
  notifs.push({
    tag: 'weight',
    title: '⚖️ Weekly Weight Log',
    body: 'Time to track your weight. Consistency is the key.',
    timestamp: weight.getTime(),
    url: '/health',
  })

  // AI Mentor daily insight
  const mentor = todayAt(prefs.mentorTime)
  if (mentor > new Date()) {
    notifs.push({
      tag: 'mentor',
      title: '🧠 Your Daily Insight',
      body: "Your LifeOS mentor has something to share. Tap to read today's insight.",
      timestamp: mentor.getTime(),
      url: '/',
    })
  }

  // Per-habit reminders
  Object.entries(prefs.habitTimes).forEach(([habitId, times]) => {
    const name = habitNames[habitId] ?? 'habit'
    times.forEach((t, i) => {
      const d = todayAt(t)
      if (d > new Date()) {
        notifs.push({
          tag: `habit-${habitId}-${i}`,
          title: `🔥 ${name}`,
          body: `Time to complete your habit: ${name}`,
          timestamp: d.getTime(),
          url: '/habits',
        })
      }
    })
  })

  sw.postMessage({ type: 'SCHEDULE_NOTIFICATIONS', notifications: notifs })
}

/* Register the service worker (call once from main.tsx) */
export async function registerSW() {
  if (!('serviceWorker' in navigator)) return
  try {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch (e) {
    console.warn('SW registration failed:', e)
  }
}
