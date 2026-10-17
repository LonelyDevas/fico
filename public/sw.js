// Fico service worker: keeps the app usable offline and shows bill reminders pushed from the server.
//
// Caching is runtime-only (no build-time precache list): whatever the app loads while online is kept,
// so after one online visit it opens offline. Only same-origin GET requests are handled, so Supabase,
// AI and other API calls always go straight to the network.
const VERSION = 'v1'
const SHELL_CACHE = `fico-shell-${VERSION}`
const STATIC_CACHE = `fico-static-${VERSION}`
const ASSET_CACHE = `fico-assets-${VERSION}`
const CURRENT = [SHELL_CACHE, STATIC_CACHE, ASSET_CACHE]

// Keep the app shell ("/") from the start: every deep link falls back to it when offline.
self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.add('/')).catch(() => {}))
})
self.addEventListener('activate', (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('fico-') && !CURRENT.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
)

const putIfOk = async (cacheName, request, response) => {
  if (response && response.ok) {
    const cache = await caches.open(cacheName)
    await cache.put(request, response.clone())
  }
  return response
}

// Page loads: fresh when online, last good copy (or the app shell at "/") when not.
const handleNavigation = async (request) => {
  try {
    return await putIfOk(SHELL_CACHE, request, await fetch(request))
  } catch {
    const cache = await caches.open(SHELL_CACHE)
    return (await cache.match(request)) || (await cache.match('/')) || Response.error()
  }
}

// Hashed build files never change, so the cached copy is always right.
const MAX_STATIC_ENTRIES = 600
const handleStatic = async (request) => {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await putIfOk(STATIC_CACHE, request, await fetch(request))
  // Old deploys leave their hashed files behind; drop the oldest once the cache gets large.
  const cache = await caches.open(STATIC_CACHE)
  const keys = await cache.keys()
  if (keys.length > MAX_STATIC_ENTRIES) {
    await Promise.all(keys.slice(0, keys.length - MAX_STATIC_ENTRIES).map((k) => cache.delete(k)))
  }
  return response
}

// Images, icons, OCR data: serve the cached copy now, refresh it in the background.
const handleAsset = async (request) => {
  const cache = await caches.open(ASSET_CACHE)
  const cached = await cache.match(request)
  const refresh = fetch(request).then((res) => putIfOk(ASSET_CACHE, request, res)).catch(() => cached)
  return cached || refresh
}

// Only images, fonts and OCR data are served from cache first; scripts, JSON and the manifest always
// come fresh from the network so a new deploy is never paired with stale payloads.
const STATIC_MEDIA = /\.(png|jpe?g|gif|svg|webp|ico|woff2?|ttf|otf)$/i

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request))
  } else if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(handleStatic(request))
  } else if (STATIC_MEDIA.test(url.pathname) || url.pathname.startsWith('/tesseract/')) {
    event.respondWith(handleAsset(request))
  }
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Fico'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icon-512.png',
      badge: '/icon-512.png',
      tag: data.tag || 'fico',
      data: { url: data.url || '/bills' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/bills'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ('focus' in client) {
          client.navigate(url).catch(() => {})
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
