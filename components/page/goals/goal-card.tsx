'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Archive, MoreHorizontal, Pencil, PiggyBank } from 'lucide-react'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import type { Goal } from '@/types/goal'
import type { GoalProgress } from './goal-progress'

interface GoalCardProps {
  goal: Goal
  progress: GoalProgress
  hideAmounts: boolean
  onEdit: (goal: Goal) => void
  onArchive: (goal: Goal) => void
}

export function GoalCard({ goal, progress, hideAmounts, onEdit, onArchive }: GoalCardProps) {
  const { currency } = useSettingsStore()
  const [menu, setMenu] = useState(false)
  const money = (value: number) => formatMoney(value, currency, hideAmounts)
  const { saved, remaining, pct, reached, daysLeft, monthlyNeeded } = progress
  const late = !reached && daysLeft !== null && daysLeft < 0

  const fundedBy = progress.usesAllSavings
    ? 'All savings wallets'
    : progress.wallets.length
      ? progress.wallets.map((w) => w.name).join(', ')
      : 'Linked wallets were archived'

  const dueText =
    goal.deadline === null
      ? 'No deadline'
      : late
        ? `Deadline passed ${format(parseISO(goal.deadline), 'MMM d, yyyy')}`
        : `By ${format(parseISO(goal.deadline), 'MMM d, yyyy')}`

  return (
    <article className={`rounded-3xl border border-border bg-card p-4 shadow-ios ${reached ? 'opacity-90' : ''}`}>
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-success/15 text-success">
          <PiggyBank className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-foreground">{goal.name}</h3>
          <p className="truncate text-xs text-muted-foreground">{fundedBy}</p>
        </div>
        {reached && <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">Reached</span>}
        <div className="relative -mr-1">
          <button type="button" onClick={() => setMenu((v) => !v)} aria-label={`${goal.name} actions`} className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary">
            <MoreHorizontal className="h-5 w-5" />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
              <div className="absolute right-0 z-50 mt-1 w-40 overflow-hidden rounded-2xl border border-border bg-card py-1 shadow-ios-lg">
                <button type="button" onClick={() => { setMenu(false); onEdit(goal) }} className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm hover:bg-secondary">
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
                <button type="button" onClick={() => { setMenu(false); onArchive(goal) }} className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-destructive hover:bg-secondary">
                  <Archive className="h-4 w-4" />
                  Archive
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Saved so far</p>
          <p className="font-heading text-2xl font-bold tabular-nums text-foreground">{money(saved)}</p>
        </div>
        <p className="pb-1 text-xs tabular-nums text-muted-foreground">of {money(Number(goal.targetAmount) || 0)}</p>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Saved so far">
        <div className={`h-full rounded-full transition-all ${reached ? 'bg-success' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{pct.toFixed(0)}% saved</span>
        <span className={late ? 'font-semibold text-destructive' : ''}>{dueText}</span>
      </div>

      {!reached && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-secondary/60 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Left to save</p>
            <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-foreground">{money(remaining)}</p>
          </div>
          <div className="rounded-2xl bg-secondary/60 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Per month</p>
            <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-foreground">{monthlyNeeded === null ? '—' : money(monthlyNeeded)}</p>
          </div>
        </div>
      )}
    </article>
  )
}
