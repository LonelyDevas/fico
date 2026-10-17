// Reads the signed-in user from the session Supabase stored on this device.
//
// supabase.auth.getSession() tries to refresh an expired token over the network and, offline, comes
// back empty, which would make the app think the user signed out. The stored copy is enough to know
// who is using the device, so the local database can open (and the app keep working) offline.
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

export interface CachedSession {
  userId: string
  email?: string
  username?: string
  /** Seconds since epoch; 0 when unknown. */
  expiresAt: number
  user: Record<string, unknown>
}

const storageKey = () => {
  try {
    const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname
    return `sb-${host.split('.')[0]}-auth-token`
  } catch {
    return null
  }
}

export async function readCachedSession(): Promise<CachedSession | null> {
  const key = storageKey()
  if (!key) return null
  try {
    const raw = Capacitor.isNativePlatform() ? (await Preferences.get({ key })).value : window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { user?: { id?: string; email?: string; user_metadata?: { username?: string } }; expires_at?: number }
    const user = parsed.user
    if (!user?.id) return null
    return {
      userId: user.id,
      email: user.email,
      username: user.user_metadata?.username,
      expiresAt: parsed.expires_at ?? 0,
      user: user as Record<string, unknown>,
    }
  } catch {
    return null
  }
}
