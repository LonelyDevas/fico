"use client"
import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import toast from 'react-hot-toast'
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateBudget, useListBudgets, useBudgetSummary, useUpdateBudget } from '@/queries/user/budget/budgets'
import { useListCategories } from '@/queries/user/category/categories'
import { useSettingsStore } from '@/store/settings-store'
import { getCurrencySymbol } from '@/types/settings'
import { Check, Loader2 } from 'lucide-react'
import { BudgetPeriod } from '@/types/budget'

const budgetSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
  categoryIds: z.array(z.string()).min(1, 'Pick at least one category'),
  period: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  alertThreshold: z.coerce.number().min(1).max(100).default(80),
})

type BudgetFormValues = z.infer<typeof budgetSchema>

type BudgetSeed = {
  id: string
  name?: string
  amount?: number
  categoryIds?: string[]
  period?: BudgetPeriod
  alertThreshold?: number
}

export default function BudgetModal({ open, onClose, budget }: { open: boolean; onClose: () => void; budget?: BudgetSeed | null }) {
  const { refetch: refetchBudgets } = useListBudgets()
  const { refetch: refetchSummary } = useBudgetSummary()
  const { mutate: createBudget, isPending } = useCreateBudget()
  const { mutate: updateBudget, isPending: isUpdating } = useUpdateBudget()
  const { data: categoriesResponse } = useListCategories({ type: 'expense' })
  const currency = useSettingsStore((state) => state.currency)
  const currencySymbol = getCurrencySymbol(currency)
  const isEdit = !!budget
  
  const categories = Array.isArray(categoriesResponse?.data) 
    ? categoriesResponse.data 
    : categoriesResponse?.data?.items || []

  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      name: '',
      amount: 0,
      categoryIds: [],
      period: 'monthly',
      alertThreshold: 80,
    },
  })

  const selectedCategoryIds = form.watch('categoryIds')

  useEffect(() => {
    if (!open) return

    if (budget) {
      form.reset({
        name: budget.name || '',
        amount: budget.amount || 0,
        categoryIds: budget.categoryIds ?? [],
        period: budget.period || 'monthly',
        alertThreshold: budget.alertThreshold || 80,
      })
      return
    }

    form.reset({
      name: '',
      amount: 0,
      categoryIds: [],
      period: 'monthly',
      alertThreshold: 80,
    })
  }, [open, budget, form])

  const onSubmit = (data: BudgetFormValues) => {
    // Calculate startDate/endDate as the current calendar period (not a
    // rolling window from "right now"), so a budget created mid-period picks
    // up transactions already logged earlier in that period — matching how
    // every other "this month/week/year" figure in the app (reports RPCs)
    // defines its window. A rolling window from creation time made a
    // freshly-created budget's spent total start at 0 even when the
    // category already had spending earlier in the period.
    const now = new Date()
    let start: Date
    let end: Date
    if (data.period === 'daily') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)
    } else if (data.period === 'weekly') {
      const dayOfWeek = now.getDay() // 0 = Sunday
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday)
      end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)
    } else if (data.period === 'yearly') {
      start = new Date(now.getFullYear(), 0, 1)
      end = new Date(start.getFullYear() + 1, 0, 1)
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      end = new Date(start.getFullYear(), start.getMonth() + 1, 1)
    }
    const startDate = start.toISOString()
    const endDate = end.toISOString()

    const payload = {
      ...data,
      startDate,
      endDate,
    }

    if (isEdit && budget) {
      updateBudget(
        { id: budget.id, ...payload },
        {
          onSuccess: () => {
            toast.success('Budget updated successfully')
            refetchBudgets()
            refetchSummary()
            onClose()
          },
          onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Failed to update budget')
          },
        }
      )
      return
    }

    createBudget(payload, {
      onSuccess: () => {
        toast.success('Budget created successfully')
        refetchBudgets()
        refetchSummary()
        form.reset()
        onClose()
      },
      onError: (error: any) => {
        toast.error(error?.response?.data?.message || 'Failed to create budget')
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl" showCloseButton={false}>
        <SheetHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <SheetTitle className="text-2xl font-black text-foreground">{isEdit ? 'Edit Goal' : 'Set New Goal'}</SheetTitle>
              <SheetDescription>Define a spending limit for your categories.</SheetDescription>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="max-md:hidden rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <span className="sr-only">Close</span>
              X
            </button>
          </div>
        </SheetHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Goal Name</label>
            <Input 
              {...form.register('name')} 
              placeholder="e.g. Monthly Coffee, Rent..." 
              className="h-12 bg-secondary/30 border-none rounded-xl focus-visible:ring-1 focus-visible:ring-primary"
            />
            {form.formState.errors.name && (
              <p className="text-[10px] font-bold text-destructive uppercase">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Trigger Limit</label>
                <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">{currencySymbol}</span>
                    <Input 
                        type="number"
                        {...form.register('amount')} 
                        className="h-12 pl-8 bg-secondary/30 border-none rounded-xl focus-visible:ring-1 focus-visible:ring-primary"
                    />
                </div>
                {form.formState.errors.amount && (
                    <p className="text-[10px] font-bold text-destructive uppercase">{form.formState.errors.amount.message}</p>
                )}
            </div>

            <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Period</label>
                <Select 
                    onValueChange={(value) => form.setValue('period', value as any)}
                    defaultValue={form.getValues('period')}
                >
                    <SelectTrigger className="h-12 bg-secondary/30 border-none rounded-xl">
                        <SelectValue placeholder="Period" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Categories</label>
              <span className="text-xs font-semibold text-primary">
                {selectedCategoryIds.length === 0 ? 'None picked' : `${selectedCategoryIds.length} picked`}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Pick one or more. Spending in any of them counts toward this goal.</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat: any) => {
                const id = String(cat.id || cat._id)
                const selected = selectedCategoryIds.includes(id)
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      form.setValue(
                        'categoryIds',
                        selected ? selectedCategoryIds.filter((value) => value !== id) : [...selectedCategoryIds, id],
                        { shouldValidate: true }
                      )
                    }
                    className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${
                      selected ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary/30 text-foreground'
                    }`}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    {cat.name}
                    {selected && <Check className="h-3.5 w-3.5" />}
                  </button>
                )
              })}
            </div>
            {form.formState.errors.categoryIds && (
              <p className="text-[10px] font-bold text-destructive uppercase">{form.formState.errors.categoryIds.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Alert Me At</label>
                <span className="text-xs font-black text-primary">{form.watch('alertThreshold')}% Usage</span>
            </div>
            <Input 
                type="range"
                min="1"
                max="100"
                {...form.register('alertThreshold')}
                className="h-2 w-full bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>

          <SheetFooter className="px-0 pt-6 border-t-0">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending || isUpdating} className="rounded-xl h-12">
              Dismiss
            </Button>
            <Button type="submit" disabled={isPending || isUpdating} className="rounded-xl h-12 min-w-[140px] font-bold shadow-lg shadow-primary/20">
              {isPending || isUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : isEdit ? 'Save Goal' : 'Activate Goal'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )

  function onOpenChange(open: boolean) {
    if (!open) onClose()
  }
}

