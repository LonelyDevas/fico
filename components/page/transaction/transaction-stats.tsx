'use client'

import { useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff, Shuffle, Sparkles } from 'lucide-react'
import { PeacockMascot } from '@/components/peacock-mascot'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { Skeleton } from '@/components/ui/skeleton'

interface TransactionStats {
  totalIncome: number
  totalExpense: number
  totalTransfers: number
  transactionCount: number
}

interface TransactionStatsProps {
  stats: TransactionStats
  isLoading?: boolean
  /** Short phrase for the selected range, e.g. "this month". */
  periodPhrase: string
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
 * Top of the Activity page, in the same shape as the Home balance card: Fico's
 * thought bubble, the peacock on the card edge, then the period's numbers.
 */
export function TransactionStats({ stats, isLoading, periodPhrase }: TransactionStatsProps) {
  const { currency, hideAmountsOnOpen } = useSettingsStore()
  const [showAmounts, setShowAmounts] = useState(!hideAmountsOnOpen)
  const money = (value: number) => formatMoney(value, currency, !showAmounts)
  const net = stats.totalIncome - stats.totalExpense

  let note = `No activity ${periodPhrase} yet. Tap + to add something and I will start keeping score.`
  if (stats.transactionCount > 0) {
    note =
      net >= 0
        ? `You kept ${formatMoney(net, currency, false)} of what came in ${periodPhrase}. Keep it up.`
        : `You spent ${formatMoney(Math.abs(net), currency, false)} more than you earned ${periodPhrase}. Worth a look at where it went.`
  }

  const tiles = [
    { label: 'In', value: stats.totalIncome, icon: <ArrowDownLeft className="h-3.5 w-3.5 text-[#2ECC71]" /> },
    { label: 'Out', value: stats.totalExpense, icon: <ArrowUpRight className="h-3.5 w-3.5 text-[#FFB08F]" /> },
    { label: 'Transfers', value: stats.totalTransfers, icon: <Shuffle className="h-3.5 w-3.5 text-white/80" /> },
  ]

  return (
    <section>
      <div className="relative z-10 mb-3 flex items-end">
        <div className="relative min-w-0 max-w-2xl flex-1 rounded-[1.75rem] border border-border bg-card px-4 py-3.5 shadow-ios">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Fico&apos;s read
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
        <PeacockMascot pose={stats.transactionCount > 0 && net >= 0 ? 'happy' : 'advisor'} glasses className="-mb-10 ml-7 h-24 w-24 shrink-0 sm:h-28 sm:w-28" label="Fico, your financial advisor" />
      </div>

      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-[#004C99] px-5 pb-5 pt-9 text-white shadow-ios-lg">
        <EyeSpots />
        <div className="relative">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-white/75">Net {periodPhrase}</p>
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
              <p className="mt-1 font-heading text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
                {`${net > 0 ? '+' : ''}${formatMoney(net, currency, !showAmounts)}`}
              </p>
              <p className="mt-1 text-xs text-white/75">
                {stats.transactionCount} transaction{stats.transactionCount === 1 ? '' : 's'}
              </p>
            </>
          )}

          <div className="mt-4 grid grid-cols-3 gap-3">
            {tiles.map((tile) => (
              <div key={tile.label} className="rounded-2xl bg-white/12 p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-white/75">
                  {tile.icon}
                  {tile.label}
                </p>
                <div className="mt-1 truncate text-base font-semibold tabular-nums sm:text-lg">{isLoading ? <Skeleton className="h-6 w-20 bg-white/20" /> : money(tile.value)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
