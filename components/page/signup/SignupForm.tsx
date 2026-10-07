'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { Eye, EyeOff, Check, ChevronLeft } from 'lucide-react'
import { Link, useHistory } from 'react-router-dom'
import { useSettingsStore } from '@/store/settings-store'
import { RegisterFormData, registerSchema } from '@/validation/auth'
import { useOAuthLogin, useRegisterUser } from '@/queries/auth/auth'
import { GoogleButton } from '@/components/page/auth/google-button'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { celebrate } from '@/store/celebration-store'

const STEPS = ['Account', 'Personal', 'Address', 'Review']

const STEP_SUBTITLES: Record<number, string> = {
  1: 'Set up your login details',
  2: 'Tell us a bit about yourself',
  3: 'Where are you located? (optional)',
  4: 'Review your information',
}

export function SignupForm() {
  const [currentStep, setCurrentStep] = useState(1)
  const [showPassword, setShowPassword] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState(0)
  const history = useHistory()

  const {
    register,
    handleSubmit,
    trigger,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      password: '',
      confirmPassword: '',
      email: undefined,
      phonenumber: undefined,
      firstname: undefined,
      lastname: undefined,
      address: undefined,
      city: undefined,
      country: undefined,
      postalcode: undefined,
    },
  })

  const { mutateAsync: registerUser, isPending } = useRegisterUser()
  const { mutate: oauthLogin, isPending: isGoogleRedirecting } = useOAuthLogin()
  const { setOnboardingCompleted } = useSettingsStore()

  const passwordValue = watch('password') || ''
  const confirmPasswordValue = watch('confirmPassword') || ''
  const watched = watch()

  const getPasswordStrength = (password: string) => {
    let strength = 0
    if (password.length >= 8) strength++
    if (password.length >= 12) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/[0-9]/.test(password)) strength++
    if (/[^A-Za-z0-9]/.test(password)) strength++
    return strength
  }

  useEffect(() => {
    setPasswordStrength(getPasswordStrength(passwordValue))
  }, [passwordValue])

  const stepFields: Record<number, (keyof RegisterFormData)[]> = {
    1: ['email', 'username', 'password', 'confirmPassword'],
    2: ['firstname', 'lastname', 'phonenumber'],
    3: ['address', 'city', 'country', 'postalcode'],
    4: [],
  }

  const handleNext = async () => {
    const isValid = await trigger(stepFields[currentStep], { shouldFocus: true })
    if (isValid && currentStep < 4) setCurrentStep(p => p + 1)
  }

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep(p => p - 1)
  }

  const onSubmit = async (data: RegisterFormData) => {
    await registerUser(data, {
      onSuccess: () => {
        celebrate({ kind: 'confetti', title: 'Welcome to Fico!', message: 'Your account is ready. Sign in and I will help you set everything up.', actionLabel: 'Let us go' })
        reset()
        setCurrentStep(1)
        setPasswordStrength(0)
        setShowPassword(false)
        // Reset onboarding so new user goes through the setup flow after logging in
        setOnboardingCompleted(false)
        history.push('/signin')
      },
    })
  }

  const isSaving = isSubmitting || isPending

  const handleGoogleSignUp = () => {
    // New accounts reach onboarding on their own; an existing one must not be reset.
    oauthLogin({ provider: 'google' })
  }

  const strengthColor =
    passwordStrength <= 2 ? 'bg-red-500' :
    passwordStrength <= 3 ? 'bg-amber-500' :
    'bg-emerald-500'

  const strengthLabel =
    passwordStrength <= 2 ? 'Weak' :
    passwordStrength <= 3 ? 'Fair' :
    'Strong'

  const inputBase =
    'w-full bg-white dark:bg-zinc-800/70 border border-gray-200 dark:border-zinc-700 rounded-2xl px-4 py-3.5 text-[15px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-all'

  const errorClass = 'text-xs text-red-500 mt-1.5 pl-1'

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Logo & heading */}
      <div className="flex flex-col items-center mb-7">
        <div className="w-[72px] h-[72px] rounded-[20px] overflow-hidden mb-5 shadow-md flex items-center justify-center">
          <Image
            src="/icon-512.png"
            alt="Fico"
            width={72}
            height={72}
            className="w-[72px] h-[72px] object-cover"
          />
        </div>
        <h1 className="text-[28px] font-bold text-gray-900 dark:text-white leading-tight">
          Create your account
        </h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1.5 text-center">
          {STEP_SUBTITLES[currentStep]}
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-7">
        {STEPS.map((_, i) => {
          const step = i + 1
          const isActive = step === currentStep
          const isDone = step < currentStep
          return (
            <div
              key={step}
              className={`h-[6px] rounded-full transition-all duration-300 ${
                isDone ? 'bg-emerald-500 w-6' :
                isActive ? 'bg-gray-900 dark:bg-white w-6' :
                'bg-gray-200 dark:bg-zinc-700 w-[6px]'
              }`}
            />
          )
        })}
      </div>

      <form
        onKeyDown={e => {
          if (e.key === 'Enter' && currentStep !== 4) {
            e.preventDefault()
            void handleNext()
          }
        }}
        className="space-y-3"
      >
        {/* Step 1 – Account */}
        {currentStep === 1 && (
          <div className="space-y-3">
            <div>
              <input
                type="email"
                placeholder="Email address"
                autoComplete="email"
                className={inputBase}
                {...register('email', {
                  setValueAs: v => v?.trim()?.toLowerCase() || undefined,
                })}
              />
              {errors.email && <p className={errorClass}>{errors.email.message}</p>}
            </div>
            <div>
              <input
                type="text"
                placeholder="Username"
                autoComplete="username"
                className={inputBase}
                {...register('username', { setValueAs: v => v?.trim() })}
              />
              {errors.username && <p className={errorClass}>{errors.username.message}</p>}
            </div>
            <div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  autoComplete="new-password"
                  className={`${inputBase} pr-11`}
                  {...register('password', { setValueAs: v => v?.trim() })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordValue && (
                <div className="flex items-center gap-2 mt-2 px-1">
                  <div className="flex-1 flex gap-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= passwordStrength ? strengthColor : 'bg-gray-200 dark:bg-zinc-700'}`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-gray-500 dark:text-zinc-400 w-10 text-right">{strengthLabel}</span>
                </div>
              )}
              {errors.password && <p className={errorClass}>{errors.password.message}</p>}
            </div>
            <div className="relative">
              <input
                type="password"
                placeholder="Confirm password"
                autoComplete="new-password"
                className={`${inputBase} pr-11`}
                {...register('confirmPassword', {
                  setValueAs: v => v?.trim() || undefined,
                })}
              />
              {confirmPasswordValue && passwordValue === confirmPasswordValue && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              {errors.confirmPassword && <p className={errorClass}>{errors.confirmPassword.message}</p>}
            </div>
          </div>
        )}

        {/* Step 2 – Personal */}
        {currentStep === 2 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  type="text"
                  placeholder="First name"
                  className={inputBase}
                  {...register('firstname', { setValueAs: v => v?.trim() || undefined })}
                />
                {errors.firstname && <p className={errorClass}>{errors.firstname.message}</p>}
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Last name"
                  className={inputBase}
                  {...register('lastname', { setValueAs: v => v?.trim() || undefined })}
                />
                {errors.lastname && <p className={errorClass}>{errors.lastname.message}</p>}
              </div>
            </div>
            <div>
              <input
                type="tel"
                placeholder="Phone number (optional)"
                className={inputBase}
                {...register('phonenumber', {
                  setValueAs: v => v?.trim() || undefined,
                })}
              />
              {errors.phonenumber && <p className={errorClass}>{errors.phonenumber.message}</p>}
            </div>
          </div>
        )}

        {/* Step 3 – Address */}
        {currentStep === 3 && (
          <div className="space-y-3">
            <div>
              <input
                type="text"
                placeholder="Street address"
                className={inputBase}
                {...register('address', { setValueAs: v => v?.trim() || undefined })}
              />
              {errors.address && <p className={errorClass}>{errors.address.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  type="text"
                  placeholder="City"
                  className={inputBase}
                  {...register('city', { setValueAs: v => v?.trim() || undefined })}
                />
                {errors.city && <p className={errorClass}>{errors.city.message}</p>}
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Postal code"
                  className={inputBase}
                  {...register('postalcode', { setValueAs: v => v?.trim() || undefined })}
                />
                {errors.postalcode && <p className={errorClass}>{errors.postalcode.message}</p>}
              </div>
            </div>
            <div>
              <input
                type="text"
                placeholder="Country"
                className={inputBase}
                {...register('country', { setValueAs: v => v?.trim() || undefined })}
              />
              {errors.country && <p className={errorClass}>{errors.country.message}</p>}
            </div>
          </div>
        )}

        {/* Step 4 – Review */}
        {currentStep === 4 && (
          <div className="bg-white dark:bg-zinc-800/70 border border-gray-200 dark:border-zinc-700 rounded-2xl p-4 space-y-2.5 text-[14px]">
            <ReviewRow label="Email" value={watched.email} />
            <ReviewRow label="Username" value={watched.username} />
            {(watched.firstname || watched.lastname || watched.phonenumber) && (
              <>
                <div className="h-px bg-gray-100 dark:bg-zinc-700 my-1" />
                <ReviewRow label="First name" value={watched.firstname} />
                <ReviewRow label="Last name" value={watched.lastname} />
                <ReviewRow label="Phone" value={watched.phonenumber} />
              </>
            )}
            {(watched.address || watched.city || watched.country) && (
              <>
                <div className="h-px bg-gray-100 dark:bg-zinc-700 my-1" />
                <ReviewRow label="Address" value={watched.address} />
                <ReviewRow label="City" value={watched.city} />
                <ReviewRow label="Country" value={watched.country} />
                <ReviewRow label="Postal" value={watched.postalcode} />
              </>
            )}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="pt-2 space-y-3">
          {currentStep < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={isSaving}
              className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl py-3.5 font-semibold text-[15px] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleSubmit(onSubmit)()}
              disabled={isSaving}
              className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl py-3.5 font-semibold text-[15px] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40"
            >
              {isSaving ? 'Creating account…' : 'Create account'}
            </button>
          )}

          {currentStep > 1 && (
            <button
              type="button"
              onClick={handlePrev}
              disabled={isSaving}
              className="w-full border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 rounded-2xl py-3.5 font-semibold text-[15px] hover:bg-gray-50 dark:hover:bg-zinc-800 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}
        </div>
      </form>

      {currentStep === 1 && (
        <>
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-700" />
            <span className="text-xs text-gray-400 dark:text-zinc-500">or</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-700" />
          </div>
          <GoogleButton onClick={handleGoogleSignUp} label="Sign up with Google" disabled={isSaving || isGoogleRedirecting} />
        </>
      )}

      <p className="text-center text-[13px] text-gray-500 dark:text-zinc-400 mt-6">
        Already have an account?{' '}
        <Link to="/signin" className="text-gray-900 dark:text-white font-semibold hover:underline">
          Sign in
        </Link>
      </p>

      <p className="text-center text-[11px] text-gray-400 dark:text-zinc-600 mt-3 leading-relaxed">
        By continuing, you agree to our{' '}
        <Link to="#" className="underline hover:text-gray-600 dark:hover:text-zinc-400">Terms</Link>
        {' '}and{' '}
        <Link to="#" className="underline hover:text-gray-600 dark:hover:text-zinc-400">Privacy Policy</Link>
      </p>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-gray-500 dark:text-zinc-400 flex-shrink-0">{label}</span>
      <span className="font-medium text-gray-900 dark:text-white text-right truncate">{value}</span>
    </div>
  )
}
