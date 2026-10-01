'use client'

import { useState } from 'react'
import { format, differenceInCalendarDays } from 'date-fns'
import { Archive, ArrowDownLeft, ArrowUpRight, MoreHorizontal, Pencil } from 'lucide-react'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import type { Obligation } from '@/types/obligation'

interface ObligationCardProps {
  obligation: Obligation
  hideAmounts: boolean
  onPay: (obligation: Obligation) => void
  onEdit: (obligation: Obligation) => void
  onArchive: (obligation: Obligation) => void
}

export function ObligationCard({ obligation, hideAmounts, onPay, onEdit, onArchive }: ObligationCardProps) {
  const { currency } = useSettingsStore()
  const [menu, setMenu] = useState(false)
  const isDebt = obligation.direction === 'debt'
  const money = (value: number) => formatMoney(value, obligation.currency || currency, hideAmounts)

  const total = Number(obligation.totalWithInterest ?? obligation.principalAmount) || 0
  const remaining = Number(obligation.remainingBalance) || 0
  const paid = Math.max(0, total - remaining)
  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0
  const settled = obligation.status === 'settled'

  const due = obligation.dueDate ? new Date(obligation.dueDate) : null
  const days = due ? differenceInCalendarDays(due, new Date()) : null
  const overdue = !settled && days !== null && days < 0
  const dueText =
    due === null
      ? null
      : settled
        ? null
        : overdue
          ? `${Math.abs(days as number)} day${Math.abs(days as number) === 1 ? '' : 's'} overdue`
          : days === 0
            ? 'Due today'
            : `Due ${format(due, 'MMM d, yyyy')}`

  const accent = isDebt ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success'

  return (
    <article className={`rounded-3xl border border-border bg-card p-4 shadow-ios ${settled ? 'opacity-70' : ''}`}>
      <div className="flex items-start gap-3">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${accent}`}>
          {isDebt ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-foreground">{obligation.name}</h3>
          <p className="truncate text-xs text-muted-foreground">
            {isDebt ? 'Owed to' : 'Owed by'} {obligation.counterparty}
            {obligation.interestRate ? ` · ${obligation.interestRate}% ${obligation.interestType ?? ''}`.trimEnd() : ''}
          </p>
        </div>
        {settled && <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">Settled</span>}
        <div className="relative -mr-1">
          <button type="button" onClick={() => setMenu((v) => !v)} aria-label={`${obligation.name} actions`} className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary">
            <MoreHorizontal className="h-5 w-5" />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
              <div className="absolute right-0 z-50 mt-1 w-40 overflow-hidden rounded-2xl border border-border bg-card py-1 shadow-ios-lg">
                <button type="button" onClick={() => { setMenu(false); onEdit(obligation) }} className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm hover:bg-secondary">
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
                <button type="button" onClick={() => { setMenu(false); onArchive(obligation) }} className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-destructive hover:bg-secondary">
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
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{isDebt ? 'Left to pay' : 'Left to collect'}</p>
          <p className="font-heading text-2xl font-bold tabular-nums text-foreground">{money(remaining)}</p>
        </div>
        <p className="pb-1 text-xs tabular-nums text-muted-foreground">of {money(total)}</p>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Paid so far">
        <div className={`h-full rounded-full transition-all ${settled ? 'bg-success' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {pct.toFixed(0)}% {isDebt ? 'paid' : 'collected'}
          {obligation.isInstallment && obligation.totalInstallments ? ` · ${obligation.paidInstallments} of ${obligation.totalInstallments} payments` : ''}
        </span>
        {dueText && <span className={overdue ? 'font-semibold text-destructive' : ''}>{dueText}</span>}
      </div>

      {!settled && (
        <button
          type="button"
          onClick={() => onPay(obligation)}
          className="mt-4 w-full rounded-full bg-primary/10 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
        >
          {isDebt ? 'Record payment' : 'Record repayment'}
        </button>
      )}
    </article>
  )
}
