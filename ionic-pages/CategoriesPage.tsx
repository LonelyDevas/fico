import { useState, useMemo } from 'react'
import CategoryList from '@/components/categories/category-list'
import { IonPage, IonContent } from '@ionic/react'
import { CategoriesHeader } from '@/components/page/categories/categories-header'
import { CategoryOverview } from '@/components/page/categories/category-overview'
import CategoryModal from '@/components/categories/category-modal'
import { useListCategories, useCategorySummary } from '@/queries/user/category/categories'
import { useSettingsStore } from '@/store/settings-store'

export default function CategoriesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  const { data: categoryResponse } = useListCategories()
  const { data: summaryResponse, isLoading: summaryLoading } = useCategorySummary()
  const { currency } = useSettingsStore()

  const categoriesCount = useMemo(() => {
    const data = categoryResponse?.data
    if (Array.isArray(data)) return data.length
    if (data && typeof data === 'object') {
      const items = (data as any).items || (data as any).categories
      if (Array.isArray(items)) return items.length
    }
    return 0
  }, [categoryResponse])

  const summary = useMemo(() => {
    return {
      totalCategories: categoriesCount,
      mostUsedCategory: summaryResponse?.data?.mostUsedCategory?.name || 'None',
      totalBudget: summaryResponse?.data?.totalBudget || 0,
      budgetAlerts: summaryResponse?.data?.budgetAlerts || 0,
      currency,
    }
  }, [categoriesCount, summaryResponse, currency])

  return (
    <IonPage>
      <IonContent className="bg-background text-foreground transition-colors duration-300">
        <div className="p-6 max-w-7xl mx-auto">
          <CategoriesHeader 
            onAddCategory={() => setIsModalOpen(true)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
          
          <CategoryOverview 
            totalCategories={summary.totalCategories}
            mostUsedCategory={summary.mostUsedCategory}
            monthlyBudget={summary.totalBudget}
            budgetAlerts={summary.budgetAlerts}
            currency={summary.currency}
            isLoading={summaryLoading}
          />

          <CategoryList />
          
          <CategoryModal 
            open={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
          />
        </div>
      </IonContent>
    </IonPage>
  )
}

