'use client'

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Eye, EyeOff, Plus } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface ManageHeaderProps {
  /** Small line above the title. */
  eyebrow: string
  title: string
  /** One short line under the title, like a total. Charts and breakdowns live on Insights. */
  summary?: ReactNode
  loading?: boolean
  showAmounts?: boolean
  /** Shows the eye button next to the summary. */
  onToggleAmounts?: () => void
  onAdd?: () => void
  addLabel?: string
  /** Extra buttons placed before the add button. */
  actions?: ReactNode
  /** Link to this page's section on Insights, e.g. /statistics#bills. */
  statsHref?: string
}

/**
 * Top of a page where you add, edit or remove things. It keeps to the title, one line of numbers
 * and the add button, so the list itself comes first. The full breakdown is on Insights.
 */
export function ManageHeader({
  eyebrow,
  title,
  summary,
  loading,
  showAmounts,
  onToggleAmounts,
  onAdd,
  addLabel = 'Add',
  actions,
  statsHref = '/statistics',
}: ManageHeaderProps) {
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
          <h1 className="mt-1 font-heading text-2xl font-semibold leading-tight text-foreground sm:text-3xl">{title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          {onAdd && (
            <button
              type="button"
              onClick={onAdd}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-ios hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              {addLabel}
            </button>
          )}
        </div>
      </div>

      {(summary || loading) && (
        <div className="mt-2 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
          {loading ? (
            <Skeleton className="h-4 w-48" />
          ) : (
            <p className="min-w-0 truncate tabular-nums">{summary}</p>
          )}
          {onToggleAmounts && (
            <button
              type="button"
              onClick={onToggleAmounts}
              aria-label={showAmounts ? 'Hide amounts' : 'Show amounts'}
              className="shrink-0 rounded-full p-1 hover:bg-secondary hover:text-foreground"
            >
              {showAmounts ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
          {statsHref && (
            <Link
              to={statsHref}
              className="ml-auto flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              See insights
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
