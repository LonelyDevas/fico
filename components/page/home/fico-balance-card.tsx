'use client'

import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff, Sparkles } from 'lucide-react'
import { PeacockMascot } from '@/components/peacock-mascot'
import { Skeleton } from '@/components/ui/skeleton'

export type Period = 'today' | 'week' | 'month'

export const PERIODS: { label: string; value: Period; phrase: string }[] = [
  { label: 'Today', value: 'today', phrase: 'today' },
  { label: 'Week', value: 'week', phrase: 'this week' },
  { label: 'Month', value: 'month', phrase: 'this month' },
]

interface FicoBalanceCardProps {
  /** Fico's thought, shown in the bubble above the card. */
  note: string
  balance: string
  income: string
  expenses: string
  statsLoading?: boolean
  balanceLoading?: boolean
  noteLoading?: boolean
  period: Period
  onPeriodChange: (period: Period) => void
  showAmounts: boolean
  onToggleAmounts: () => void
}

/** Concentric eye-spot rings, the same motif as the peacock's tail feathers. */
function EyeSpots() {
  return (
    <svg viewBox="0 0 200 200" className="pointer-events-none absolute -bottom-10 -right-10 h-56 w-56 opacity-25" aria-hidden="true">
      <g transform="translate(120 110)">
        <circle r="70" fill="#00D9CC" />
        <circle r="48" fill="#0066CC" />
        <circle r="28" fill="#00D9CC" />
        <circle r="11" fill="#2ECC71" />
      </g>
      <g transform="translate(40 40)">
        <circle r="30" fill="#00D9CC" />
        <circle r="19" fill="#0066CC" />
        <circle r="9" fill="#00D9CC" />
      </g>
    </svg>
  )
}

/**
 * The top of the home screen in one piece: Fico's thought bubble above the card, the
 * peacock standing on the card's top edge beside it, and the balance card below.
 */
export function FicoBalanceCard({
  note,
  balance,
  income,
  expenses,
  statsLoading,
  balanceLoading,
  noteLoading,
  period,
  onPeriodChange,
  showAmounts,
  onToggleAmounts,
}: FicoBalanceCardProps) {
  return (
    <section>
      {/* Thought bubble and peacock */}
      <div className="relative z-10 mb-3 flex items-end">
        <div className="relative min-w-0 max-w-2xl flex-1 rounded-[1.75rem] border border-border bg-card px-4 py-3.5 shadow-ios">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Fico is thinking
          </p>
          {noteLoading ? (
            <div className="mt-2 space-y-2" aria-label="Loading">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-3/4" />
            </div>
          ) : (
            <p className="mt-1.5 text-[15px] leading-relaxed text-foreground">{note}</p>
          )}
          {/* Thought trail leading to the peacock */}
          <span aria-hidden="true" className="absolute -right-3.5 bottom-6 h-3.5 w-3.5 rounded-full border border-border bg-card shadow-sm sm:bottom-8" />
          <span aria-hidden="true" className="absolute -right-[1.65rem] bottom-4 h-2 w-2 rounded-full border border-border bg-card shadow-sm sm:bottom-6" />
        </div>
        <PeacockMascot
          pose="advisor"
          className="-mb-10 ml-7 h-24 w-24 shrink-0 sm:h-28 sm:w-28"
          label="Fico, your financial advisor"
        />
      </div>

      {/* Balance */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-[#004C99] px-5 pb-5 pt-9 text-white shadow-ios-lg">
        <EyeSpots />
        <div className="relative">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-white/75">Total balance</p>
            <button
              type="button"
              onClick={onToggleAmounts}
              aria-label={showAmounts ? 'Hide amounts' : 'Show amounts'}
              className="rounded-full p-1 text-white/75 hover:bg-white/15 hover:text-white"
            >
              {showAmounts ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {balanceLoading ? (
            <Skeleton className="mt-2 h-10 w-52 bg-white/20 sm:h-12" />
          ) : (
            <p className="mt-1 font-heading text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">{balance}</p>
          )}

          <div role="group" aria-label="Time range" className="mt-4 inline-flex rounded-full bg-white/15 p-1 text-xs font-semibold">
            {PERIODS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={period === option.value}
                onClick={() => onPeriodChange(option.value)}
                className={`rounded-full px-3.5 py-1.5 transition-colors ${
                  period === option.value ? 'bg-white text-primary' : 'text-white/80 hover:text-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/12 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-white/75">
                <ArrowDownLeft className="h-3.5 w-3.5 text-[#2ECC71]" />
                Money in
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{statsLoading ? <Skeleton className="h-6 w-24 bg-white/20" /> : income}</p>
            </div>
            <div className="rounded-2xl bg-white/12 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-white/75">
                <ArrowUpRight className="h-3.5 w-3.5 text-[#FFB08F]" />
                Money out
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{statsLoading ? <Skeleton className="h-6 w-24 bg-white/20" /> : expenses}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
