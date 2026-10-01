'use client'

import { Eye, EyeOff, Plus, Sparkles } from 'lucide-react'
import { PeacockMascot } from '@/components/peacock-mascot'

interface MoneyOverviewCardProps {
  /** Fico's thought, shown in the bubble above the card. */
  note: string
  /** Assets minus what is owed on credit cards. */
  netWorth: string
  assets: string
  owed: string
  interest: string
  /** Hide the "Owed" tile when the user has no credit cards. */
  hasCards: boolean
  /** Hide the "Interest" tile when the user has no savings. */
  hasSavings: boolean
  showAmounts: boolean
  onToggleAmounts: () => void
  onAdd: () => void
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
 * Top of the Money page, built like the Home balance card: Fico's thought bubble,
 * the peacock standing on the card's edge, then net worth and a few key numbers.
 */
export function MoneyOverviewCard({
  note,
  netWorth,
  assets,
  owed,
  interest,
  hasCards,
  hasSavings,
  showAmounts,
  onToggleAmounts,
  onAdd,
}: MoneyOverviewCardProps) {
  const tiles = [
    { label: 'Assets', value: assets, show: true },
    { label: 'Owed on cards', value: owed, show: hasCards },
    { label: 'Interest earned', value: interest, show: hasSavings },
  ].filter((tile) => tile.show)

  return (
    <section>
      <div className="relative z-10 mb-3 flex items-end">
        <div className="relative min-w-0 max-w-2xl flex-1 rounded-[1.75rem] border border-border bg-card px-4 py-3.5 shadow-ios">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Fico noticed
          </p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-foreground">{note}</p>
          <span aria-hidden="true" className="absolute -right-3.5 bottom-6 h-3.5 w-3.5 rounded-full border border-border bg-card shadow-sm sm:bottom-8" />
          <span aria-hidden="true" className="absolute -right-[1.65rem] bottom-4 h-2 w-2 rounded-full border border-border bg-card shadow-sm sm:bottom-6" />
        </div>
        <PeacockMascot pose="advisor" className="-mb-10 ml-7 h-24 w-24 shrink-0 sm:h-28 sm:w-28" label="Fico, your financial advisor" />
      </div>

      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-[#004C99] px-5 pb-5 pt-9 text-white shadow-ios-lg">
        <EyeSpots />
        <div className="relative">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-white/75">Net worth</p>
              <button
                type="button"
                onClick={onToggleAmounts}
                aria-label={showAmounts ? 'Hide amounts' : 'Show amounts'}
                className="rounded-full p-1 text-white/75 hover:bg-white/15 hover:text-white"
              >
                {showAmounts ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <button
              type="button"
              onClick={onAdd}
              className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-primary shadow-sm transition-opacity hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              New wallet
            </button>
          </div>
          <p className="mt-1 font-heading text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">{netWorth}</p>

          <div className={`mt-4 grid gap-3 ${tiles.length === 3 ? 'grid-cols-3' : tiles.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {tiles.map((tile) => (
              <div key={tile.label} className="rounded-2xl bg-white/12 p-3">
                <p className="text-xs font-medium text-white/75">{tile.label}</p>
                <p className="mt-1 truncate text-base font-semibold tabular-nums sm:text-lg">{tile.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
