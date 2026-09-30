'use client'

import { EmptyState } from '@/components/peacock-mascot'
import { useEffect, useRef } from 'react'
import { ArrowUpRight, ArrowDownLeft, Shuffle, Clock, Check, X, MoreVertical } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
  onTransactionClick?: (transaction: TransactionItem) => void
  onTransactionEdit?: (transaction: TransactionItem) => void
  onTransactionDelete?: (transaction: TransactionItem) => void
  onTransactionSave?: (data: UpdateTransactionData) => void
  onTransactionCancelEdit?: () => void
  editingTransactionId?: string | null
  isSavingInlineEdit?: boolean
  onLoadMore?: () => void
}

export function TransactionList({
  transactions,
  isLoading,
  hasMore = false,
  isLoadingMore = false,
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

  // Setup IntersectionObserver for infinite scroll
  useEffect(() => {
    if (!onLoadMore || isLoadingMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          onLoadMore()
        }
      },
      { threshold: 0.1 }
    )

    const currentSentinel = sentinelRef.current
    if (currentSentinel) {
      observer.observe(currentSentinel)
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel)
      }
    }
  }, [hasMore, isLoadingMore, onLoadMore])
  
  const getIcon = (type: string) => {
    switch (type) {
      case 'income':
        return <ArrowUpRight className="w-5 h-5 text-success" />
      case 'expense':
        return <ArrowDownLeft className="w-5 h-5 text-destructive" />
      case 'transfer':
        return <Shuffle className="w-5 h-5 text-accent" />
      default:
        return null
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Check className="w-4 h-4 text-success" />
      case 'pending':
        return <Clock className="w-4 h-4 text-warning" />
      case 'cancelled':
        return <X className="w-4 h-4 text-destructive" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: 'bg-success/10 text-success hover:bg-success/20',
      pending: 'bg-warning/10 text-warning hover:bg-warning/20',
      cancelled: 'bg-destructive/10 text-destructive hover:bg-destructive/20',
    }
    return variants[status as keyof typeof variants] || ''
  }

  const formatAmount = (amount: number, type: string) => {
    const prefix = type === 'income' ? '+' : type === 'expense' ? '-' : ''
    return `${prefix}${formatMoney(Math.abs(amount), currency, false)}`
  }

  const calculateDayTotals = (dayTransactions: TransactionItem[]) => {
    let income = 0
    let expense = 0
    
    dayTransactions.forEach((transaction) => {
      if (transaction.type === 'income') {
        income += transaction.amount
      } else if (transaction.type === 'expense') {
        expense += transaction.amount
      }
    })
    
    return { income, expense, net: income - expense }
  }

  const groupTransactionsByDay = (txns: TransactionItem[]) => {
    const grouped: { [key: string]: TransactionItem[] } = {}
    const dateMetadata: { [key: string]: string } = {}
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    txns.forEach((transaction) => {
      const transactionDate = new Date(transaction.date)
      const dateKey = transactionDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      
      const transactionDateNormalized = new Date(transactionDate)
      transactionDateNormalized.setHours(0, 0, 0, 0)
      
      const isToday = transactionDateNormalized.getTime() === today.getTime()
      const displayLabel = isToday ? 'Today' : dateKey
      
      if (!dateMetadata[dateKey]) {
        dateMetadata[dateKey] = displayLabel
      }
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(transaction)
    })

    // Sort by date (newest first)
    const sorted = Object.entries(grouped).sort((a, b) => {
      return new Date(b[0]).getTime() - new Date(a[0]).getTime()
    })
    
    return sorted.map(([dateKey, transactions]) => ({
      dateKey,
      displayLabel: dateMetadata[dateKey],
      transactions
    }))
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-secondary rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (!transactions.length) {
    return (
      <div className="py-8">
        <EmptyState
          title="No transactions found"
          description="Try adjusting your filters or add a new transaction"
        />
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {groupTransactionsByDay(transactions).map(({ dateKey, displayLabel, transactions: dayTransactions }) => (
          <div key={dateKey}>
            {/* Day Header */}
            <h3 className="text-sm font-semibold text-muted-foreground px-2 mb-2">{displayLabel}</h3>
            
            {/* Transactions for this day */}
            <div className="space-y-2">
              {dayTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="w-full bg-card border border-border rounded-2xl p-4 transition-all duration-200 text-left group hover:border-primary/50 hover:shadow-ios"
                >
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onTransactionClick?.(transaction)}
                      className="flex flex-1 items-center gap-4 min-w-0 text-left"
                    >
                      {/* Left - Icon & Details */}
                      <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                        {getIcon(transaction.type)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground truncate">{transaction.title}</p>
                        <p className="text-sm text-muted-foreground truncate">{transaction.description}</p>
                      </div>

                      {/* Right - Amount & Status */}
                      <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                        <div className="text-right">
                          <p className={`font-bold ${
                            transaction.type === 'income' ? 'text-success' : 
                            transaction.type === 'expense' ? 'text-destructive' : 
                            'text-foreground'
                          }`}>
                            {formatAmount(transaction.amount, transaction.type)}
                          </p>
                        </div>

                        <Badge className={`flex items-center gap-1 flex-shrink-0 ${getStatusBadge(transaction.status)}`}>
                          {getStatusIcon(transaction.status)}
                          <span className="hidden sm:inline capitalize text-xs">{transaction.status}</span>
                        </Badge>
                      </div>
                    </button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 opacity-80 hover:opacity-100">
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
                </div>
              ))}
            </div>

            {/* Day Total */}
            {(() => {
              const { income, expense } = calculateDayTotals(dayTransactions)
              return (
                <div className="flex justify-end gap-6 px-2 mt-3 text-sm font-semibold">
                  <div className="text-right">
                    <p className="text-success text-sm">{`+${formatMoney(income, currency, false)}`}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-destructive text-sm">{`-${formatMoney(expense, currency, false)}`}</p>
                  </div>
                </div>
              )
            })()}
          </div>
        ))}
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-4" />

      {/* Loading more indicator */}
      {isLoadingMore && (
        <div className="flex justify-center items-center py-8">
          <div className="flex gap-2">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
        </div>
      )}
    </>
  )
}
