'use client'

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Eye, EyeOff } from 'lucide-react'
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

/**
 * One line of totals for the range the list is showing, so the list comes first. The charts and
 * breakdowns are on Insights.
 */
export function TransactionStats({ stats, isLoading, periodPhrase }: TransactionStatsProps) {
  const { currency, hideAmountsOnOpen } = useSettingsStore()
  const [showAmounts, setShowAmounts] = useState(!hideAmountsOnOpen)
  const money = (value: number) => formatMoney(value, currency, !showAmounts)
  const net = stats.totalIncome - stats.totalExpense

  return (
    <div className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
      {isLoading ? (
        <Skeleton className="h-4 w-56" />
      ) : (
        <p className="min-w-0 truncate tabular-nums">
          <span className="capitalize">{periodPhrase}</span>: <span className="font-semibold text-foreground">{money(stats.totalExpense)}</span> out ·{' '}
          <span className="font-semibold text-success">{money(stats.totalIncome)}</span> in · net{' '}
          <span className={net < 0 ? 'font-semibold text-destructive' : 'font-semibold text-foreground'}>{`${net > 0 ? '+' : ''}${money(net)}`}</span>
          <span className="hidden sm:inline">
            {' '}· {stats.transactionCount} transaction{stats.transactionCount === 1 ? '' : 's'}
          </span>
        </p>
      )}
      <button
        type="button"
        onClick={() => setShowAmounts((v) => !v)}
        aria-label={showAmounts ? 'Hide amounts' : 'Show amounts'}
        className="shrink-0 rounded-full p-1 hover:bg-secondary hover:text-foreground"
      >
        {showAmounts ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
      <Link to="/statistics#spending" className="ml-auto flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10">
        <BarChart3 className="h-3.5 w-3.5" />
        See insights
      </Link>
    </div>
  )
}
