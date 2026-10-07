'use client'

import { Tag, PieChart, TrendingUp, AlertCircle } from 'lucide-react'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { StatGrid, StatTile } from '@/components/ui/stat-tile'

interface CategoryOverviewProps {
  totalCategories: number
  mostUsedCategory: string
  monthlyBudget: number
  budgetAlerts: number
  currency: string
  isLoading?: boolean
}

export function CategoryOverview({
  totalCategories,
  mostUsedCategory,
  monthlyBudget,
  budgetAlerts,
  currency,
  isLoading,
}: CategoryOverviewProps) {
  const { currency: settingsCurrency, hideAmountsOnOpen } = useSettingsStore()
  const resolvedCurrency = currency || settingsCurrency
  const budget = formatMoney(monthlyBudget, resolvedCurrency, hideAmountsOnOpen)

  return (
    <div className="mb-8">
      <StatGrid>
        <StatTile
          label="Total Categories"
          value={`${totalCategories}`}
          note="Active in your profile"
          icon={<Tag className="w-4 h-4 sm:w-5 sm:h-5" />}
          isLoading={isLoading}
          tone="primary"
        />
        <StatTile
          label="Top Category"
          value={mostUsedCategory}
          note="By transaction count"
          icon={<PieChart className="w-4 h-4 sm:w-5 sm:h-5" />}
          isLoading={isLoading}
          tone="accent"
        />
        <StatTile
          label="Total Budget"
          value={budget}
          note="+5.2% from last month"
          icon={<TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />}
          isLoading={isLoading}
          tone="success"
        />
        <StatTile
          label="Budget Alerts"
          value={`${budgetAlerts}`}
          note="Categories over budget"
          icon={<AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />}
          isLoading={isLoading}
          tone="destructive"
        />
      </StatGrid>
    </div>
  )
}
