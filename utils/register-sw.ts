/**
 * Registers the service worker so the app opens offline after one online visit.
 * Skipped in dev (it would serve stale bundles over HMR) and in the Capacitor
 * apps, which already ship the files inside the native bundle.
 */
export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  if (process.env.NODE_ENV !== 'production') return
  if (!/^https?:$/.test(window.location.protocol)) return

  const register = () => navigator.serviceWorker.register('/sw.js').catch(() => {})
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}
