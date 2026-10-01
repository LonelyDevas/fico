'use client'

import { useState, useMemo, useEffect } from 'react'

import { Download, SlidersHorizontal, Upload } from 'lucide-react'
import { IonContent, IonPage } from '@ionic/react'
import { TransactionStats } from '@/components/page/transaction/transaction-stats'
import { DEFAULT_FILTERS, FilterState, TransactionFilters } from '@/components/page/transaction/transaction-filter'
import { TransactionItem, TransactionList } from '@/components/page/transaction/transaction-list'
import { useDeleteTransaction, useListTransactions, useQuickStats, useUpdateTransaction } from '@/queries/user/transaction/transaction'
import { useListWallets } from '@/queries/user/wallet/wallets'
import { ListTransactionsParams } from '@/types/transaction'
import { CreateTransactionModal } from '@/components/page/transaction/create-transaction-modal'
import { TransactionImportModal } from '@/components/page/transaction/transaction-import-modal'
import { DeleteTransactionDialog } from '@/components/page/transaction/delete-transaction-dialog'
import toast from 'react-hot-toast'

// Helper function to convert filter state to API params
const convertFilterToParams = (filters: FilterState): ListTransactionsParams => {
  const params: ListTransactionsParams = {}

  if (filters.type && filters.type !== 'all') {
    params.type = filters.type
  }

  if (filters.status && filters.status !== 'all') {
    params.status = filters.status
  }

  if (filters.search) {
    params.search = filters.search
  }

  // Calendar periods (this month = from the 1st), matching the summary card. Full timestamps
  // so "today" and the last day of the range are not cut off at midnight.
  if (filters.dateRange && filters.dateRange !== 'all') {
    const now = new Date()
    let start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    if (filters.dateRange === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7)) // Monday
    if (filters.dateRange === 'month') start = new Date(now.getFullYear(), now.getMonth(), 1)
    if (filters.dateRange === 'year') start = new Date(now.getFullYear(), 0, 1)

    params.startDate = start.toISOString()
    params.endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString()
  }

  if (filters.walletId && filters.walletId !== '') {
    params.walletId = filters.walletId
  }

  if (filters.tags && filters.tags.length > 0) {
    params.tags = filters.tags
  }

  return params
}
const PERIOD_PHRASE: Record<NonNullable<FilterState['dateRange']>, string> = {
  today: 'today',
  week: 'this week',
  month: 'this month',
  year: 'this year',
  all: 'overall',
}

export function TransactionsPage() {

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [showFilters, setShowFilters] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<TransactionItem | null>(null)
  const [sheetEditingTransaction, setSheetEditingTransaction] = useState<TransactionItem | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState<TransactionItem | null>(null)
  const [page, setPage] = useState(0)
  const [limit, setLimit] = useState(10)
  const [allTransactions, setAllTransactions] = useState<any[]>([])
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [totalPages, setTotalPages] = useState(1)

  const { data: walletsData, isLoading: walletsLoading } = useListWallets();
  const wallets = walletsData?.data
    ? Array.isArray(walletsData.data)
      ? walletsData.data
      : walletsData.data.items || []
    : []

  const walletNames = useMemo(() => {
    const names: Record<string, string> = {}
    for (const wallet of wallets as any[]) names[String(wallet._id ?? wallet.id)] = wallet.name
    return names
  }, [wallets])

  const walletTypes = useMemo(() => {
    const types: Record<string, string> = {}
    for (const wallet of wallets as any[]) types[String(wallet._id ?? wallet.id)] = wallet.type
    return types
  }, [wallets])

  // Convert filters to API params
  const apiParams = {
    ...convertFilterToParams(filters),
    page: String(page), 
    limit: String(limit),
  };

  // Fetch transactions from API
  const { data: apiResponse, isLoading, error, refetch } = useListTransactions(apiParams);
  // Fetch summary stats
  // Totals for the selected period (and wallet), the same range the list above is showing.
  const { data: summaryData } = useQuickStats({ period: filters.dateRange ?? 'month', walletId: filters.walletId || undefined });
  const { mutate: deleteTransaction, isPending: isDeleting } = useDeleteTransaction()
  const { mutate: updateTransaction, isPending: isUpdatingTransaction } = useUpdateTransaction()
  
  // Extract transactions and pagination info from API response
  const currentPageTransactions = useMemo(() => {
    if (!apiResponse?.data) return [];
    // Handle both array and paginated response formats
    return Array.isArray(apiResponse.data)
      ? apiResponse.data
      : apiResponse.data.items || [];
  }, [apiResponse]);

  // Rows from Supabase have no `title`: use the category as the headline and the note as the detail.
  const items: TransactionItem[] = useMemo(
    () =>
      allTransactions.map((t: any) => ({
        ...t,
        id: String(t._id ?? t.id),
        title: t.title || t.category?.name || (t.type === 'transfer' ? 'Transfer' : t.description) || 'Transaction',
        description: t.description ?? '',
        category: t.category?.name,
        walletId: t.walletId ? String(t.walletId) : t.wallet?._id ? String(t.wallet._id) : undefined,
      })),
    [allTransactions]
  )

  const totalItems = apiResponse?.data?.totalItems || currentPageTransactions.length;
  const totalPagesCount = apiResponse?.data?.totalPages || 1;

  // Handle accumulating transactions for infinite scroll
  useEffect(() => {
    if (page === 0) {
      // Reset when filters change
      setAllTransactions(currentPageTransactions);
    } else {
      // Append new transactions
      setAllTransactions(prev => [...prev, ...currentPageTransactions]);
      setIsLoadingMore(false);
    }
  }, [currentPageTransactions, page]);

  // Reset to first page when filters change
  useEffect(() => {
    setPage(0);
    setAllTransactions([]);
    setIsLoadingMore(false);
  }, [filters]);

  const handleLoadMore = () => {
    if (!isLoadingMore && page + 1 < totalPagesCount) {
      setIsLoadingMore(true);
      setPage(prev => prev + 1);
    }
  };

  const handleStartInlineEdit = (transaction: TransactionItem) => {
    setEditingTransaction(transaction)
  }

  const handleOpenSheetEdit = (transaction: TransactionItem) => {
    setSheetEditingTransaction(transaction)
  }

  const handleCancelInlineEdit = () => {
    setEditingTransaction(null)
  }

  const handleSaveInlineEdit = (data: { id: string; walletId?: string; categoryId?: string; amount?: number; type?: 'income' | 'expense' | 'transfer'; description?: string; date?: string; status?: 'completed' | 'pending' | 'cancelled' }) => {
    updateTransaction(data, {
      onSuccess: () => {
        toast.success('Transaction updated successfully')
        setEditingTransaction(null)
        refetch()
      },
      onError: () => {
        // keep editor open so the user can correct and retry
      },
    })
  }

  const handleDeleteTransaction = (transaction: TransactionItem) => {
    setTransactionToDelete(transaction)
  }

  const handleConfirmDeleteTransaction = () => {
    if (!transactionToDelete) return

    deleteTransaction(
      { id: transactionToDelete.id },
      {
        onSuccess: () => {
          toast.success('Transaction deleted successfully')
          setTransactionToDelete(null)
          if (editingTransaction?.id === transactionToDelete.id) {
            setEditingTransaction(null)
          }
        },
        onError: () => {
          setTransactionToDelete(null)
        },
      }
    )
  }

  // Use summary stats from API
  const stats = {
    totalIncome: Number(summaryData?.data?.income ?? 0),
    totalExpense: Number(summaryData?.data?.expenses ?? 0),
    totalTransfers: Number(summaryData?.data?.transfers ?? 0),
    transactionCount: Number(summaryData?.data?.transactions ?? 0),
  };

  return (
    <IonPage>
      <IonContent className="bg-background text-foreground">

        <main className="mx-auto max-w-7xl px-4 pb-10 pt-5 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Every peso, in order</p>
              <h1 className="mt-1 font-heading text-2xl font-semibold leading-tight text-foreground sm:text-3xl">Activity</h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => console.warn('Export not implemented')}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-semibold text-foreground shadow-ios hover:border-primary/50"
              >
                <Download className="h-4 w-4 text-primary" />
                <span className="hidden sm:inline">Export</span>
              </button>
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-semibold text-foreground shadow-ios hover:border-primary/50"
              >
                <Upload className="h-4 w-4 text-primary" />
                <span className="hidden sm:inline">Import</span>
              </button>
            </div>
          </div>

          <div className="mt-5">
            <TransactionStats stats={stats} isLoading={isLoading && page === 0} periodPhrase={PERIOD_PHRASE[filters.dateRange ?? 'month']} />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
            <div className="lg:order-2 lg:sticky lg:top-4">
              <button
                type="button"
                aria-expanded={showFilters}
                onClick={() => setShowFilters((open) => !open)}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card py-2.5 text-sm font-semibold text-foreground shadow-ios lg:hidden"
              >
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                {showFilters ? 'Hide filters' : 'Filters'}
              </button>
              <div className={`mt-3 lg:mt-0 ${showFilters ? 'block' : 'hidden'} lg:block`}>
                <TransactionFilters value={filters} onChange={setFilters} wallets={wallets} />
              </div>
            </div>

            <div className="min-w-0 lg:order-1">
              <TransactionList
                transactions={items}
                isLoading={isLoading && page === 0}
                hasMore={page + 1 < totalPagesCount}
                isLoadingMore={isLoadingMore}
                walletNames={walletNames}
                walletTypes={walletTypes}
                onTransactionClick={handleStartInlineEdit}
                onTransactionEdit={handleOpenSheetEdit}
                onTransactionDelete={handleDeleteTransaction}
                onTransactionSave={handleSaveInlineEdit}
                onTransactionCancelEdit={handleCancelInlineEdit}
                editingTransactionId={editingTransaction?.id ?? null}
                isSavingInlineEdit={isUpdatingTransaction}
                onLoadMore={handleLoadMore}
              />
            </div>
          </div>
        </main>
      </IonContent>

      {/* Import Transactions Modal */}
      <TransactionImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => refetch()}
      />

      <CreateTransactionModal
        open={!!sheetEditingTransaction}
        onClose={() => setSheetEditingTransaction(null)}
        onSuccess={() => refetch()}
        title="Edit Transaction"
        transaction={sheetEditingTransaction}
      />

      <DeleteTransactionDialog
        open={!!transactionToDelete}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setTransactionToDelete(null)
        }}
        onConfirm={handleConfirmDeleteTransaction}
        transaction={transactionToDelete}
        isDeleting={isDeleting}
      />
    </IonPage>
  )
}
