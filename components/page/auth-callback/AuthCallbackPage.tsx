'use client'

import { useEffect } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import { jwtDecode } from 'jwt-decode'
import { useAuthStore, useIsAuthenticated, useAuthLoading } from '@/store/auth-store'
import { useSettingsStore } from '@/store/settings-store'
import type { AccessToken } from '@/types/auth'
import { isOnboardingDone } from '@/utils/onboarding'

const isSupabase = () => process.env.NEXT_PUBLIC_BACKEND === 'supabase'

export function AuthCallbackPage() {
  const history = useHistory()
  const location = useLocation()
  const { setAuth } = useAuthStore()
  const { onboardingCompleted, defaultLandingPage } = useSettingsStore()
  const isAuthenticated = useIsAuthenticated()
  const isAuthLoading = useAuthLoading()

  // Supabase path: supabase-js's detectSessionInUrl already parsed the
  // OAuth redirect and established a session; useSupabaseAuthSync (app
  // root) picks it up via onAuthStateChange. Just wait for it to settle.
  useEffect(() => {
    if (!isSupabase()) return
    if (isAuthLoading) return
    if (!isAuthenticated) {
      history.replace('/signin')
      return
    }
    // Onboarding is remembered on the account, so ask it instead of trusting this browser alone.
    let cancelled = false
    void isOnboardingDone().then((done) => {
      if (!cancelled) history.replace(done ? defaultLandingPage : '/onboarding')
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupabase(), isAuthLoading, isAuthenticated])

  useEffect(() => {
    if (isSupabase()) return
    const params = new URLSearchParams(location.search)
    const token    = params.get('token')
    const username = params.get('username') ?? ''
    const userid   = params.get('userid')   ?? ''
    const provider = params.get('provider') ?? 'google'
    const email    = params.get('email')    ?? ''

    if (!token) {
      history.replace('/signin')
      return
    }

    try {
      // jwtDecode does not verify — it only base64-decodes the payload.
      // Works for both HS256 and RS256 tokens.
      const decoded = jwtDecode<Partial<AccessToken>>(token)

      const authData: AccessToken = {
        _id:      decoded._id      ?? userid,
        username: decoded.username ?? username,
        email:    decoded.email    ?? email,
        status:   decoded.status   ?? 'active',
        provider: decoded.provider ?? provider,
        exp:      decoded.exp      ?? 0,
        iat:      decoded.iat      ?? 0,
      }

      localStorage.setItem('auth', token)
      setAuth(authData)
      history.replace(onboardingCompleted ? defaultLandingPage : '/onboarding')
    } catch {
      history.replace('/signin')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-[#f5f5f5] dark:bg-zinc-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <svg width="40" height="40" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <circle cx="25" cy="25" r="20" stroke="#e5e7eb" strokeWidth="6" fill="none" />
          <path d="M45 25a20 20 0 0 1-20 20" stroke="#111827" strokeWidth="6" strokeLinecap="round" fill="none">
            <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite" />
          </path>
        </svg>
        <p className="text-sm text-gray-500 dark:text-zinc-400">Signing you in…</p>
      </div>
    </div>
  )
}
