'use client'

import { useState, useMemo } from 'react'
import BudgetList from '@/components/budgets/budget-list'
import { IonPage, IonContent } from '@ionic/react'
import { BudgetsHeader } from '@/components/page/budget/budgets-header'
import { BudgetOverview } from '@/components/page/budget/budget-overview'
import BudgetModal from '@/components/budgets/budget-modal'
import { useBudgetSummary, useBudgetPerformance } from '@/queries/user/budget/budgets'
import { useSettingsStore } from '@/store/settings-store'

export default function BudgetsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  const { data: summaryResponse, isLoading: summaryLoading } = useBudgetSummary()
  const { data: performanceResponse, isLoading: performanceLoading } = useBudgetPerformance()
  const { currency } = useSettingsStore()

  const summary = useMemo(() => {
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
  }, [summaryResponse, performanceResponse, currency])

  return (
    <IonPage>
      <IonContent className="bg-background text-foreground transition-all duration-300">
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-2">
          <BudgetsHeader 
            onAddBudget={() => setIsModalOpen(true)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
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
            loading={summaryLoading || performanceLoading}
          />

          <BudgetList />
          
          <BudgetModal 
            open={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
          />
        </div>
      </IonContent>
    </IonPage>
  )
}

