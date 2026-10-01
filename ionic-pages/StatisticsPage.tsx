'use client'

import { useState } from 'react'
import { Check, ChevronLeft, ChartPie, TrendingDown, Banknote } from 'lucide-react'
import { IonContent, IonPage } from '@ionic/react'
import { useHistory } from 'react-router-dom'
import { useMemo } from 'react'
import { useListWallets } from '@/queries/user/wallet/wallets'
import { SpendingChart, PeriodSummaryCard } from '@/components/page/dashboard/spending-chart'
import { CategoryDistributionCard } from '@/components/page/statistics/category-distribution-card'
import { useTopCategories, useQuickStats } from '@/queries/user/transaction/transaction'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type PeriodType = 'today' | 'week' | 'month' | 'year' | 'all'

export default function StatisticsPage() {
  const history = useHistory()
  const [period, setPeriod] = useState<PeriodType>('month')
  const [walletId, setWalletId] = useState<string>('')
  const { data: walletsResponse } = useListWallets()
  const { currency, hideAmountsOnOpen } = useSettingsStore()

  const { data: topCategoriesResponse } = useTopCategories({ period, walletId: walletId || undefined, type: 'expense' })
  const { data: quickStatsResponse } = useQuickStats({ period, walletId: walletId || undefined })

  const periodOptions: { label: string; value: PeriodType }[] = [
    { label: 'Today', value: 'today' },
    { label: 'Week', value: 'week' },
    { label: 'Month', value: 'month' },
    { label: 'Year', value: 'year' },
    { label: 'All Time', value: 'all' },
  ]

  const wallets = Array.isArray(walletsResponse?.data) ? walletsResponse.data : walletsResponse?.data?.items || []

  const categorySummary = useMemo(() => {
    const breakdown = topCategoriesResponse?.data?.breakdown
    if (!Array.isArray(breakdown) || breakdown.length === 0) {
      return { totalAmount: 0, transactionCount: 0, topCategoryName: 'No category yet', topCategoryAmount: 0 }
    }

    const topCategory = breakdown[0]
    return {
      totalAmount: Number(topCategoriesResponse?.data?.totalAmount ?? 0),
      transactionCount: Number(topCategoriesResponse?.data?.transactionCount ?? 0),
      topCategoryName: topCategory?.categoryName ?? 'No category yet',
      topCategoryAmount: Number(topCategory?.total ?? 0),
    }
  }, [topCategoriesResponse])

  const quickStats = quickStatsResponse?.data || {}
  const expenseValue = Number(quickStats.expenses ?? 0)
  const incomeValue = Number(quickStats.income ?? 0)
  const transferValue = Number(quickStats.transfers ?? 0)

  return (
    <IonPage>
      <IonContent className="bg-background text-foreground transition-colors duration-300">
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <section className="mb-8 rounded-3xl border border-border bg-gradient-to-br from-card via-card to-secondary/40 p-5 sm:p-7 shadow-ios">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
              <div className="space-y-3 lg:self-start">
                <Button variant="outline" size="sm" onClick={() => history.push('/dashboard')} className="gap-2 rounded-full">
                  <ChevronLeft className="w-4 h-4" />
                  Back to dashboard
                </Button>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Analytics</p>
                  <h1 className="mt-2 text-3xl font-black text-foreground sm:text-4xl">Statistics</h1>
                  <p className="mt-2 max-w-2xl text-muted-foreground">
                    Focused spending analysis for the selected period, built around category mix instead of the dashboard overview.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:self-start">
                <div className="min-w-0 rounded-2xl border border-border bg-background/70 px-4 py-3 shadow-ios">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Total Amount</p>
                  <p className="mt-2 break-words text-base font-black leading-tight text-foreground sm:text-lg">{formatMoney(categorySummary.totalAmount, currency, hideAmountsOnOpen)}</p>
                </div>
                <div className="min-w-0 rounded-2xl border border-border bg-background/70 px-4 py-3 shadow-ios">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Transactions</p>
                  <p className="mt-2 break-words text-base font-black leading-tight text-foreground sm:text-lg">{categorySummary.transactionCount}</p>
                </div>
                <div className="min-w-0 rounded-2xl border border-border bg-background/70 px-4 py-3 shadow-ios">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Top Category</p>
                  <p className="mt-2 break-words text-base font-black leading-tight text-foreground sm:text-lg">{categorySummary.topCategoryName}</p>
                </div>
                <div className="min-w-0 rounded-2xl border border-border bg-background/70 px-4 py-3 shadow-ios">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Top Share</p>
                  <p className="mt-2 break-words text-base font-black leading-tight text-foreground sm:text-lg">{formatMoney(categorySummary.topCategoryAmount, currency, hideAmountsOnOpen)}</p>
                </div>
              </div>
            </div>
          </section>

          <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ChartPie className="w-4 h-4" />
              Category-focused analytics
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <button className="flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-foreground/50">
                  <span className="text-muted-foreground">Filters</span>
                  {walletId && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span className="font-semibold">{wallets.find((wallet: any) => (wallet._id || wallet.id) === walletId)?.name}</span>
                    </>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-4">
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Period</p>
                    <div className="space-y-1">
                      {periodOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setPeriod(option.value)}
                          className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm transition-colors hover:bg-secondary"
                        >
                          <span>{option.label}</span>
                          {period === option.value && <Check className="w-4 h-4 text-success" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {wallets.length > 0 && (
                    <>
                      <div className="border-t border-border" />
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Wallet</p>
                        <div className="space-y-1">
                          <button
                            onClick={() => setWalletId('')}
                            className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm transition-colors hover:bg-secondary"
                          >
                            <span>All Wallets</span>
                            {!walletId && <Check className="w-4 h-4 text-success" />}
                          </button>
                          {wallets
                            .filter((wallet: any) => wallet.status !== 'archived')
                            .map((wallet: any) => (
                              <button
                                key={wallet._id || wallet.id}
                                onClick={() => setWalletId(wallet._id || wallet.id)}
                                className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm transition-colors hover:bg-secondary"
                              >
                                <span>{wallet.name}</span>
                                {walletId === (wallet._id || wallet.id) && <Check className="w-4 h-4 text-success" />}
                              </button>
                            ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
            <CategoryDistributionCard period={period} walletId={walletId || undefined} />

            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingDown className="w-4 h-4 text-destructive" />
                  <h2 className="font-semibold text-foreground">Period Snapshot</h2>
                </div>
                <div className="space-y-3">
                  <div className="rounded-xl border border-border bg-secondary/20 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Top Category</p>
                    <div className="mt-2 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-base font-bold text-foreground">{categorySummary.topCategoryName}</p>
                        <p className="text-xs text-muted-foreground">Largest share in the selected period</p>
                      </div>
                      <p className="text-sm font-bold text-foreground">{formatMoney(categorySummary.topCategoryAmount, currency, hideAmountsOnOpen)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-secondary/30 px-4 py-3">
                    <span className="text-sm text-muted-foreground">Expenses</span>
                    <span className="text-sm font-bold text-foreground">{formatMoney(expenseValue, currency, hideAmountsOnOpen)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-secondary/30 px-4 py-3">
                    <span className="text-sm text-muted-foreground">Income</span>
                    <span className="text-sm font-bold text-foreground">{formatMoney(incomeValue, currency, hideAmountsOnOpen)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-secondary/30 px-4 py-3">
                    <span className="text-sm text-muted-foreground">Transfers</span>
                    <span className="text-sm font-bold text-foreground">{formatMoney(transferValue, currency, hideAmountsOnOpen)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-secondary/30 px-4 py-3">
                    <span className="text-sm text-muted-foreground">Transactions</span>
                    <span className="text-sm font-bold text-foreground">{categorySummary.transactionCount}</span>
                  </div>
                </div>
              </div>

              {/* <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Banknote className="w-4 h-4 text-success" />
                  <h2 className="font-semibold text-foreground">Category Notes</h2>
                </div>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>The chart below is driven by category breakdown data, not the dashboard summary cards.</p>
                  <p>Use the filter controls to switch period or wallet and compare how the mix changes.</p>
                  <p>If the pie chart is empty, the response for the selected filters has no `breakdown` rows yet.</p>
                </div>
              </div> */}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 min-h-[280px]">
              <SpendingChart period={period} walletId={walletId || undefined} />
            </div>
            <div className="lg:col-span-1">
              <PeriodSummaryCard period={period} walletId={walletId || undefined} />
            </div>
          </div>
        </main>
      </IonContent>
    </IonPage>
  )
}
