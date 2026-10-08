import { supabase } from '@/utils/supabase-client'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

export type PushSupport = 'ready' | 'needs-install' | 'unsupported' | 'unconfigured'

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** Can this device get push notifications right now, and if not, why? */
export function pushSupport(): PushSupport {
  if (typeof window === 'undefined') return 'unsupported'
  // iPhones only allow push for apps added to the Home Screen.
  if (isIOS() && !isStandalone()) return 'needs-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  if (!VAPID_PUBLIC_KEY) return 'unconfigured'
  return 'ready'
}

const toKey = (base64: string) => {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

const getRegistration = async () => {
  await navigator.serviceWorker.register('/sw.js')
  return navigator.serviceWorker.ready
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== 'ready') return null
  const registration = await navigator.serviceWorker.getRegistration()
  return registration ? registration.pushManager.getSubscription() : null
}

/** Asks permission, subscribes this device and saves it so the server can reach it. */
export async function enablePush(): Promise<void> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notifications are blocked. Allow them for Fico in your phone settings.')

  const registration = await getRegistration()
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(VAPID_PUBLIC_KEY) }))

  const json = subscription.toJSON()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Sign in again to turn on reminders.')
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      owner_id: auth.user.id,
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      user_agent: navigator.userAgent.slice(0, 200),
    },
    { onConflict: 'endpoint' }
  )
  if (error) throw error
}

export async function disablePush(): Promise<void> {
  const subscription = await currentPushSubscription()
  if (!subscription) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
  await subscription.unsubscribe()
}

/** Asks the server to send this account a test notification. */
export async function sendTestPush(): Promise<void> {
  const { error } = await supabase.functions.invoke('bill-reminders', { body: { test: true } })
  if (error) throw error
}
