'use client'

import { useState } from 'react'
import { Eye, EyeOff, Sparkles } from 'lucide-react'
import { PeacockMascot } from '@/components/peacock-mascot'
import { BillSummary } from '@/types/bill'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { Skeleton } from '@/components/ui/skeleton'

interface BillsOverviewProps {
  summary: BillSummary
  upcomingCount: number
  overdueCount: number
  isLoading?: boolean
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
    </svg>
  )
}

/**
 * Top of the Bills page, built like the Home balance card: Fico's thought bubble,
 * the peacock on the card edge, then what is still to pay and a few key numbers.
 */
export function BillsOverview({ summary, upcomingCount, overdueCount, isLoading }: BillsOverviewProps) {
  const { currency, hideAmountsOnOpen } = useSettingsStore()
  const [showAmounts, setShowAmounts] = useState(!hideAmountsOnOpen)
  const money = (value: number) => formatMoney(value, currency, !showAmounts)

  let note = 'Nothing on your list yet. Add a bill or an income entry and I will keep track of it.'
  if (overdueCount > 0) {
    note = `${overdueCount} ${overdueCount === 1 ? 'entry is' : 'entries are'} overdue. Settle ${overdueCount === 1 ? 'it' : 'them'} first to stay on track.`
  } else if (upcomingCount > 0) {
    note = `${upcomingCount} ${upcomingCount === 1 ? 'entry is' : 'entries are'} due in the next 7 days.`
  } else if (summary.totalBills > 0) {
    note = summary.unpaidBills > 0 ? 'Nothing is due this week. You are ahead of it.' : 'Everything is paid. Nicely done.'
  }

  const tiles = [
    { label: 'Due soon', value: `${upcomingCount}` },
    { label: 'Overdue', value: `${overdueCount}` },
    { label: 'Paid', value: money(summary.paidAmount) },
  ]

  return (
    <section>
      <div className="relative z-10 mb-3 flex items-end">
        <div className="relative min-w-0 max-w-2xl flex-1 rounded-[1.75rem] border border-border bg-card px-4 py-3.5 shadow-ios">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Fico&apos;s reminder
          </p>
          {isLoading ? (
            <div className="mt-2 space-y-2" aria-label="Loading">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-2/3" />
            </div>
          ) : (
            <p className="mt-1.5 text-[15px] leading-relaxed text-foreground">{note}</p>
          )}
          <span aria-hidden="true" className="absolute -right-3.5 bottom-6 h-3.5 w-3.5 rounded-full border border-border bg-card shadow-sm sm:bottom-8" />
          <span aria-hidden="true" className="absolute -right-[1.65rem] bottom-4 h-2 w-2 rounded-full border border-border bg-card shadow-sm sm:bottom-6" />
        </div>
        <PeacockMascot pose={overdueCount > 0 ? 'advisor' : 'happy'} glasses className="-mb-10 ml-7 h-24 w-24 shrink-0 sm:h-28 sm:w-28" label="Fico, your financial advisor" />
      </div>

      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-[#004C99] px-5 pb-5 pt-9 text-white shadow-ios-lg">
        <EyeSpots />
        <div className="relative">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-white/75">Still to pay</p>
            <button
              type="button"
              onClick={() => setShowAmounts((v) => !v)}
              aria-label={showAmounts ? 'Hide amounts' : 'Show amounts'}
              className="rounded-full p-1 text-white/75 hover:bg-white/15 hover:text-white"
            >
              {showAmounts ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {isLoading ? (
            <>
              <Skeleton className="mt-2 h-10 w-52 bg-white/20 sm:h-12" />
              <Skeleton className="mt-2 h-3 w-24 bg-white/20" />
            </>
          ) : (
            <>
              <p className="mt-1 font-heading text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">{money(summary.unpaidAmount)}</p>
              <p className="mt-1 text-xs text-white/75">
                {summary.unpaidBills} unpaid of {summary.totalBills} entr{summary.totalBills === 1 ? 'y' : 'ies'}
              </p>
            </>
          )}

          <div className="mt-4 grid grid-cols-3 gap-3">
            {tiles.map((tile) => (
              <div key={tile.label} className="rounded-2xl bg-white/12 p-3">
                <p className="text-xs font-medium text-white/75">{tile.label}</p>
                <div className="mt-1 truncate text-base font-semibold tabular-nums sm:text-lg">
                  {isLoading ? <Skeleton className="h-6 w-16 bg-white/20" /> : tile.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
