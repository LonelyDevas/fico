'use client'
import { EmptyState } from '@/components/peacock-mascot'
import React, { useState, useMemo } from 'react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import BillDetail from './bill-detail'
import { useListBills, useMarkBillPaid } from '@/queries/user/bill/bills'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'

interface BillViewModel {
  id: string
  name: string
  amount: number
  dueDate: string
  paymentStatus: string
}

interface BillApiItem {
  _id?: string
  id?: string
  name?: string
  amount?: number
  dueDate?: string
  paymentStatus?: string
}

const normalizeBill = (bill: BillApiItem, index: number): BillViewModel => {
  const resolvedId = bill._id ?? bill.id ?? `bill-${index}`
  const dueDate = new Date(bill.dueDate || '').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return {
    id: resolvedId,
    name: bill.name || 'Untitled Bill',
    amount: Number(bill.amount) || 0,
    dueDate: dueDate || 'No date',
    paymentStatus: bill.paymentStatus || 'unpaid',
  }
}

export default function BillList() {
  const [selected, setSelected] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { data: billResponse, isLoading, refetch } = useListBills()
  const { mutate: markPaid } = useMarkBillPaid()
  const { currency, hideAmountsOnOpen } = useSettingsStore()

  const bills = useMemo(() => {
    const responseData = billResponse?.data as
      | BillApiItem[]
      | { items?: BillApiItem[]; bills?: BillApiItem[] }
      | undefined

    if (Array.isArray(responseData)) {
      return responseData.map((bill, billIndex) => normalizeBill(bill, billIndex))
    }

    if (responseData && Array.isArray(responseData.items)) {
      return responseData.items.map((bill, billIndex) => normalizeBill(bill, billIndex))
    }

    if (responseData && Array.isArray(responseData.bills)) {
      return responseData.bills.map((bill, billIndex) => normalizeBill(bill, billIndex))
    }

    return []
  }, [billResponse])

  const handleMarkPaid = (billId: string) => {
    markPaid(
      { id: billId },
      {
        onSuccess: () => {
          toast.success('Bill marked as paid')
          refetch()
        },
      }
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium">Your Bills</h2>
        <Button size="sm" className="gap-2" onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4" />
          New Bill
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="h-20 rounded-lg bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : bills.length > 0 ? (
        <div className="space-y-2">
          {bills.map((b) => (
            <div key={b.id} className="p-4 bg-gradient-to-br from-card to-secondary border border-border rounded-xl flex justify-between items-center hover:shadow-md transition-all duration-300">
              <div>
                <div className="font-medium">{b.name}</div>
                <div className="text-sm text-muted-foreground">Due {b.dueDate}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="font-semibold">{formatMoney(b.amount, currency, hideAmountsOnOpen)}</div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleMarkPaid(b.id)}
                    disabled={b.paymentStatus === 'paid'}
                  >
                    {b.paymentStatus === 'paid' ? 'Paid' : 'Pay'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelected(b.id)}>
                    Details
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 bg-gradient-to-br from-card to-secondary border border-border rounded-xl">
          <EmptyState pose="advisor" title="No bills found" description="Add your bills and I will help you stay on top of them.">
            <Button size="sm" className="gap-2" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4" />
              Create Your First Bill
            </Button>
          </EmptyState>
        </div>
      )}

      {selected && <BillDetail billId={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
