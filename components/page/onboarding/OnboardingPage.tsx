'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useHistory } from 'react-router-dom'
import {
  Sun, Moon, LayoutDashboard, ArrowLeftRight, Wallet, Receipt, PieChart,
  ChevronLeft, Check, Calendar, Eye, EyeOff, AlignJustify, AlignCenter,
  Sparkles,
} from 'lucide-react'
import { useSettingsStore } from '@/store/settings-store'
import { useThemeStore } from '@/store/theme-store'
import { useAuthStore } from '@/store/auth-store'
import { markOnboardingDone } from '@/utils/onboarding'
import type { CurrencyCode, DateFormat, LandingPage } from '@/types/settings'

// ─── Static data ──────────────────────────────────────────────────────────────

const CURRENCIES: { code: CurrencyCode; flag: string; name: string; symbol: string }[] = [
  { code: 'USD', flag: '🇺🇸', name: 'US Dollar',          symbol: '$'    },
  { code: 'EUR', flag: '🇪🇺', name: 'Euro',                symbol: '€'    },
  { code: 'GBP', flag: '🇬🇧', name: 'British Pound',       symbol: '£'    },
  { code: 'CAD', flag: '🇨🇦', name: 'Canadian Dollar',     symbol: 'C$'   },
  { code: 'AUD', flag: '🇦🇺', name: 'Australian Dollar',   symbol: 'A$'   },
  { code: 'PHP', flag: '🇵🇭', name: 'Philippine Peso',     symbol: '₱'    },
  { code: 'NGN', flag: '🇳🇬', name: 'Nigerian Naira',      symbol: '₦'    },
  { code: 'GHS', flag: '🇬🇭', name: 'Ghanaian Cedi',       symbol: 'GH₵'  },
  { code: 'KES', flag: '🇰🇪', name: 'Kenyan Shilling',     symbol: 'KSh'  },
  { code: 'ZAR', flag: '🇿🇦', name: 'South African Rand',  symbol: 'R'    },
]

type LandingOption = { path: LandingPage; label: string; desc: string; Icon: React.ComponentType<{ className?: string }> }
const LANDING_OPTIONS: LandingOption[] = [
  { path: '/dashboard',    Icon: LayoutDashboard, label: 'Dashboard',    desc: 'Overview of everything'  },
  { path: '/transactions', Icon: ArrowLeftRight,  label: 'Transactions', desc: 'Your daily money flow'  },
  { path: '/wallets',      Icon: Wallet,          label: 'Wallets',      desc: 'All your accounts'      },
  { path: '/bills',        Icon: Receipt,         label: 'Bills',        desc: 'Upcoming payments'      },
  { path: '/budgets',      Icon: PieChart,        label: 'Budgets',      desc: 'Spending limits'        },
]

const DATE_FORMATS: { value: DateFormat; label: string; example: string }[] = [
  { value: 'MM/DD/YYYY', label: 'Month first', example: '06/27/2026' },
  { value: 'DD/MM/YYYY', label: 'Day first',   example: '27/06/2026' },
  { value: 'YYYY-MM-DD', label: 'ISO standard', example: '2026-06-27' },
]

const TOTAL_STEPS = 5

// ─── Main component ───────────────────────────────────────────────────────────

export function OnboardingPage() {
  const [step, setStep] = useState(0)
  const history = useHistory()

  const { user } = useAuthStore()
  const { isDarkMode, setDarkMode } = useThemeStore()
  const {
    currency, setCurrency,
    hideAmountsOnOpen, setHideAmountsOnOpen,
    compactLayout, setCompactLayout,
    defaultLandingPage, setDefaultLandingPage,
    dateFormat, setDateFormat,
  } = useSettingsStore()

  const username = user?.username ?? 'there'

  const finish = () => {
    void markOnboardingDone()
    history.push(defaultLandingPage)
  }

  const next = () => setStep(s => s + 1)
  const back = () => setStep(s => s - 1)

  const progress = step >= 1 && step <= TOTAL_STEPS ? (step / TOTAL_STEPS) * 100 : 0

  // Shared card styles
  const card = 'relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 p-4 cursor-pointer transition-all duration-200 select-none active:scale-[0.97] text-center'
  const sel  = 'border-gray-900 dark:border-white bg-gray-900/5 dark:bg-white/10'
  const idle = 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 hover:border-gray-300 dark:hover:border-zinc-600'

  return (
    <div className="min-h-full bg-[#f5f5f5] dark:bg-zinc-950 flex flex-col">

      {/* ── Thin gradient progress bar ─────────────────────────────────── */}
      {/* sticky (not a separate overflow-y-auto region) so it stays visible
          while IonContent handles all scrolling natively — nesting our own
          scroll container inside IonContent breaks scroll gestures on iOS. */}
      <div className="h-1 w-full bg-gray-200 dark:bg-zinc-800 sticky top-0 z-10">
        <div
          className="h-full bg-gradient-to-r from-violet-500 via-indigo-500 to-sky-500 transition-all duration-500 ease-out rounded-r-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">

          {/* ═══════════════════════ STEP 0 – WELCOME ══════════════════ */}
          {step === 0 && (
            <div className="flex flex-col items-center text-center animate-fade-in">
              <div className="relative mb-7">
                <div className="w-24 h-24 rounded-[28px] overflow-hidden shadow-xl flex items-center justify-center">
                  <Image src="/icon-512.png" alt="Fico" width={96} height={96} className="h-24 w-24 object-cover" />
                </div>
                <div className="absolute -bottom-1.5 -right-1.5 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              </div>

              <h1 className="text-[32px] font-bold text-gray-900 dark:text-white leading-tight">
                Welcome, {username}!
              </h1>
              <p className="text-gray-500 dark:text-zinc-400 mt-3 text-[15px] leading-relaxed max-w-[270px]">
                Let's personalise Fico so it works exactly the way you want it to.
              </p>
              <p className="text-gray-400 dark:text-zinc-600 mt-2 text-xs">Takes less than a minute</p>

              <button
                onClick={next}
                className="mt-9 w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl py-4 font-semibold text-[16px] hover:opacity-90 active:scale-[0.98] transition-all shadow-lg"
              >
                Get started
              </button>
              <button
                onClick={finish}
                className="mt-3.5 text-sm text-gray-400 dark:text-zinc-600 hover:text-gray-600 dark:hover:text-zinc-400 transition-colors"
              >
                Skip for now
              </button>
            </div>
          )}

          {/* ═══════════════════════ STEP 1 – CURRENCY ═════════════════ */}
          {step === 1 && (
            <div className="animate-fade-in">
              <StepHeader
                step={1} total={TOTAL_STEPS}
                title="Your currency"
                subtitle="Used across all balances, budgets, and spending summaries."
              />
              <div className="grid grid-cols-2 gap-3 mt-5">
                {CURRENCIES.map(c => {
                  const active = currency === c.code
                  return (
                    <button
                      key={c.code}
                      onClick={() => setCurrency(c.code)}
                      className={`${card} ${active ? sel : idle}`}
                    >
                      {active && <CheckBadge dark={isDarkMode} />}
                      <span className="text-[32px] leading-none">{c.flag}</span>
                      <span className="font-bold text-gray-900 dark:text-white text-sm mt-1">{c.code}</span>
                      <span className="text-[11px] text-gray-500 dark:text-zinc-400 leading-tight">{c.name}</span>
                      <span className="text-[11px] font-mono text-gray-400 dark:text-zinc-500">{c.symbol}</span>
                    </button>
                  )
                })}
              </div>
              <StepButtons onNext={next} onBack={back} />
            </div>
          )}

          {/* ═══════════════════════ STEP 2 – APPEARANCE ═══════════════ */}
          {step === 2 && (
            <div className="animate-fade-in">
              <StepHeader
                step={2} total={TOTAL_STEPS}
                title="How do you like it?"
                subtitle="Pick a look. You can always change this in Settings."
              />

              {/* Theme picker */}
              <div className="grid grid-cols-2 gap-3 mt-5">
                {/* Light */}
                <button
                  onClick={() => setDarkMode(false)}
                  className={`${card} py-6 ${!isDarkMode ? sel : idle}`}
                >
                  {!isDarkMode && <CheckBadge dark={false} />}
                  <div className="w-12 h-12 rounded-xl bg-[#f1f5f9] border border-gray-200 flex items-center justify-center mb-1 shadow-sm">
                    <Sun className="w-6 h-6 text-amber-400" />
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white text-sm">Light</span>
                  <span className="text-[11px] text-gray-400 dark:text-zinc-500">Clean & bright</span>
                </button>

                {/* Dark */}
                <button
                  onClick={() => setDarkMode(true)}
                  className={`${card} py-6 ${isDarkMode ? sel : idle}`}
                >
                  {isDarkMode && <CheckBadge dark={true} />}
                  <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center mb-1 shadow-sm">
                    <Moon className="w-6 h-6 text-indigo-400" />
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white text-sm">Dark</span>
                  <span className="text-[11px] text-gray-400 dark:text-zinc-500">Easy on the eyes</span>
                </button>
              </div>

              {/* Compact layout toggle */}
              <button
                onClick={() => setCompactLayout(!compactLayout)}
                className={`mt-3 w-full flex items-center justify-between px-4 py-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer active:scale-[0.98] ${compactLayout ? sel : idle}`}
              >
                <div className="flex items-center gap-3">
                  {compactLayout
                    ? <AlignJustify className="w-5 h-5 text-gray-700 dark:text-zinc-300" />
                    : <AlignCenter  className="w-5 h-5 text-gray-700 dark:text-zinc-300" />
                  }
                  <div className="text-left">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">Compact layout</p>
                    <p className="text-[11px] text-gray-500 dark:text-zinc-400">Fits more content on screen</p>
                  </div>
                </div>
                <Toggle on={compactLayout} />
              </button>

              <StepButtons onNext={next} onBack={back} />
            </div>
          )}

          {/* ═══════════════════════ STEP 3 – HOME SCREEN ══════════════ */}
          {step === 3 && (
            <div className="animate-fade-in">
              <StepHeader
                step={3} total={TOTAL_STEPS}
                title="Your home screen"
                subtitle="Which page should open when you launch the app?"
              />
              <div className="space-y-2.5 mt-5">
                {LANDING_OPTIONS.map(opt => {
                  const active = defaultLandingPage === opt.path
                  const { Icon } = opt
                  return (
                    <button
                      key={opt.path}
                      onClick={() => setDefaultLandingPage(opt.path)}
                      className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border-2 transition-all duration-200 active:scale-[0.98] cursor-pointer ${active ? sel : idle}`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${active ? 'bg-gray-900 dark:bg-white' : 'bg-gray-100 dark:bg-zinc-700'}`}>
                        <Icon className={`w-5 h-5 ${active ? 'text-white dark:text-gray-900' : 'text-gray-600 dark:text-zinc-300'}`} />
                      </div>
                      <div className="text-left flex-1">
                        <p className={`font-semibold text-sm ${active ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-zinc-200'}`}>{opt.label}</p>
                        <p className="text-[11px] text-gray-400 dark:text-zinc-500">{opt.desc}</p>
                      </div>
                      {active && (
                        <div className="w-5 h-5 bg-gray-900 dark:bg-white rounded-full flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3 text-white dark:text-gray-900" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
              <StepButtons onNext={next} onBack={back} />
            </div>
          )}

          {/* ═══════════════════════ STEP 4 – PREFERENCES ══════════════ */}
          {step === 4 && (
            <div className="animate-fade-in">
              <StepHeader
                step={4} total={TOTAL_STEPS}
                title="A few final touches"
                subtitle="These make Fico feel completely yours."
              />

              {/* Date format */}
              <div className="mt-5">
                <p className="text-[13px] font-semibold text-gray-600 dark:text-zinc-400 mb-2.5 flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5" />
                  Date format
                </p>
                <div className="space-y-2">
                  {DATE_FORMATS.map(df => {
                    const active = dateFormat === df.value
                    return (
                      <button
                        key={df.value}
                        onClick={() => setDateFormat(df.value)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all duration-200 active:scale-[0.98] cursor-pointer ${active ? sel : idle}`}
                      >
                        <div className="text-left">
                          <p className={`font-semibold text-sm ${active ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-zinc-200'}`}>{df.label}</p>
                          <p className="text-[11px] font-mono text-gray-400 dark:text-zinc-500">{df.example}</p>
                        </div>
                        {active && (
                          <div className="w-5 h-5 bg-gray-900 dark:bg-white rounded-full flex items-center justify-center flex-shrink-0">
                            <Check className="w-3 h-3 text-white dark:text-gray-900" />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Privacy: hide amounts */}
              <div className="mt-4">
                <p className="text-[13px] font-semibold text-gray-600 dark:text-zinc-400 mb-2.5 flex items-center gap-2">
                  {hideAmountsOnOpen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  Privacy
                </p>
                <button
                  onClick={() => setHideAmountsOnOpen(!hideAmountsOnOpen)}
                  className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer active:scale-[0.98] ${hideAmountsOnOpen ? sel : idle}`}
                >
                  <div className="text-left">
                    <p className={`font-semibold text-sm ${hideAmountsOnOpen ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-zinc-200'}`}>
                      Hide balances on open
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-zinc-500">Tap to reveal your amounts</p>
                  </div>
                  <Toggle on={hideAmountsOnOpen} />
                </button>
              </div>

              <StepButtons onNext={next} onBack={back} />
            </div>
          )}

          {/* ═══════════════════════ STEP 5 – ALL SET ══════════════════ */}
          {step === 5 && (
            <div className="flex flex-col items-center text-center animate-fade-in">
              {/* Animated success ring */}
              <div className="relative mb-7">
                <div className="w-28 h-28 rounded-full bg-emerald-100 dark:bg-emerald-900/25 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                    <Check className="w-10 h-10 text-white" strokeWidth={2.5} />
                  </div>
                </div>
              </div>

              <h1 className="text-[32px] font-bold text-gray-900 dark:text-white leading-tight">
                You're all set!
              </h1>
              <p className="text-gray-500 dark:text-zinc-400 mt-2 text-[15px]">
                Here's what we configured for you
              </p>

              {/* Summary card */}
              <div className="mt-6 w-full bg-white dark:bg-zinc-800/70 border border-gray-200 dark:border-zinc-700 rounded-2xl p-4 text-left">
                <SummaryRow
                  label="Currency"
                  value={`${CURRENCIES.find(c => c.code === currency)?.flag ?? ''} ${currency} · ${CURRENCIES.find(c => c.code === currency)?.name ?? ''}`}
                />
                <SummaryDivider />
                <SummaryRow label="Theme"   value={isDarkMode ? '🌙 Dark mode' : '☀️ Light mode'} />
                <SummaryRow label="Layout"  value={compactLayout ? 'Compact' : 'Standard'} />
                <SummaryDivider />
                <SummaryRow
                  label="Opens on"
                  value={LANDING_OPTIONS.find(o => o.path === defaultLandingPage)?.label ?? 'Dashboard'}
                />
                <SummaryRow label="Dates"   value={dateFormat} />
                <SummaryRow label="Privacy" value={hideAmountsOnOpen ? 'Balances hidden' : 'Balances visible'} />
              </div>

              <button
                onClick={finish}
                className="mt-6 w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl py-4 font-semibold text-[16px] hover:opacity-90 active:scale-[0.98] transition-all shadow-lg"
              >
                Go to Fico →
              </button>
              <button
                onClick={back}
                className="mt-3 text-sm text-gray-400 dark:text-zinc-600 hover:text-gray-600 dark:hover:text-zinc-400 transition-colors flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Go back
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function StepHeader({ step, total, title, subtitle }: {
  step: number; total: number; title: string; subtitle: string
}) {
  return (
    <div>
      <p className="text-xs text-gray-400 dark:text-zinc-600 font-medium mb-1">
        Step {step} of {total}
      </p>
      <h2 className="text-[24px] font-bold text-gray-900 dark:text-white leading-tight">{title}</h2>
      <p className="text-[14px] text-gray-500 dark:text-zinc-400 mt-1.5">{subtitle}</p>
    </div>
  )
}

function StepButtons({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <div className="mt-6 space-y-2.5">
      <button
        type="button"
        onClick={onNext}
        className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl py-3.5 font-semibold text-[15px] hover:opacity-90 active:scale-[0.98] transition-all"
      >
        Continue
      </button>
      <button
        type="button"
        onClick={onBack}
        className="w-full border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 rounded-2xl py-3.5 font-semibold text-[15px] hover:bg-gray-100 dark:hover:bg-zinc-800 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
      >
        <ChevronLeft className="w-4 h-4" /> Back
      </button>
    </div>
  )
}

function Toggle({ on }: { on: boolean }) {
  return (
    <div className={`w-12 h-6 rounded-full flex items-center px-1 transition-all duration-300 flex-shrink-0 ${on ? 'bg-gray-900 dark:bg-white justify-end' : 'bg-gray-200 dark:bg-zinc-700 justify-start'}`}>
      <div className="w-4 h-4 rounded-full bg-white dark:bg-gray-900 shadow-sm" />
    </div>
  )
}

function CheckBadge({ dark }: { dark: boolean }) {
  return (
    <span className={`absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center ${dark ? 'bg-white' : 'bg-gray-900'}`}>
      <Check className={`w-3 h-3 ${dark ? 'text-gray-900' : 'text-white'}`} />
    </span>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-[13px] text-gray-500 dark:text-zinc-400 flex-shrink-0">{label}</span>
      <span className="text-[13px] font-medium text-gray-900 dark:text-white text-right truncate">{value}</span>
    </div>
  )
}

function SummaryDivider() {
  return <div className="h-px bg-gray-100 dark:bg-zinc-700 my-1" />
}
