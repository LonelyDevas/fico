'use client'

import { useState, useMemo } from 'react'

import { CalendarRange, Download, SlidersHorizontal, Upload } from 'lucide-react'
import { IonContent, IonPage } from '@ionic/react'
import { TransactionStats } from '@/components/page/transaction/transaction-stats'
import { DEFAULT_FILTERS, FilterState, TransactionFilters } from '@/components/page/transaction/transaction-filter'
import { TransactionItem, TransactionList } from '@/components/page/transaction/transaction-list'
import { useInfiniteTransactions, useQuickStats, useUpdateTransaction } from '@/queries/user/transaction/transaction'
import { useListWallets } from '@/queries/user/wallet/wallets'
import { ListTransactionsParams } from '@/types/transaction'
import { CreateTransactionModal } from '@/components/page/transaction/create-transaction-modal'
import { TransactionImportModal } from '@/components/page/transaction/transaction-import-modal'
import { DeleteTransactionDialog } from '@/components/page/transaction/delete-transaction-dialog'
import { BulkBalanceSheet } from '@/components/page/transaction/bulk-balance-sheet'
import toast from 'react-hot-toast'
import { exportTransactionsCsv } from '@/utils/export-data'
import { usePendingDeletes, useTransactionUndo } from '@/queries/user/transaction/undo'
import { UndoHistoryButton } from '@/components/page/transaction/undo-history-button'

// Helper function to convert filter state to API params
/** Where the selected calendar period begins, or null for "all". */
const periodStart = (dateRange: FilterState['dateRange']): Date | null => {
  if (!dateRange || dateRange === 'all') return null
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (dateRange === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7)) // Monday
  if (dateRange === 'month') return new Date(now.getFullYear(), now.getMonth(), 1)
  if (dateRange === 'year') return new Date(now.getFullYear(), 0, 1)
  return start
}

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
  const start = periodStart(filters.dateRange)
  if (start) {
    const now = new Date()
    params.startDate = start.toISOString()
    params.endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString()
  }

  if (filters.walletId && filters.walletId !== '') {
    params.walletId = filters.walletId
  }

  if (filters.tags && filters.tags.length > 0) {
    params.tags = filters.tags
  }

  if (filters.categoryId) {
    params.categoryId = filters.categoryId
  }

  return params
}
/**
 * All loaded pages in order, shaped for the list. A row can sit on two pages when a change shifts
 * them, so keep its first copy. Rows from Supabase have no `title`: use the category as the headline
 * and the note as the detail.
 */
const toTransactionItems = (pages: any[] | undefined): TransactionItem[] => {
  const seen = new Set<string>()
  return (pages ?? [])
    .flatMap((pageResponse: any) => (Array.isArray(pageResponse?.data) ? pageResponse.data : pageResponse?.data?.items || []))
    .filter((t: any) => {
      const id = String(t._id ?? t.id)
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })
    .map((t: any) => ({
      ...t,
      id: String(t._id ?? t.id),
      title: t.title || t.category?.name || (t.type === 'transfer' ? 'Transfer' : t.description) || 'Transaction',
      description: t.description ?? '',
      category: t.category?.name,
      walletId: t.walletId ? String(t.walletId) : t.wallet?._id ? String(t.wallet._id) : undefined,
    }))
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
  const [exporting, setExporting] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<TransactionItem | null>(null)
  const [sheetEditingTransaction, setSheetEditingTransaction] = useState<TransactionItem | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showBulkBalance, setShowBulkBalance] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState<TransactionItem | null>(null)

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
  const apiParams = { ...convertFilterToParams(filters), limit: '10' }

  // Every loaded page is one query, so adding, editing or deleting a transaction refreshes them all.
  const { data: pagesData, isLoading, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteTransactions(apiParams)
  // Fetch summary stats
  // Totals for the selected period (and wallet), the same range the list above is showing.
  const { data: summaryData, isLoading: summaryLoading } = useQuickStats({ period: filters.dateRange ?? 'month', walletId: filters.walletId || undefined });
  const { deleteWithUndo, updateWithUndo } = useTransactionUndo()
  const pendingDeletes = usePendingDeletes()
  const { mutate: updateTransaction, isPending: isUpdatingTransaction } = useUpdateTransaction()
  
  const items = useMemo(() => toTransactionItems(pagesData?.pages).filter((t) => !pendingDeletes.includes(t.id)), [pagesData, pendingDeletes])

  // An empty period (say, the 1st of the month) shows what came before it instead of a blank page.
  // The totals above stay on the selected period.
  const start = periodStart(filters.dateRange)
  const showEarlier = !!start && !isLoading && items.length === 0
  const earlierParams = { ...apiParams, startDate: undefined, endDate: start ? new Date(start.getTime() - 1).toISOString() : undefined }
  const earlier = useInfiniteTransactions(earlierParams, showEarlier)
  const earlierItems = useMemo(() => toTransactionItems(earlier.data?.pages).filter((t) => !pendingDeletes.includes(t.id)), [earlier.data, pendingDeletes])
  const listingEarlier = showEarlier && earlierItems.length > 0

  const handleLoadMore = () => {
    const source = listingEarlier ? earlier : { hasNextPage, isFetchingNextPage, fetchNextPage }
    if (source.hasNextPage && !source.isFetchingNextPage) void source.fetchNextPage()
  }

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
    const before = [...items, ...earlierItems].find((t) => t.id === data.id)
    const save = before ? updateWithUndo(before, data, 'Transaction updated') : new Promise<void>((resolve, reject) => updateTransaction(data, { onSuccess: () => resolve(), onError: reject }))
    Promise.resolve(save)
      .then(() => {
        if (!before) toast.success('Transaction updated')
        setEditingTransaction(null)
        refetch()
      })
      .catch(() => {
        // keep editor open so the user can correct and retry
      })
  }

  const handleDeleteTransaction = (transaction: TransactionItem) => {
    setTransactionToDelete(transaction)
  }

  const handleConfirmDeleteTransaction = () => {
    if (!transactionToDelete) return
    // Runs after a few seconds unless undone; the row is hidden meanwhile.
    deleteWithUndo(transactionToDelete)
    if (editingTransaction?.id === transactionToDelete.id) setEditingTransaction(null)
    setTransactionToDelete(null)
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
              <UndoHistoryButton />
              <button
                type="button"
                disabled={exporting}
                onClick={async () => {
                  setExporting(true)
                  try {
                    const count = await exportTransactionsCsv()
                    toast.success(count ? `Exported ${count} transactions` : 'Nothing to export yet')
                  } catch {
                    toast.error('Could not export. Please try again.')
                  } finally {
                    setExporting(false)
                  }
                }}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-semibold text-foreground shadow-ios hover:border-primary/50"
              >
                <Download className="h-4 w-4 text-primary" />
                <span className="hidden sm:inline">{exporting ? 'Exporting...' : 'Export'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowBulkBalance(true)}
                aria-label="Change many at once"
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-semibold text-foreground shadow-ios hover:border-primary/50"
              >
                <CalendarRange className="h-4 w-4 text-primary" />
                <span className="hidden sm:inline">Bulk edit</span>
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

          <div className="mt-2">
            <TransactionStats stats={stats} isLoading={summaryLoading} periodPhrase={PERIOD_PHRASE[filters.dateRange ?? 'month']} />
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
              {listingEarlier && (
                <p className="mb-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-ios">
                  Nothing yet {PERIOD_PHRASE[filters.dateRange ?? 'month']}. Here is what came before.
                </p>
              )}
              <TransactionList
                transactions={listingEarlier ? earlierItems : items}
                isLoading={isLoading || (showEarlier && earlier.isLoading)}
                hasMore={listingEarlier ? !!earlier.hasNextPage : !!hasNextPage}
                isLoadingMore={listingEarlier ? earlier.isFetchingNextPage : isFetchingNextPage}
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

      <BulkBalanceSheet open={showBulkBalance} onClose={() => setShowBulkBalance(false)} wallets={wallets as any[]} />

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
        isDeleting={false}
      />
    </IonPage>
  )
}
