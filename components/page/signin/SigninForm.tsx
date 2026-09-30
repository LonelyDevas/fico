'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { Eye, EyeOff, X } from 'lucide-react'
import { useHistory, Link } from 'react-router-dom'
import { usePassportLogin, useOAuthLogin } from '@/queries/auth/auth'
import { GoogleButton } from '@/components/page/auth/google-button'
import { isOnboardingDone } from '@/utils/onboarding'
import toast from 'react-hot-toast'
import { jwtDecode } from 'jwt-decode'
import { AccessToken } from '@/types/auth'
import { useAuthStore, useAuthLoading, useIsAuthenticated } from '@/store/auth-store'
import { useSettingsStore } from '@/store/settings-store'

const isSupabase = () => process.env.NEXT_PUBLIC_BACKEND === 'supabase'

export function SigninForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [usernameVal, setUsernameVal] = useState('')
  const [passwordVal, setPasswordVal] = useState('')
  const { mutate: loginUser, isPending } = usePassportLogin()
  const { mutate: oauthLogin } = useOAuthLogin()
  const { setAuth } = useAuthStore()
  const { defaultLandingPage } = useSettingsStore()
  const history = useHistory()
  const isAuthenticated = useIsAuthenticated()
  const isAuthLoading = useAuthLoading()

  // Already signed in (for example after a refresh): skip the form.
  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) return
    let cancelled = false
    void isOnboardingDone().then((done) => {
      if (!cancelled) history.replace(done ? defaultLandingPage : '/onboarding')
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading, isAuthenticated])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isPending || !usernameVal || !passwordVal) return

    loginUser({
      username: usernameVal.trim(),
      password: passwordVal.trim(),
    }, {
      onSuccess: (data) => {
        // Supabase path: useSupabaseAuthSync (registered at the app root)
        // already populated the auth store from the real session — nothing
        // to decode here.
        if (!isSupabase()) {
          const token = jwtDecode<AccessToken>(data.data?.access)
          localStorage.setItem('auth', data.data?.access)
          setAuth(token)
        }
        toast.success('Logged in successfully!')
        void isOnboardingDone().then((done) => history.push(done ? defaultLandingPage : '/onboarding'))
      },
    })
  }

  const handleGoogleLogin = () => {
    if (!isSupabase()) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
      if (!apiUrl) {
        toast.error('API URL not configured')
        return
      }
    }
    oauthLogin({ provider: 'google' })
  }

  const inputBase =
    'w-full bg-white dark:bg-zinc-800/70 border border-gray-200 dark:border-zinc-700 rounded-2xl px-4 py-3.5 text-[15px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-all'

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Logo & heading */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-[72px] h-[72px] rounded-[20px] overflow-hidden mb-5 shadow-sm bg-white dark:bg-zinc-800 flex items-center justify-center">
          <Image
            src="/FicoLogoTrans1.png"
            alt="Fico"
            width={60}
            height={60}
            className="w-[60px] h-[60px] object-contain"
          />
        </div>
        <h1 className="text-[28px] font-bold text-gray-900 dark:text-white leading-tight">Log in or sign up</h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1.5">Manage your finances with Fico</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Username */}
        <div className="relative">
          <input
            type="text"
            value={usernameVal}
            onChange={e => setUsernameVal(e.target.value)}
            placeholder="Username or email"
            autoComplete="username"
            className={inputBase}
          />
          {usernameVal && (
            <button
              type="button"
              onClick={() => setUsernameVal('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
            >
              <div className="w-5 h-5 bg-gray-200 dark:bg-zinc-600 rounded-full flex items-center justify-center">
                <X className="w-3 h-3" />
              </div>
            </button>
          )}
        </div>

        {/* Password */}
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={passwordVal}
            onChange={e => setPasswordVal(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            className={`${inputBase} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex justify-end -mt-0.5">
          <Link
            to="#"
            className="text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        {/* Continue button */}
        <button
          type="submit"
          disabled={isPending || !usernameVal || !passwordVal}
          className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl py-3.5 font-semibold text-[15px] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40"
        >
          {isPending ? 'Signing in…' : 'Continue'}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-700" />
        <span className="text-xs text-gray-400 dark:text-zinc-500">or</span>
        <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-700" />
      </div>

      {/* Google OAuth */}
      <GoogleButton onClick={handleGoogleLogin} />

      {/* Sign up link */}
      <p className="text-center text-[13px] text-gray-500 dark:text-zinc-400 mt-6">
        New to Fico?{' '}
        <Link
          to="/signup"
          className="text-gray-900 dark:text-white font-semibold hover:underline"
        >
          Create an account
        </Link>
      </p>

      {/* Terms */}
      <p className="text-center text-[11px] text-gray-400 dark:text-zinc-600 mt-3 leading-relaxed">
        By continuing, you agree to our{' '}
        <Link to="#" className="underline hover:text-gray-600 dark:hover:text-zinc-400">Terms</Link>
        {' '}and{' '}
        <Link to="#" className="underline hover:text-gray-600 dark:hover:text-zinc-400">Privacy Policy</Link>
      </p>
    </div>
  )
}
