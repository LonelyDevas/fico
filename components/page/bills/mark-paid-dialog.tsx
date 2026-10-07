'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { ConfirmSheet } from '@/components/ui/confirm-sheet'
import { Bill } from '@/types/bill'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'

interface MarkPaidDialogProps {
  open: boolean
  bill: Bill | null
  onOpenChange: (open: boolean) => void
  onConfirm: (id: string, paidDate: string, absenceDeduction?: number) => void
  isProcessing?: boolean
}

export function MarkPaidDialog({ open, bill, onOpenChange, onConfirm, isProcessing }: MarkPaidDialogProps) {
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split('T')[0])
  const [absenceDeduction, setAbsenceDeduction] = useState<number | undefined>(undefined)
  const { currency, hideAmountsOnOpen } = useSettingsStore()

  useEffect(() => {
    if (open && bill) {
      setPaidDate(new Date().toISOString().split('T')[0])
      setAbsenceDeduction(bill.absenceDeduction)
    }
  }, [open, bill])

  if (!bill) return null

  const isIncome = bill.type === 'income'
  const actionLabel = isIncome ? 'Mark as Received' : 'Mark as Paid'
  const dateLabel = isIncome ? 'Date Received' : 'Date Paid'

  const handleConfirm = () => {
    if (!paidDate) return
    onConfirm(bill.id, paidDate, absenceDeduction)
  }

  return (
    <ConfirmSheet
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={handleConfirm}
      variant="success"
      title={actionLabel}
      description={`Pick the date this was ${isIncome ? 'received' : 'paid'}.`}
      confirmLabel={actionLabel}
      confirmingLabel="Saving..."
      isConfirming={isProcessing}
      confirmDisabled={!paidDate}
    >
      <div className="space-y-2 rounded-2xl border border-border bg-secondary/20 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Name</span>
          <span className="max-w-[200px] truncate font-semibold text-foreground">{bill.name}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Amount</span>
          <span className="font-bold text-foreground">{formatMoney(bill.amount, currency, hideAmountsOnOpen)}</span>
        </div>
        {bill.absenceDeduction != null && bill.absenceDeduction > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Absence Deduction</span>
            <span className="font-semibold text-warning">{formatMoney(bill.absenceDeduction, currency, hideAmountsOnOpen)}</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="paidDate" className="text-sm font-semibold text-foreground">
          {dateLabel} <span className="text-destructive">*</span>
        </label>
        <Input
          id="paidDate"
          type="date"
          value={paidDate}
          max={new Date().toISOString().split('T')[0]}
          onChange={(e) => setPaidDate(e.target.value)}
          className="block w-full min-w-0 max-w-full appearance-none bg-secondary/30"
        />
        <p className="text-xs text-muted-foreground">
          Defaults to today. Change this if you paid earlier and are registering it now.
        </p>
      </div>

      <div className="space-y-2 pb-2">
        <label htmlFor="deductionAmount" className="text-sm font-semibold text-foreground">
          Absence Deduction <span className="text-muted-foreground font-normal">(Optional)</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">{currency}</span>
          <Input
            id="deductionAmount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={absenceDeduction ?? ''}
            onChange={(e) => setAbsenceDeduction(e.target.value === '' ? undefined : parseFloat(e.target.value))}
            className="pl-14 bg-secondary/30"
          />
        </div>
        <p className="text-xs text-muted-foreground">Update or add absence deduction for this period if applicable.</p>
      </div>
    </ConfirmSheet>
  )
}
