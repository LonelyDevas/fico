'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, LineChart, Wallet } from 'lucide-react'
import { IonContent, IonPage } from '@ionic/react'
import { Link, useHistory, useLocation } from 'react-router-dom'
import { useListWallets } from '@/queries/user/wallet/wallets'
import { SpendingChart, PeriodSummaryCard } from '@/components/page/dashboard/spending-chart'
import { CategoryDistributionCard } from '@/components/page/statistics/category-distribution-card'
import { INSIGHT_SECTIONS, InsightSectionBlock, PlansOverview } from '@/components/page/statistics/plans-overview'
import { SafeToSpendBody } from '@/components/page/home/safe-to-spend-card'
import { useSafeToSpendInputs } from '@/hooks/use-safe-to-spend'
import { useTopCategories, useQuickStats } from '@/queries/user/transaction/transaction'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { safeToSpend } from '@/utils/safe-to-spend'
import { describePeriod, isShiftablePeriod } from '@/queries/user/transaction/period-range'
import { Skeleton } from '@/components/ui/skeleton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type PeriodType = 'today' | 'week' | 'month' | 'year' | 'all'

const PERIODS: { label: string; value: PeriodType }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Year', value: 'year' },
  { label: 'All', value: 'all' },
]

/** Section ids that other pages link to, mapped to the section that holds them. */
const ANCHOR_SECTION: Record<string, string> = {
  'money-total': 'money',
  wishlist: 'money',
  'bills-total': 'bills',
  planned: 'bills',
  'goals-total': 'goals',
  'debts-total': 'debts',
  investments: 'debts',
  categories: 'spending',
}

function Tile({ label, value, loading, tone }: { label: string; value: string; loading?: boolean; tone?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card px-4 py-3 shadow-ios">
      <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      {loading ? <Skeleton className="mt-2 h-6 w-24" /> : <p className={cn('mt-1 truncate text-lg font-semibold tabular-nums', tone ?? 'text-foreground')}>{value}</p>}
    </div>
  )
}

/**
 * Insights (route /statistics): every figure that used to sit in an overview card, in one place.
 * Spending follows the period picker; the other sections show where things stand now. Chips at the
 * top jump to a section, and other pages link straight to one, e.g. /statistics#debts.
 */
export default function StatisticsPage() {
  const history = useHistory()
  const location = useLocation()
  const [period, setPeriodState] = useState<PeriodType>('month')
  // 0 = current period, -1 = the one before, and so on without limit.
  const [offset, setOffset] = useState(0)
  const setPeriod = (next: PeriodType) => {
    setPeriodState(next)
    setOffset(0)
  }
  const canStep = isShiftablePeriod(period)
  const [walletId, setWalletId] = useState<string>('')
  const [walletsOpen, setWalletsOpen] = useState(false)
  const { data: walletsResponse } = useListWallets()
  const { currency, hideAmountsOnOpen } = useSettingsStore()
  const money = (n: number) => formatMoney(n, currency, hideAmountsOnOpen)

  const { data: topCategoriesResponse, isLoading: topLoading } = useTopCategories({ period, offset, walletId: walletId || undefined, type: 'expense' })
  const { data: quickStatsResponse, isLoading: statsLoading } = useQuickStats({ period, offset, walletId: walletId || undefined })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wallets: any[] = (Array.isArray(walletsResponse?.data) ? walletsResponse.data : walletsResponse?.data?.items || []).filter((w: any) => w.status !== 'archived')
  const walletName = wallets.find((w) => (w._id || w.id) === walletId)?.name

  const top = useMemo(() => {
    const breakdown = topCategoriesResponse?.data?.breakdown
    const first = Array.isArray(breakdown) ? breakdown[0] : null
    return {
      count: Number(topCategoriesResponse?.data?.transactionCount ?? 0),
      name: first?.categoryName ?? 'None yet',
      amount: Number(first?.total ?? 0),
    }
  }, [topCategoriesResponse])
  const quick = quickStatsResponse?.data || {}
  const spent = Number(quick.expenses ?? 0)
  const income = Number(quick.income ?? 0)

  // Forecast: the same safe-to-spend figure as Home.
  const backendHasBills = process.env.NEXT_PUBLIC_BACKEND === 'supabase'
  const { inputs: safeInputs, loading: safeLoading, wallets: safeWallets } = useSafeToSpendInputs()
  const safeResult = useMemo(() => (safeInputs ? safeToSpend(safeInputs) : null), [safeInputs])

  // Jump to the section in the address (#bills), once on arrival and whenever it changes.
  const [active, setActive] = useState('spending')
  const chipsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const hash = decodeURIComponent(location.hash.replace(/^#/, ''))
    if (!hash) return
    const timer = setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActive(ANCHOR_SECTION[hash] ?? hash)
    }, 150)
    return () => clearTimeout(timer)
  }, [location.hash])

  const jump = (id: string) => {
    setActive(id)
    history.replace({ ...location, hash: `#${id}` })
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Highlight the section being read while scrolling.
  useEffect(() => {
    const sections = INSIGHT_SECTIONS.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => !!el)
    if (typeof IntersectionObserver === 'undefined' || sections.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible) setActive(visible.target.id)
      },
      { rootMargin: '-120px 0px -55% 0px' }
    )
    sections.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  // Keep the active chip in view as it changes.
  useEffect(() => {
    chipsRef.current?.querySelector<HTMLElement>(`[data-chip="${active}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [active])

  return (
    <IonPage>
      <IonContent className="bg-background text-foreground transition-colors duration-300">
        <main className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Your numbers</p>
            <h1 className="mt-1 font-heading text-2xl font-semibold leading-tight text-foreground sm:text-3xl">Insights</h1>
            <p className="mt-1 text-sm text-muted-foreground">Spending, money, bills, goals and debts in one place.</p>
          </div>

          <nav
            ref={chipsRef}
            aria-label="Insights sections"
            className="sticky top-0 z-20 -mx-4 mt-4 flex gap-2 overflow-x-auto bg-background/90 px-4 py-2 backdrop-blur [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
          >
            {INSIGHT_SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                data-chip={s.id}
                onClick={() => jump(s.id)}
                className={cn(
                  'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                  active === s.id ? 'bg-primary text-primary-foreground shadow-ios' : 'bg-secondary text-foreground hover:bg-secondary/70'
                )}
              >
                {s.label}
              </button>
            ))}
          </nav>

          <div className="mt-4 space-y-8">
            <InsightSectionBlock id="spending" title="Spending" hint={walletName ? `In ${walletName} only` : 'Across all your wallets'}>
              <div className="mb-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div role="radiogroup" aria-label="Period" className="flex min-w-0 flex-1 gap-1 rounded-full bg-secondary p-1">
                    {PERIODS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        role="radio"
                        aria-checked={period === p.value}
                        onClick={() => setPeriod(p.value)}
                        className={cn(
                          'min-w-0 flex-1 rounded-full px-2 py-1.5 text-xs font-semibold transition-colors sm:text-sm',
                          period === p.value ? 'bg-card text-foreground shadow-ios' : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  {wallets.length > 0 && (
                    <Popover open={walletsOpen} onOpenChange={setWalletsOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label="Choose wallet"
                          className={cn(
                            'flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors',
                            walletId ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-card text-foreground'
                          )}
                        >
                          <Wallet className="h-4 w-4" />
                          <span className="max-w-[7rem] truncate">{walletName ?? 'All'}</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-60 p-2">
                        {[{ id: '', name: 'All wallets' }, ...wallets.map((w) => ({ id: w._id || w.id, name: w.name }))].map((w) => (
                          <button
                            key={w.id || 'all'}
                            type="button"
                            onClick={() => {
                              setWalletId(w.id)
                              setWalletsOpen(false)
                            }}
                            className={cn(
                              'flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition-colors',
                              walletId === w.id ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-secondary'
                            )}
                          >
                            {w.name}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>
                  )}
                </div>

                {canStep && (
                  <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card px-2 py-1.5">
                    <button type="button" onClick={() => setOffset((o) => o - 1)} aria-label="Previous period" className="rounded-full p-2 text-foreground hover:bg-secondary">
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div className="min-w-0 text-center">
                      <p className="truncate text-sm font-semibold text-foreground">{describePeriod(period, offset)}</p>
                      {offset !== 0 && (
                        <button type="button" onClick={() => setOffset(0)} className="text-xs font-medium text-primary hover:underline">
                          Back to current
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setOffset((o) => Math.min(0, o + 1))}
                      disabled={offset === 0}
                      aria-label="Next period"
                      className="rounded-full p-2 text-foreground hover:bg-secondary disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Tile label="Spent" value={money(spent)} loading={statsLoading} />
                <Tile label="Came in" value={money(income)} loading={statsLoading} tone="text-success" />
                <Tile label="Top category" value={top.name} loading={topLoading} />
                <Tile label="Transactions" value={String(top.count)} loading={topLoading} />
              </div>

              <div id="categories" className="grid scroll-mt-28 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
                <CategoryDistributionCard period={period} offset={offset} walletId={walletId || undefined} />
                <PeriodSummaryCard period={period} offset={offset} walletId={walletId || undefined} />
              </div>
              <div className="mt-4 min-h-[280px]">
                <SpendingChart period={period} offset={offset} walletId={walletId || undefined} />
              </div>
            </InsightSectionBlock>

            <PlansOverview />

            <InsightSectionBlock id="forecast" title="Forecast" hint="What you can spend until payday, after bills and what you keep aside.">
              {backendHasBills && (
                <div className="rounded-2xl border border-border bg-card p-4 shadow-ios">
                  <SafeToSpendBody result={safeResult} loading={safeLoading} money={money} spentToday={safeInputs?.spentToday ?? 0} wallets={safeWallets} />
                </div>
              )}
              <Link
                to="/forecast"
                className="mt-3 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-ios transition-colors hover:border-primary/40"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <LineChart className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">Open the forecast</span>
                  <span className="block text-xs text-muted-foreground">Your balance over the coming weeks, with a what-if slider.</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </InsightSectionBlock>
          </div>
        </main>
      </IonContent>
    </IonPage>
  )
}
