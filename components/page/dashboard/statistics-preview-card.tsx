'use client'

import { EmptyState } from '@/components/peacock-mascot'
import { useMemo } from 'react'
import { ChartPie, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTopCategories } from '@/queries/user/transaction/transaction'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { getCategoryTotal, normalizeCategoryData } from '../statistics/statistics-utils'

type PreviewProps = {
  period: 'today' | 'week' | 'month' | 'year' | 'all'
  walletId?: string
}

export function StatisticsPreviewCard({ period, walletId }: PreviewProps) {
  const { data: topCategoriesResponse, isLoading } = useTopCategories({ period, walletId, type: 'expense' })
  const { currency, hideAmountsOnOpen } = useSettingsStore()

  const categories = useMemo(() => normalizeCategoryData(topCategoriesResponse?.data).slice(0, 3), [topCategoriesResponse])
  const total = useMemo(() => getCategoryTotal(categories), [categories])

  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-ios sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className="rounded-2xl bg-primary/10 p-3 text-primary shrink-0">
            <ChartPie className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Statistics Preview</p>
            <h3 className="mt-1 text-base font-semibold text-foreground">See your top spending categories at a glance</h3>
            <p className="mt-1 text-sm text-muted-foreground">A compact preview of the largest categories for the selected period.</p>
          </div>
        </div>

        <Link
          to="/statistics"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          View full statistics
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Top categories</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {isLoading ? (
              [...Array(3)].map((_, index) => (
                <div key={index} className="h-16 rounded-xl bg-secondary animate-pulse" />
              ))
            ) : categories.length > 0 ? (
              categories.map((category) => (
                <div key={category.id} className="rounded-xl border border-border bg-secondary/20 px-3 py-2.5">
                  <p className="truncate text-sm font-semibold text-foreground">{category.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatMoney(category.amount, currency, hideAmountsOnOpen)}</p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-border px-3 py-4 sm:col-span-3">
                <EmptyState compact pose="advisor" title="No category data yet" />
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-secondary/20 px-4 py-3 text-right">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Preview total</p>
          <p className="mt-1 text-lg font-black text-foreground">{formatMoney(total, currency, hideAmountsOnOpen)}</p>
        </div>
      </div>
    </div>
  )
}
