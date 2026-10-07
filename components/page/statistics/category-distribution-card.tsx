'use client'

import { EmptyState } from '@/components/peacock-mascot'
import { useMemo } from 'react'
import { ChartPie, Layers3 } from 'lucide-react'
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
} from 'recharts'
import { useTopCategories } from '@/queries/user/transaction/transaction'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { getCategoryTotal, normalizeCategoryData, type CategoryDatum } from './statistics-utils'

type StatisticsProps = {
  period: 'today' | 'week' | 'month' | 'year' | 'all'
  walletId?: string
  offset?: number
}

function CategoryTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null

  const { currency, hideAmountsOnOpen } = useSettingsStore.getState()
  const item = payload[0]?.payload as CategoryDatum | undefined

  if (!item) return null

  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-ios-lg">
      <p className="font-semibold text-foreground">{item.name}</p>
      <p className="text-muted-foreground">
        {formatMoney(item.amount, currency, hideAmountsOnOpen)} · {item.percentage.toFixed(1)}%
      </p>
    </div>
  )
}

export function CategoryDistributionCard({ period, walletId, offset = 0 }: StatisticsProps) {
  const { data: topCategoriesResponse, isLoading } = useTopCategories({ period, walletId, offset, type: 'expense' })
  const { hideAmountsOnOpen, currency } = useSettingsStore()

  const categories = useMemo(() => normalizeCategoryData(topCategoriesResponse?.data), [topCategoriesResponse])
  const total = useMemo(() => getCategoryTotal(categories), [categories])

  const chartData = categories.length > 0 ? categories : []

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-ios flex flex-col self-start">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="font-semibold text-foreground">Category Mix</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Top spending categories for the selected period</p>
        </div>
        <div className="rounded-lg bg-secondary/70 p-2 text-muted-foreground">
          <ChartPie className="w-4 h-4" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 min-h-[280px] rounded-lg bg-secondary animate-pulse" />
      ) : chartData.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,260px)_minmax(240px,1fr)] items-start">
          <div className="relative h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip content={<CategoryTooltip />} />
                <Pie
                  data={chartData}
                  dataKey="amount"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={86}
                  paddingAngle={3}
                  stroke="transparent"
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.id} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3">
            {chartData.slice(0, 5).map((category, index) => (
              <div key={category.id} className="rounded-xl border border-border bg-secondary/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: category.color }} />
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold leading-snug text-foreground">{category.name}</p>
                      <p className="text-xs text-muted-foreground">Rank {index + 1}</p>
                    </div>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="break-words text-sm font-bold leading-snug text-foreground">{formatMoney(category.amount, currency, hideAmountsOnOpen)}</p>
                    <p className="text-xs text-muted-foreground">{category.percentage.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            ))}

            <div className="rounded-xl border border-dashed border-border px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
              <Layers3 className="w-4 h-4" />
              <span>{chartData.length} categories in the breakdown</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-secondary/20 px-6 py-10 text-center">
          <EmptyState
            compact
            pose="advisor"
            title="No category data yet"
            description="Add more transactions to build a richer category split."
          />
        </div>
      )}
    </div>
  )
}
