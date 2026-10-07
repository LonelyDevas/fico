'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateBill, useUpdateBill } from '@/queries/user/bill/bills'
import { useListWallets } from '@/queries/user/wallet/wallets'
import { useListCategories } from '@/queries/user/category/categories'
import { useSettingsStore } from '@/store/settings-store'
import { getCurrencySymbol } from '@/types/settings'
import { CreateBillData, UpdateBillData, Bill, BillType, RecurringFrequency } from '../../../types/bill'
import toast from 'react-hot-toast'

interface BillModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  bill?: Bill | null // If provided, we are in Edit mode
}

export function BillModal({ open, onClose, onSuccess, bill }: BillModalProps) {
  const isEdit = !!bill
  const currency = useSettingsStore((state) => state.currency)
  const currencySymbol = getCurrencySymbol(currency)

  const [formData, setFormData] = useState<Partial<CreateBillData>>({
    type: 'bill',
    name: '',
    amount: 0,
    dueDate: new Date().toISOString().split('T')[0],
    isRecurring: false,
    recurringFrequency: 'monthly',
    walletId: '',
    categoryId: '',
    notes: '',
  })

  const billType = isEdit ? bill?.type ?? 'bill' : formData.type ?? 'bill'
  // Mutations
  const { mutate: createBill, isPending: isCreating } = useCreateBill()
  const { mutate: updateBill, isPending: isUpdating } = useUpdateBill()

  // Supporting Data
  const { data: walletsResponse } = useListWallets()
  const { data: categoriesResponse } = useListCategories({ type: billType === 'income' ? 'income' : 'expense' })

  const wallets = walletsResponse?.data ? 
    (Array.isArray(walletsResponse.data) ? walletsResponse.data : walletsResponse.data.items || [])
    : []
  
  const categories = categoriesResponse?.data ? 
    (Array.isArray(categoriesResponse.data) ? categoriesResponse.data : categoriesResponse.data.items || [])
    : []

  // Initialize form when bill changes (Edit mode)
  useEffect(() => {
    if (bill && bill.id) {
      const categoryValue = bill.categoryId ?? (bill as any)?.category?._id ?? ''
      const walletValue = bill.walletId ?? (bill as any)?.wallet?._id ?? ''

      setFormData({
        type: bill.type ?? 'bill',
        name: bill.name,
        amount: bill.amount,
        dueDate: bill.dueDate ? new Date(bill.dueDate).toISOString().split('T')[0] : '',
        isRecurring: bill.isRecurring,
        recurringFrequency: bill.recurringFrequency,
        walletId: walletValue ? String(walletValue) : '',
        categoryId: categoryValue ? String(categoryValue) : '',
        notes: bill.notes,
        absenceDeduction: bill.absenceDeduction,
      })
    } else if (open && !bill) {
      setFormData({
        type: 'bill',
        name: '',
        amount: 0,
        dueDate: new Date().toISOString().split('T')[0],
        isRecurring: false,
        recurringFrequency: 'monthly',
        walletId: '',
        categoryId: '',
        notes: '',
        absenceDeduction: undefined,
      })
    }
  }, [bill?.id, open])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData((prev: Partial<CreateBillData>) => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) : value,
    }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev: Partial<CreateBillData>) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name?.trim()) {
      toast.error(formData.type === 'income' ? 'Income name is required' : 'Bill name is required')
      return
    }
    if (!formData.amount || formData.amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    if (!formData.dueDate) {
      toast.error('Due date is required')
      return
    }

    if (isEdit && bill) {
      const updateData: UpdateBillData = {
        id: bill.id,
        name: formData.name,
        amount: formData.amount,
        dueDate: formData.dueDate,
        isRecurring: formData.isRecurring,
        recurringFrequency: formData.recurringFrequency,
        walletId: formData.walletId && formData.walletId.trim() !== '' ? formData.walletId : undefined,
        categoryId: formData.categoryId && formData.categoryId.trim() !== '' ? formData.categoryId : undefined,
        notes: formData.notes || undefined,
      }
      updateBill(updateData, {
        onSuccess: () => {
          toast.success(formData.type === 'income' ? 'Income updated successfully' : 'Bill updated successfully')
          onClose()
          onSuccess?.()
        },
      })
    } else {
      createBill(formData as CreateBillData, {
        onSuccess: () => {
          toast.success(formData.type === 'income' ? 'Income created successfully' : 'Bill created successfully')
          onClose()
          onSuccess?.()
        },
      })
    }
  }

  if (!open) return null

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent className="p-0 sm:max-w-xl" showCloseButton={false}>
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-card md:rounded-2xl md:border md:border-border md:shadow-ios-lg">
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-gradient-to-r from-primary/5 to-transparent p-6">
          <div>
            <SheetTitle className="text-xl font-bold text-foreground">
              {isEdit ? (formData.type === 'income' ? 'Edit Income' : 'Edit Bill') : (formData.type === 'income' ? 'New Income' : 'New Bill')}
            </SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground mt-1">
              {isEdit
                ? (formData.type === 'income' ? 'Update your recurring income details.' : 'Update your recurring bill details.')
                : (formData.type === 'income' ? 'Track an expected or recurring income entry.' : 'Set up a new recurring or one-time payment.')}
            </SheetDescription>
          </div>
          <button
            onClick={onClose}
            className="max-md:hidden p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 space-y-5 overflow-y-auto p-6">
          {/* Type Selector */}
          {!isEdit && (
            <div className="flex gap-2">
              {(['bill', 'income'] as BillType[]).map((t) => (
                <Badge
                  key={t}
                  asChild
                  variant={formData.type === t ? 'default' : 'outline'}
                  className="cursor-pointer rounded-full px-4 py-1.5 text-sm"
                >
                  <button type="button" onClick={() => handleSelectChange('type', t)}>
                    {t === 'bill' ? 'Bill / Expense' : 'Income'}
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* Name */}
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-semibold text-foreground">
              {formData.type === 'income' ? 'Income Name' : 'Bill Name'} <span className="text-destructive">*</span>
            </label>
            <Input
              id="name"
              name="name"
              placeholder={formData.type === 'income' ? 'e.g. Salary, Freelance Payment, Dividend' : 'e.g. Netflix Subscription, Rent, Internet'}
              value={formData.name}
              onChange={handleChange}
              className="bg-secondary/30"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Amount */}
            <div className="space-y-2">
              <label htmlFor="amount" className="text-sm font-semibold text-foreground">
                Amount <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">{currencySymbol}</span>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.amount || ''}
                  onChange={handleChange}
                  className="pl-8 bg-secondary/30"
                />
              </div>
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <label htmlFor="dueDate" className="text-sm font-semibold text-foreground">
                {formData.type === 'income' ? 'Expected Date' : 'Due Date'} <span className="text-destructive">*</span>
              </label>
              <Input
                id="dueDate"
                name="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={handleChange}
                className="bg-secondary/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Wallet Selection */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Payment Wallet</label>
              <Select value={formData.walletId || ''} onValueChange={(val) => handleSelectChange('walletId', val)}>
                <SelectTrigger className="bg-secondary/30">
                  <SelectValue placeholder="Select a wallet" />
                </SelectTrigger>
                <SelectContent>
                  {wallets.filter((w: any) => formData.type === 'income' || w.type !== 'savings').map((w: any) => (
                    <SelectItem key={w._id || w.id} value={String(w._id || w.id)}>
                      {w.name}
                      {w.type === 'credit_card' ? ' (credit card)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category Selection */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Category</label>
              <Select key={billType} value={formData.categoryId || ''} onValueChange={(val) => handleSelectChange('categoryId', val)}>
                <SelectTrigger className="bg-secondary/30">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c: any) => (
                    <SelectItem key={c._id || c.id} value={String(c._id || c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Recurrence Toggle */}
          <div className="bg-secondary/20 p-4 rounded-xl space-y-4 border border-border/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{formData.type === 'income' ? 'Recurring Income' : 'Recurring Bill'}</p>
                <p className="text-xs text-muted-foreground">{formData.type === 'income' ? 'Automatically create next entry after receiving.' : 'Automatically create next bill after payment.'}</p>
              </div>
              <Switch
                checked={formData.isRecurring}
                onCheckedChange={(checked) =>
                  setFormData((prev: Partial<CreateBillData>) => ({ ...prev, isRecurring: checked }))
                }
              />
            </div>

            {formData.isRecurring && (
              <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Frequency</label>
                <Select
                  value={formData.recurringFrequency}
                  onValueChange={(val) => handleSelectChange('recurringFrequency', val)}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label htmlFor="notes" className="text-sm font-semibold text-foreground">Notes (Optional)</label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Add any additional details about this bill..."
              value={formData.notes || ''}
              onChange={handleChange}
              className="bg-secondary/30 resize-none"
            />
          </div>
        </form>

        <SheetFooter className="shrink-0 flex items-center justify-end gap-3 border-t border-border bg-secondary/10 px-6 py-6">
          <Button variant="outline" onClick={onClose} disabled={isCreating || isUpdating} className="w-full sm:w-auto sm:flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isCreating || isUpdating}
            className="w-full sm:w-auto sm:flex-1 shadow-lg shadow-primary/20"
          >
            {isCreating || isUpdating ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                <span>Saving...</span>
              </div>
            ) : (
              <span>{isEdit ? (formData.type === 'income' ? 'Update Income' : 'Update Bill') : (formData.type === 'income' ? 'Create Income' : 'Create Bill')}</span>
            )}
          </Button>
        </SheetFooter>
      </div>
      </SheetContent>
    </Sheet>
  )
}
