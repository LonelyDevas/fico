'use client'

import { Capacitor } from '@capacitor/core'
import { useIonRouter } from '@ionic/react'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Move to a page after signing in or out, with nothing left over from the previous session.
 *
 * In the browser / Home Screen app that is a full page load: Ionic's router can leave a page
 * from before mounted and visible (the old page, or the sign-in form, showing under the new
 * one) when the auth state changes mid-navigation, and a load is the one dependable reset.
 * Session and settings live in storage, so nothing the user needs is lost.
 * In the native app (served from local files) it falls back to Ionic's router.
 */
export function useRootNavigate() {
  const router = useIonRouter()
  const queryClient = useQueryClient()
  return (path: string, options?: { clearCache?: boolean }) => {
    if (options?.clearCache) queryClient.clear()
    if (Capacitor.isNativePlatform()) {
      router.push(path, 'root', 'replace')
      return
    }
    window.location.replace(path)
  }
}
