'use client'

import { EmptyState } from '@/components/peacock-mascot'
import { useEffect, useMemo, useRef } from 'react'
import { ArrowDownLeft, ArrowUpRight, Clock, CreditCard, MoreVertical, RotateCcw, Shuffle, X } from 'lucide-react'
import { format, isToday, isYesterday } from 'date-fns'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TransactionInlineEditor } from './transaction-inline-editor'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { UpdateTransactionData } from '@/types/transaction'

export interface TransactionItem {
  id: string
  title: string
  description: string
  date: string
  amount: number
  type: 'income' | 'expense' | 'transfer'
  status: 'completed' | 'pending' | 'cancelled'
  category?: string
  walletId?: string
  categoryId?: string
  toWalletId?: string
  serviceFee?: number
  tags?: string[]
  attachments?: string[]
  billId?: string
}

interface TransactionListProps {
  transactions: TransactionItem[]
  isLoading?: boolean
  hasMore?: boolean
  isLoadingMore?: boolean
  /** Wallet id to name, shown as a small chip on each row. */
  walletNames?: Record<string, string>
  /** Wallet id to type, so credit card activity can be labelled as such. */
  walletTypes?: Record<string, string>
  onTransactionClick?: (transaction: TransactionItem) => void
  onTransactionEdit?: (transaction: TransactionItem) => void
  onTransactionDelete?: (transaction: TransactionItem) => void
  onTransactionSave?: (data: UpdateTransactionData) => void
  onTransactionCancelEdit?: () => void
  editingTransactionId?: string | null
  isSavingInlineEdit?: boolean
  onLoadMore?: () => void
}

const TYPE_STYLE = {
  income: { tile: 'bg-success/15 text-success', amount: 'text-success', sign: '+', Icon: ArrowDownLeft },
  expense: { tile: 'bg-warning/15 text-warning', amount: 'text-foreground', sign: '-', Icon: ArrowUpRight },
  transfer: { tile: 'bg-primary/10 text-primary', amount: 'text-foreground', sign: '', Icon: Shuffle },
} as const

const dayLabel = (date: Date) => (isToday(date) ? 'Today' : isYesterday(date) ? 'Yesterday' : format(date, 'EEEE'))

export function TransactionList({
  transactions,
  isLoading,
  hasMore = false,
  isLoadingMore = false,
  walletNames,
  walletTypes,
  onTransactionClick,
  onTransactionEdit,
  onTransactionDelete,
  onTransactionSave,
  onTransactionCancelEdit,
  editingTransactionId,
  isSavingInlineEdit,
  onLoadMore,
}: TransactionListProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const { currency } = useSettingsStore()

  // Infinite scroll: load the next page when the sentinel scrolls into view.
  useEffect(() => {
    if (!onLoadMore || isLoadingMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) onLoadMore()
      },
      { threshold: 0.1 }
    )

    const sentinel = sentinelRef.current
    if (sentinel) observer.observe(sentinel)
    return () => {
      if (sentinel) observer.unobserve(sentinel)
    }
  }, [hasMore, isLoadingMore, onLoadMore])

  const days = useMemo(() => {
    const byDay = new Map<string, { date: Date; items: TransactionItem[] }>()
    for (const transaction of transactions) {
      const date = new Date(transaction.date)
      const key = format(date, 'yyyy-MM-dd')
      const day = byDay.get(key) ?? { date, items: [] }
      day.items.push(transaction)
      byDay.set(key, day)
    }
    return [...byDay.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, day]) => ({
        key,
        date: day.date,
        items: [...day.items].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        income: day.items.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
        expense: day.items.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0),
      }))
  }, [transactions])

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-secondary" />
        ))}
      </div>
    )
  }

  if (!transactions.length) {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 shadow-ios">
        <EmptyState
          pose="advisor"
          title="Nothing here"
          description="No transactions match these filters. Try a wider date range, or tap + to add one."
        />
      </div>
    )
  }

  return (
    <>
      <div className="space-y-5">
        {days.map((day) => (
          <section key={day.key} aria-label={format(day.date, 'MMMM d, yyyy')}>
            <header className="mb-2 flex items-end justify-between gap-3 px-1">
              <div>
                <h3 className="font-heading text-base font-semibold text-foreground">{dayLabel(day.date)}</h3>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{format(day.date, 'MMMM d, yyyy')}</p>
              </div>
              <div className="flex shrink-0 gap-1.5 text-xs font-semibold tabular-nums">
                {day.expense > 0 && (
                  <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-destructive">-{formatMoney(day.expense, currency, false)}</span>
                )}
                {day.income > 0 && (
                  <span className="rounded-full bg-success/10 px-2.5 py-1 text-success">+{formatMoney(day.income, currency, false)}</span>
                )}
              </div>
            </header>

            <ul className="space-y-2">
              {day.items.map((transaction) => {
                const fromCard = !!transaction.walletId && walletTypes?.[transaction.walletId] === 'credit_card'
                const toCard = transaction.type === 'transfer' && !!transaction.toWalletId && walletTypes?.[transaction.toWalletId] === 'credit_card'
                // Card activity reads differently from a normal wallet: a charge adds to what you owe,
                // a transfer into the card pays it down, and income on a card is a refund.
                let style: { tile: string; amount: string; sign: string; Icon: typeof ArrowUpRight } = TYPE_STYLE[transaction.type]
                let kind = ''
                if (toCard) {
                  style = { tile: 'bg-success/15 text-success', amount: 'text-success', sign: '', Icon: CreditCard }
                  kind = 'Card payment'
                } else if (fromCard && transaction.type === 'expense') {
                  style = { tile: 'bg-primary/10 text-primary', amount: 'text-foreground', sign: '-', Icon: CreditCard }
                  kind = 'Charged to card'
                } else if (fromCard && transaction.type === 'income') {
                  style = { tile: 'bg-success/15 text-success', amount: 'text-success', sign: '+', Icon: RotateCcw }
                  kind = 'Card refund'
                } else if (fromCard && transaction.type === 'transfer') {
                  kind = 'Cash advance'
                }
                const fromName = transaction.walletId ? walletNames?.[transaction.walletId] : undefined
                const toName = transaction.toWalletId ? walletNames?.[transaction.toWalletId] : undefined
                const walletName = transaction.type === 'transfer' && fromName && toName ? `${fromName} → ${toName}` : fromName
                const note = transaction.description && transaction.description !== transaction.title ? transaction.description : ''
                return (
                  <li
                    key={transaction.id}
                    className="rounded-2xl border border-border bg-card p-3 shadow-ios transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onTransactionClick?.(transaction)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${style.tile}`}>
                          <style.Icon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-foreground">{transaction.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {kind ? `${kind} · ` : ''}
                            {format(new Date(transaction.date), 'h:mm a')}
                            {note ? ` · ${note}` : ''}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <span className={`text-sm font-bold tabular-nums ${style.amount}`}>
                            {style.sign}
                            {formatMoney(Math.abs(transaction.amount), currency, false)}
                          </span>
                          <span className="flex items-center gap-1">
                            {transaction.status === 'pending' && (
                              <span className="flex items-center gap-0.5 rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                                <Clock className="h-3 w-3" />
                                Pending
                              </span>
                            )}
                            {transaction.status === 'cancelled' && (
                              <span className="flex items-center gap-0.5 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                                <X className="h-3 w-3" />
                                Cancelled
                              </span>
                            )}
                            {walletName && (
                              <span className="max-w-[10rem] truncate rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                {walletName}
                              </span>
                            )}
                          </span>
                        </span>
                      </button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Transaction actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => requestAnimationFrame(() => onTransactionEdit?.(transaction))}>
                            Edit transaction
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onSelect={() => requestAnimationFrame(() => onTransactionDelete?.(transaction))}>
                            Delete transaction
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {editingTransactionId === transaction.id && onTransactionSave && onTransactionCancelEdit && (
                      <TransactionInlineEditor
                        transaction={transaction}
                        onSave={onTransactionSave}
                        onCancel={onTransactionCancelEdit}
                        isSaving={isSavingInlineEdit}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-4" />

      {isLoadingMore && (
        <div className="flex items-center justify-center py-8">
          <div className="flex gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            <div className="h-2 w-2 animate-pulse rounded-full bg-primary" style={{ animationDelay: '0.2s' }} />
            <div className="h-2 w-2 animate-pulse rounded-full bg-primary" style={{ animationDelay: '0.4s' }} />
          </div>
        </div>
      )}
    </>
  )
}
