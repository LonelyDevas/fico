'use client'
import React, { useState, useMemo } from 'react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Plus, LayoutGrid, List, Sparkles } from 'lucide-react'
import BudgetModal from './budget-modal'
import { useListBudgets, useUpdateBudget, useRolloverBudget } from '@/queries/user/budget/budgets'
import { BudgetCard } from '@/components/page/budget/budget-card'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { BudgetPeriod } from '@/types/budget'

interface BudgetCategory {
  id: string
  name: string
  color: string
}

interface BudgetViewModel {
  id: string
  name: string
  amount: number
  spent: number
  remaining: number
  period: BudgetPeriod
  alertThreshold: number
  categoryIds: string[]
  categories: BudgetCategory[]
  percentageUsed: number
  isOverBudget: boolean
  isNearThreshold: boolean
}

interface BudgetApiItem {
  _id?: string
  id?: string
  name?: string
  amount?: number
  spent?: number
  remaining?: number
  period?: string
  alertThreshold?: number
  categoryIds?: string[]
  categories?: BudgetCategory[]
}

const normalizeBudget = (budget: BudgetApiItem, index: number): BudgetViewModel => {
  const resolvedId = budget._id ?? budget.id ?? `budget-${index}`
  const budgetAmount = Number(budget.amount) || 0
  const spentAmount = Number(budget.spent) || 0
  const remainingAmount = Number(budget.remaining) || (budgetAmount - spentAmount)
  const alertThreshold = Number(budget.alertThreshold) || 80
  const percentageUsed = budgetAmount > 0 ? (spentAmount / budgetAmount) * 100 : 0

  return {
    id: resolvedId,
    name: budget.name || 'Untitled Budget',
    amount: budgetAmount,
    spent: spentAmount,
    remaining: remainingAmount,
      period: (budget.period as BudgetPeriod) || 'monthly',
    alertThreshold: alertThreshold,
    categoryIds: budget.categoryIds ?? [],
    categories: budget.categories ?? [],
    percentageUsed: percentageUsed,
    isOverBudget: spentAmount > budgetAmount,
    isNearThreshold: percentageUsed >= alertThreshold && spentAmount <= budgetAmount,
  }
}

export default function BudgetList() {
  const [open, setOpen] = useState(false)
  const [selectedBudget, setSelectedBudget] = useState<BudgetViewModel | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const { data: budgetResponse, isLoading, refetch } = useListBudgets({ page: '0', limit: '100' })
  const { mutate: rolloverBudget } = useRolloverBudget()
  const { currency, hideAmountsOnOpen } = useSettingsStore()

  const budgets = useMemo(() => {
    const responseData = budgetResponse?.data as
      | BudgetApiItem[]
      | { items?: BudgetApiItem[]; budgets?: BudgetApiItem[] }
      | undefined

    let items: BudgetApiItem[] = []
    if (Array.isArray(responseData)) {
      items = responseData
    } else if (responseData && Array.isArray(responseData.items)) {
      items = responseData.items
    } else if (responseData && Array.isArray(responseData.budgets)) {
      items = responseData.budgets
    }

    return items.map((budget, budgetIndex) => normalizeBudget(budget, budgetIndex))
  }, [budgetResponse])

  const handleRollover = (id: string) => {
    rolloverBudget(id, {
        onSuccess: () => {
            toast.success('Budget rolled over successfully')
            refetch()
        },
        onError: (err) => {
            toast.error('Failed to rollover budget')
        }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-card/40 border border-border/50 p-2 rounded-2xl">
        <div className="flex items-center gap-4 ml-2">
            <h2 className="text-xl font-bold text-foreground">Active Goals</h2>
            <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                {budgets.length} TOTAL
            </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            className="h-9 w-9 rounded-xl transition-all"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="w-5 h-5" />
          </Button>
          <Button
            size="icon"
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            className="h-9 w-9 rounded-xl transition-all"
            onClick={() => setViewMode('list')}
          >
            <List className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
          {[...Array(3)].map((_, index) => (
            <div key={index} className="h-56 rounded-2xl bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : budgets.length > 0 ? (
        <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
          {budgets.map((b) => (
            viewMode === 'grid' ? (
              <BudgetCard 
                key={b.id} 
                {...b} 
                onEdit={() => setSelectedBudget(b)} 
                onRollover={() => handleRollover(b.id)}
              />
            ) : (
                <div key={b.id} className="p-4 bg-card border border-border rounded-2xl flex items-center justify-between group transition-all hover:border-primary/50">
                   <div className="flex items-center gap-4">
                        <div 
                            className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
                            style={{ backgroundColor: b.categories[0]?.color || '#6366f1' }}
                        >
                            {b.name.charAt(0)}
                        </div>
                        <div>
                            <p className="font-bold text-foreground">{b.name}</p>
                            <p className="text-xs text-muted-foreground uppercase">{b.period} • {b.categories.length > 0 ? b.categories.map((c) => c.name).join(', ') : 'All expenses'}</p>
                        </div>
                   </div>
                   
                   <div className="flex-1 max-w-xs mx-8 hidden md:block">
                        <div className="flex justify-between text-xs font-bold text-muted-foreground mb-1">
                            <span>{b.percentageUsed.toFixed(0)}% Used</span>
                            <span>{formatMoney(b.spent, currency, hideAmountsOnOpen)} / {formatMoney(b.amount, currency, hideAmountsOnOpen)}</span>
                        </div>
                        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                            <div 
                                className={`h-full rounded-full transition-all ${b.isOverBudget ? 'bg-destructive' : 'bg-primary'}`}
                                style={{ width: `${Math.min(b.percentageUsed, 100)}%` }}
                             />
                        </div>
                   </div>

                   <div className="flex items-center gap-4">
                        <div className="text-right">
                           <p className={`font-bold ${b.isOverBudget ? 'text-destructive' : 'text-foreground'}`}>
                             {formatMoney(b.remaining, currency, hideAmountsOnOpen)}
                           </p>
                           <p className="text-xs text-muted-foreground uppercase">{b.isOverBudget ? 'Over Limit' : 'Left'}</p>
                        </div>
                   </div>
                </div>
            )
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center bg-card/40 border border-dashed border-border rounded-[2.5rem] py-20 px-6 text-center">
          <div className="p-6 bg-primary/5 rounded-full mb-6">
            <Sparkles className="w-12 h-12 text-primary/60" />
          </div>
          <h3 className="text-2xl font-black text-foreground mb-2">No active budgets</h3>
          <p className="text-muted-foreground max-w-md mb-8">
            Take control of your finances by setting limits for your spending categories. 
            We'll help you stay on track!
          </p>
          <Button size="lg" className="rounded-2xl h-14 px-8 text-lg font-bold shadow-lg shadow-primary/20" onClick={() => setOpen(true)}>
            <Plus className="w-5 h-5 mr-3" />
            Create Your First Goal
          </Button>
        </div>
      )}

      <BudgetModal open={open} onClose={() => setOpen(false)} />
      <BudgetModal open={!!selectedBudget} onClose={() => setSelectedBudget(null)} budget={selectedBudget} />
    </div>
  )
}

