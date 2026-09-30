'use client'

import { EmptyState } from '@/components/peacock-mascot'
import { useMemo } from 'react'
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useListTransactions } from '@/queries/user/transaction/transaction'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'

interface TransactionViewModel {
  id: string
  title: string
  description: string
  date: string
  amount: number
  type: 'income' | 'expense'
  status: 'completed' | 'pending'
}

interface TransactionApiItem {
  _id?: string
  id?: string
  title?: string
  description?: string
  date?: string
  createdAt?: string
  amount?: number
  type?: 'income' | 'expense'
  status?: 'completed' | 'pending'
}

const normalizeTransaction = (transaction: TransactionApiItem, index: number): TransactionViewModel => {
  const resolvedId = transaction._id ?? transaction.id ?? `transaction-${index}`
  const transactionDate = transaction.date || transaction.createdAt || new Date().toISOString()
  const dateObj = new Date(transactionDate)
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return {
    id: resolvedId,
    title: transaction.title || 'Transaction',
    description: transaction.description || '',
    date: formattedDate,
    amount: Number(transaction.amount) || 0,
    type: transaction.type || 'expense',
    status: transaction.status || 'completed',
  }
}

export function RecentTransactions() {
  const { data: transactionResponse, isLoading } = useListTransactions({ limit: '5' })
  const { currency } = useSettingsStore()

  const transactions = useMemo(() => {
    const responseData = transactionResponse?.data as
      | TransactionApiItem[]
      | { items?: TransactionApiItem[]; transactions?: TransactionApiItem[] }
      | undefined

    if (Array.isArray(responseData)) {
      return responseData.map((t, idx) => normalizeTransaction(t, idx))
    }

    if (responseData && Array.isArray(responseData.items)) {
      return responseData.items.map((t, idx) => normalizeTransaction(t, idx))
    }

    if (responseData && Array.isArray(responseData.transactions)) {
      return responseData.transactions.map((t, idx) => normalizeTransaction(t, idx))
    }

    return []
  }, [transactionResponse])

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-ios">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-border">
        <h2 className="text-lg font-bold text-foreground">Recent Transactions</h2>
        <Link to="/transactions" className="text-sm font-semibold text-primary hover:underline">
          View all
        </Link>
      </div>

      {/* Transactions List */}
      <div className="divide-y divide-border overflow-y-auto max-h-96">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[...Array(5)].map((_, index) => (
              <div key={index} className="h-16 bg-secondary rounded-xl animate-pulse" />
            ))}
          </div>
        ) : transactions.length > 0 ? (
          transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-center justify-between p-4 hover:bg-secondary/60 transition-colors group"
            >
              {/* Left: Icon & Details */}
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div
                  className={`p-2.5 rounded-full transition-colors shrink-0 ${
                    transaction.type === 'income'
                      ? 'bg-success/15 text-success'
                      : 'bg-warning/15 text-warning'
                  }`}
                >
                  {transaction.type === 'income' ? (
                    <ArrowUpRight className="w-5 h-5" />
                  ) : (
                    <ArrowDownLeft className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{transaction.title}</p>
                  <p className="text-xs text-muted-foreground">{transaction.description}</p>
                </div>
              </div>

              {/* Right: Amount & Status */}
              <div className="flex items-center gap-4 text-right">
                <div className="hidden sm:block">
                  <p className="text-xs text-muted-foreground">{transaction.date}</p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-bold ${
                      transaction.type === 'income' ? 'text-success' : 'text-foreground'
                    }`}
                  >
                    {transaction.type === 'income' ? '+' : '-'}{formatMoney(transaction.amount, currency, false)}
                  </p>
                  <p
                    className={`text-xs px-2 py-0.5 rounded-full inline-block mt-1 ${
                      transaction.status === 'completed'
                        ? 'bg-success/15 text-success'
                        : 'bg-warning/15 text-warning'
                    }`}
                  >
                    {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                  </p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-6">
            <EmptyState compact title="No transactions found" />
          </div>
        )}
      </div>
    </div>
  )
}
