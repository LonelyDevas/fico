'use client'

import { useCallback, useMemo, useState } from 'react'
import { IonPage, IonContent } from '@ionic/react'
import toast from 'react-hot-toast'
import { ManageHeader } from '@/components/page/manage-header'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { BillsFilters, BillsFilterState } from '@/components/page/bills/bills-filters'
import { BillsList } from '@/components/page/bills/bills-list'
import { BillModal } from '@/components/page/bills/bill-modal'
import { DeleteBillDialog } from '@/components/page/bills/delete-bill-dialog'
import { MarkPaidDialog } from '@/components/page/bills/mark-paid-dialog'
import {
  useBillSummary,
  useInfiniteBills,
  useMarkBillPaid,
  useMarkBillUnpaid,
  useArchiveBill,
  useUnarchiveBill,
  useOverdueBills,
} from '@/queries/user/bill/bills'
import { ListBillsParams, Bill } from '@/types/bill'
import { extractItemsCount, extractPaginationMeta, normalizeBillsResponse, normalizeBillSummary } from '@/components/page/bills/bill-utils'

const initialFilters: BillsFilterState = {
  search: '',
  paymentStatus: 'all',
  status: 'active',
  type: 'all',
  recurrence: 'all',
  dueWindow: 'all',
}

const SETTLED_STATUSES = ['paid', 'received']
const PAGE_SIZE = 10

/** Filters as list params, minus the page (each section pages on its own). */
const convertFilterToParams = (filters: BillsFilterState): Omit<ListBillsParams, 'page'> => {
  const params: Omit<ListBillsParams, 'page'> = { limit: String(PAGE_SIZE), status: filters.status }

  if (filters.paymentStatus !== 'all') {
    params.paymentStatus = filters.paymentStatus
  }

  if (filters.type !== 'all') {
    params.type = filters.type
  }

  if (filters.recurrence === 'recurring') {
    params.isRecurring = 'true'
  }

  if (filters.recurrence === 'one-time') {
    params.isRecurring = 'false'
  }

  if (filters.dueWindow !== 'all') {
    const today = new Date()
    const endDate = new Date(today)
    endDate.setDate(today.getDate() + Number(filters.dueWindow))

    params.startDate = today.toISOString().split('T')[0]
    params.endDate = endDate.toISOString().split('T')[0]
  }

  return params
}

const flattenPages = (pages: unknown[] | undefined) => (pages ?? []).flatMap((page) => normalizeBillsResponse(page))
const totalOf = (pages: unknown[] | undefined) => (pages?.length ? extractPaginationMeta(pages[0]).totalItems : 0)

export default function BillsPage() {
  const { currency, hideAmountsOnOpen } = useSettingsStore()
  const [filters, setFilters] = useState<BillsFilterState>(initialFilters)
  const [processingBillId, setProcessingBillId] = useState<string | null>(null)

  const [billModalOpen, setBillModalOpen] = useState(false)
  const [editingBill, setEditingBill] = useState<Bill | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingBill, setDeletingBill] = useState<Bill | null>(null)
  const [markPaidDialogOpen, setMarkPaidDialogOpen] = useState(false)
  const [markPaidBill, setMarkPaidBill] = useState<Bill | null>(null)

  const baseParams = useMemo(() => convertFilterToParams(filters), [filters])
  // Archiving resets a bill to unpaid, so archived bills get one list. Otherwise bills still due and
  // paid/received ones page separately, so settled entries never push due ones behind "Load more".
  const archivedView = filters.status === 'archived'
  const statusFilter = filters.paymentStatus
  const showDue = archivedView || statusFilter === 'all' || !SETTLED_STATUSES.includes(statusFilter)
  const showSettled = !archivedView && (statusFilter === 'all' || SETTLED_STATUSES.includes(statusFilter))

  const due = useInfiniteBills(archivedView ? baseParams : { ...baseParams, group: 'due' }, showDue)
  const settled = useInfiniteBills({ ...baseParams, group: 'settled' }, showSettled)

  const { data: summaryResponse, isLoading: summaryLoading } = useBillSummary()
  const { data: overdueResponse, isLoading: overdueLoading } = useOverdueBills()

  const { mutate: markPaid } = useMarkBillPaid()
  const { mutate: markUnpaid } = useMarkBillUnpaid()
  const { mutate: archiveBill, isPending: isArchiving } = useArchiveBill()
  const { mutate: unarchiveBill } = useUnarchiveBill()

  const dueBills = useMemo(() => (showDue ? flattenPages(due.data?.pages) : []), [due.data, showDue])
  const settledBills = useMemo(() => (showSettled ? flattenPages(settled.data?.pages) : []), [settled.data, showSettled])
  const dueTotal = showDue ? totalOf(due.data?.pages) : 0
  const settledTotal = showSettled ? totalOf(settled.data?.pages) : 0
  const allBills = useMemo(() => [...dueBills, ...settledBills], [dueBills, settledBills])

  const bySearch = useCallback(
    (bills: Bill[]) => {
      const keyword = filters.search.trim().toLowerCase()
      return keyword ? bills.filter((bill) => bill.name.toLowerCase().includes(keyword)) : bills
    },
    [filters.search]
  )
  const visibleDue = useMemo(() => bySearch(dueBills), [bySearch, dueBills])
  const visibleSettled = useMemo(() => bySearch(settledBills), [bySearch, settledBills])

  const summaryFromApi = useMemo(() => normalizeBillSummary(summaryResponse), [summaryResponse])

  const summary = useMemo(() => {
    if (summaryFromApi.totalBills > 0) {
      return summaryFromApi
    }

    const paidBills = allBills.filter((bill) => bill.paymentStatus === 'paid')
    const unpaidBills = allBills.filter((bill) => bill.paymentStatus !== 'paid')
    const overdueBills = allBills.filter((bill) => bill.paymentStatus === 'overdue')

    return {
      totalBills: allBills.length,
      totalAmount: allBills.reduce((sum, bill) => sum + bill.amount, 0),
      paidBills: paidBills.length,
      unpaidBills: unpaidBills.length,
      overdueBills: overdueBills.length,
      dueSoonBills: 0,
      paidAmount: paidBills.reduce((sum, bill) => sum + bill.amount, 0),
      unpaidAmount: unpaidBills.reduce((sum, bill) => sum + bill.amount, 0),
    }
  }, [allBills, summaryFromApi])

  const overdueCount = useMemo(() => extractItemsCount(overdueResponse), [overdueResponse])

  const handleMarkPaid = (id: string) => {
    const bill = allBills.find((b) => b.id === id) ?? null
    setMarkPaidBill(bill)
    setMarkPaidDialogOpen(true)
  }

  const handleConfirmMarkPaid = (id: string, paidDate: string, absenceDeduction?: number) => {
    setProcessingBillId(id)
    markPaid(
      { id, paidDate, ...(absenceDeduction !== undefined && { absenceDeduction }) },
      {
        onSuccess: () => {
          const isIncome = markPaidBill?.type === 'income'
          toast.success(isIncome ? 'Income marked as received' : 'Bill marked as paid')
          setProcessingBillId(null)
          setMarkPaidDialogOpen(false)
          setMarkPaidBill(null)
        },
        onError: () => {
          setProcessingBillId(null)
        },
      }
    )
  }

  const handleMarkUnpaid = (id: string) => {
    setProcessingBillId(id)
    markUnpaid(
      { id },
      {
        onSuccess: () => {
          toast.success('Bill marked as unpaid')
          setProcessingBillId(null)
        },
        onError: () => {
          setProcessingBillId(null)
        },
      }
    )
  }

  const handleUnarchive = (bill: Bill) => {
    setProcessingBillId(bill.id)
    unarchiveBill(
      { id: bill.id },
      {
        onSuccess: () => {
          toast.success(`${bill.name} is back in your bills`)
          setProcessingBillId(null)
        },
        onError: () => {
          setProcessingBillId(null)
        },
      }
    )
  }

  const handleEdit = (bill: Bill) => {
    setEditingBill(bill)
    setBillModalOpen(true)
  }

  const handleDelete = (bill: Bill) => {
    setDeletingBill(bill)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = () => {
    if (!deletingBill) return
    archiveBill({ id: deletingBill.id.toString() }, {
      onSuccess: () => {
        setDeleteDialogOpen(false)
        setDeletingBill(null)
      },
    })
  }

  const actions = {
    onMarkPaid: handleMarkPaid,
    onMarkUnpaid: handleMarkUnpaid,
    onEdit: handleEdit,
    onDelete: handleDelete,
    onUnarchive: handleUnarchive,
    processingBillId,
  }

  return (
    <IonPage>
      <IonContent className="bg-background text-foreground">
        <main className="mx-auto max-w-7xl px-4 pb-10 pt-5 sm:px-6 lg:px-8">
          <ManageHeader
            statsHref="/statistics#bills-total"
            eyebrow="What is coming up"
            title="Bills & Income"
            addLabel="New Entry"
            loading={summaryLoading || overdueLoading}
            summary={
              summary.totalBills > 0
                ? `${formatMoney(summary.unpaidAmount, currency, hideAmountsOnOpen)} still to pay${overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}`
                : undefined
            }
            onAdd={() => {
              setEditingBill(null)
              setBillModalOpen(true)
            }}
          />

          <div className="mt-5 space-y-6">
            <BillsFilters
              filters={filters}
              onChange={setFilters}
              onReset={() => setFilters(initialFilters)}
            />

            {showDue && (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-foreground">{archivedView ? 'Archived' : 'To pay & receive'}</h2>
                  <p className="text-sm text-muted-foreground">
                    {visibleDue.length} of {dueTotal || visibleDue.length}
                  </p>
                </div>
                <BillsList
                  bills={visibleDue}
                  isLoading={due.isLoading}
                  hasMore={!!due.hasNextPage}
                  isLoadingMore={due.isFetchingNextPage}
                  onLoadMore={() => due.fetchNextPage()}
                  {...actions}
                  emptyTitle={archivedView ? 'No archived bills' : 'All caught up'}
                  emptyText={archivedView ? 'Bills you archive show up here, ready to bring back.' : 'Nothing left to pay or receive with these filters.'}
                />
              </section>
            )}

            {showSettled && (settled.isLoading || settledBills.length > 0) && (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-foreground">Paid & received</h2>
                  <p className="text-sm text-muted-foreground">
                    {visibleSettled.length} of {settledTotal || visibleSettled.length}
                  </p>
                </div>
                <BillsList
                  bills={visibleSettled}
                  isLoading={settled.isLoading}
                  hasMore={!!settled.hasNextPage}
                  isLoadingMore={settled.isFetchingNextPage}
                  onLoadMore={() => settled.fetchNextPage()}
                  {...actions}
                  order="latest"
                />
              </section>
            )}
          </div>

          <BillModal
            open={billModalOpen}
            onClose={() => setBillModalOpen(false)}
            bill={editingBill}
          />

          <DeleteBillDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            onConfirm={handleConfirmDelete}
            isDeleting={isArchiving}
            billName={deletingBill?.name || ''}
          />

          <MarkPaidDialog
            open={markPaidDialogOpen}
            bill={markPaidBill}
            onOpenChange={setMarkPaidDialogOpen}
            onConfirm={handleConfirmMarkPaid}
            isProcessing={processingBillId === markPaidBill?.id}
          />
        </main>
      </IonContent>
    </IonPage>
  )
}
