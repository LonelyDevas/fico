'use client'

import { useState, useMemo } from 'react'
import BudgetList from '@/components/budgets/budget-list'
import { IonPage, IonContent } from '@ionic/react'
import { BudgetsHeader } from '@/components/page/budget/budgets-header'
import { BudgetOverview } from '@/components/page/budget/budget-overview'
import BudgetModal from '@/components/budgets/budget-modal'
import { useBudgetSummary, useBudgetPerformance, useListBudgets } from '@/queries/user/budget/budgets'
import { useSettingsStore } from '@/store/settings-store'
import { budgetOverlapsMonth, isSameMonth, startOfMonth } from '@/utils/budget-month'

export default function BudgetsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const isCurrentMonth = isSameMonth(month, new Date())
  
  const { data: summaryResponse, isLoading: summaryLoading } = useBudgetSummary()
  const { data: performanceResponse, isLoading: performanceLoading } = useBudgetPerformance()
  // Same params as BudgetList, so both read one cached list.
  const { data: listResponse, isLoading: listLoading } = useListBudgets({ page: '0', limit: '100' })
  const { currency } = useSettingsStore()

  const summary = useMemo(() => {
    // The server summary only covers budgets running today, so another month is totalled
    // from the list rows that cover that month.
    if (!isCurrentMonth) {
      const rows: { amount?: number; spent?: number; startDate?: string; endDate?: string }[] =
        listResponse?.data?.items ?? []
      const inMonth = rows.filter((b) => budgetOverlapsMonth(b, month))
      const totalBudgeted = inMonth.reduce((sum, b) => sum + (Number(b.amount) || 0), 0)
      const totalSpent = inMonth.reduce((sum, b) => sum + (Number(b.spent) || 0), 0)
      const exceeded = inMonth.filter((b) => (Number(b.spent) || 0) >= (Number(b.amount) || 0)).length
      return {
        totalBudgeted,
        totalSpent,
        totalRemaining: totalBudgeted - totalSpent,
        activeBudgets: inMonth.length - exceeded,
        exceededBudgets: exceeded,
        burnRate: totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0,
        performanceMessage: inMonth.length === 0 ? 'No budgets for this month' : '',
        currency,
      }
    }
    const data = summaryResponse?.data
    return {
      totalBudgeted: data?.totalBudgeted || 0,
      totalSpent: data?.totalSpent || 0,
      totalRemaining: data?.totalRemaining || 0,
      activeBudgets: data?.activeBudgets || 0,
      exceededBudgets: data?.exceededBudgets || 0,
      burnRate: performanceResponse?.data?.overallBurnRate || 0,
      performanceMessage: performanceResponse?.data?.message || '',
      currency,
    }
  }, [summaryResponse, performanceResponse, currency, isCurrentMonth, listResponse, month])

  return (
    <IonPage>
      <IonContent className="bg-background text-foreground transition-all duration-300">
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-2">
          <BudgetsHeader 
            onAddBudget={() => setIsModalOpen(true)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            month={month}
            onMonthChange={setMonth}
          />
          
          <BudgetOverview 
            totalBudgeted={summary.totalBudgeted}
            totalSpent={summary.totalSpent}
            totalRemaining={summary.totalRemaining}
            activeBudgets={summary.activeBudgets}
            exceededBudgets={summary.exceededBudgets}
            currency={summary.currency}
            burnRate={summary.burnRate}
            message={summary.performanceMessage}
            loading={isCurrentMonth ? summaryLoading || performanceLoading : listLoading}
          />

          <BudgetList month={month} />
          
          <BudgetModal 
            open={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
          />
        </div>
      </IonContent>
    </IonPage>
  )
}

