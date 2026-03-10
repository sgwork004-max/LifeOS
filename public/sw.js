/* LifeOS Service Worker — handles scheduled notifications */

const CACHE = 'lifeos-v1'
const scheduled = new Map() // tag → timeoutId

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

/* Receive schedule commands from the main app */
self.addEventListener('message', (event) => {
  const { type, notifications } = event.data ?? {}

  if (type === 'SCHEDULE_NOTIFICATIONS') {
    // Clear any existing timers
    scheduled.forEach((id) => clearTimeout(id))
    scheduled.clear()

    // Schedule each notification
    ;(notifications ?? []).forEach((n) => {
      const delay = n.timestamp - Date.now()
      if (delay < 0 || delay > 24 * 60 * 60 * 1000) return // skip past / >24h
      const id = setTimeout(() => {
        self.registration.showNotification(n.title, {
          body: n.body,
          icon: '/icon.svg',
          badge: '/icon.svg',
          tag: n.tag,
          data: { url: n.url ?? '/' },
          requireInteraction: false,
          silent: false,
        })
        scheduled.delete(n.tag)
      }, delay)
      scheduled.set(n.tag, id)
    })
  }
})

/* Open the app when a notification is clicked */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin))
      if (existing) return existing.focus()
      return self.clients.openWindow(url)
    }),
  )
})
