'use client'

import { useEffect, useMemo, useState } from 'react'
import { IonPage, IonContent } from '@ionic/react'
import toast from 'react-hot-toast'
import { BillsHeader } from '@/components/page/bills/bills-header'
import { BillsOverview } from '@/components/page/bills/bills-overview'
import { BillsFilters, BillsFilterState } from '@/components/page/bills/bills-filters'
import { BillsList } from '@/components/page/bills/bills-list'
import { BillModal } from '@/components/page/bills/bill-modal'
import { DeleteBillDialog } from '@/components/page/bills/delete-bill-dialog'
import { MarkPaidDialog } from '@/components/page/bills/mark-paid-dialog'
import {
  useBillSummary,
  useListBills,
  useMarkBillPaid,
  useMarkBillUnpaid,
  useArchiveBill,
  useOverdueBills,
  useUpcomingBills,
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

const convertFilterToParams = (filters: BillsFilterState, page: number, limit: number): ListBillsParams => {
  const params: ListBillsParams = {
    page: String(page),
    limit: String(limit),
  }

  if (filters.paymentStatus !== 'all') {
    params.paymentStatus = filters.paymentStatus
  }

  if (filters.status !== 'all') {
    params.status = filters.status
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

export default function BillsPage() {
  const [filters, setFilters] = useState<BillsFilterState>(initialFilters)
  const [page, setPage] = useState(0)
  const [limit] = useState(10)
  const [allBills, setAllBills] = useState<ReturnType<typeof normalizeBillsResponse>>([])
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [processingBillId, setProcessingBillId] = useState<string | null>(null)
  
  const [billModalOpen, setBillModalOpen] = useState(false)
  const [editingBill, setEditingBill] = useState<Bill | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingBill, setDeletingBill] = useState<Bill | null>(null)
  const [markPaidDialogOpen, setMarkPaidDialogOpen] = useState(false)
  const [markPaidBill, setMarkPaidBill] = useState<Bill | null>(null)

  const apiParams = useMemo(() => convertFilterToParams(filters, page, limit), [filters, page, limit])

  const {
    data: billsResponse,
    isLoading: billsLoading,
  } = useListBills(apiParams)

  const { data: summaryResponse, isLoading: summaryLoading } = useBillSummary()
  const { data: upcomingResponse, isLoading: upcomingLoading } = useUpcomingBills({ days: '7' })
  const { data: overdueResponse, isLoading: overdueLoading } = useOverdueBills()

  const { mutate: markPaid } = useMarkBillPaid()
  const { mutate: markUnpaid } = useMarkBillUnpaid()
  const { mutate: archiveBill, isPending: isArchiving } = useArchiveBill()

  const currentPageBills = useMemo(() => normalizeBillsResponse(billsResponse), [billsResponse])
  const paginationMeta = useMemo(() => extractPaginationMeta(billsResponse), [billsResponse])

  useEffect(() => {
    if (page === 0) {
      setAllBills(currentPageBills)
      return
    }

    setAllBills((previous) => [...previous, ...currentPageBills])
    setIsLoadingMore(false)
  }, [currentPageBills, page])

  useEffect(() => {
    setPage(0)
    setAllBills([])
    setIsLoadingMore(false)
  }, [filters])

  const searchFilteredBills = useMemo(() => {
    if (!filters.search.trim()) {
      return allBills
    }

    const keyword = filters.search.trim().toLowerCase()
    return allBills.filter((bill) => bill.name.toLowerCase().includes(keyword))
  }, [allBills, filters.search])

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

  const upcomingCount = useMemo(() => extractItemsCount(upcomingResponse), [upcomingResponse])
  const overdueCount = useMemo(() => extractItemsCount(overdueResponse), [overdueResponse])

  const hasMore = page + 1 < paginationMeta.totalPages

  const handleLoadMore = () => {
    if (isLoadingMore || !hasMore) return
    setIsLoadingMore(true)
    setPage((previous) => previous + 1)
  }

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

  return (
    <IonPage>
      <IonContent className="bg-background text-foreground">
        <main className="flex-1">
          <BillsHeader
            onCreate={() => {
              setEditingBill(null)
              setBillModalOpen(true)
            }}
          />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6">
            <BillsOverview
              summary={summary}
              upcomingCount={upcomingCount}
              overdueCount={overdueCount}
              isLoading={summaryLoading || upcomingLoading || overdueLoading}
            />

            <BillsFilters
              filters={filters}
              onChange={setFilters}
              onReset={() => setFilters(initialFilters)}
            />

            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-foreground">Ledger</h2>
              <p className="text-sm text-muted-foreground">
                {searchFilteredBills.length} of {paginationMeta.totalItems || searchFilteredBills.length} entr
                {searchFilteredBills.length === 1 ? 'y' : 'ies'}
              </p>
            </div>

            <BillsList
              bills={searchFilteredBills}
              isLoading={billsLoading && page === 0}
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
              onLoadMore={handleLoadMore}
              onMarkPaid={handleMarkPaid}
              onMarkUnpaid={handleMarkUnpaid}
              onEdit={handleEdit}
              onDelete={handleDelete}
              processingBillId={processingBillId}
            />
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
