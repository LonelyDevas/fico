'use client'

import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { IonPage, IonContent } from '@ionic/react'
import { addDays, differenceInCalendarDays, format, parseISO, subDays } from 'date-fns'
import { ArrowDownLeft, ArrowUpRight, BarChart3, ChevronRight, CreditCard, PieChart, Plus, SlidersHorizontal, Tag, type LucideIcon } from 'lucide-react'
import { EmptyState } from '@/components/peacock-mascot'
import { FicoBalanceCard, PERIODS, type Period } from '@/components/page/home/fico-balance-card'
import { useUser } from '@/store/auth-store'
import { useSettingsStore } from '@/store/settings-store'
import { useListWallets } from '@/queries/user/wallet/wallets'
import { useListTransactions, useQuickStats, useTopCategories } from '@/queries/user/transaction/transaction'
import { useBillCalendar } from '@/queries/user/bill/bills'
import { useListObligations } from '@/queries/user/obligation/obligations'
import { useListInvestments } from '@/queries/user/investment/investments'
import { useLiveHoldings } from '@/queries/crypto/prices'
import { coinLabel } from '@/utils/crypto-prices'
import type { Investment } from '@/types/investment'
import { resolveOrder, useHomeWidgets, type WidgetId } from '@/store/home-widgets-store'
import { CustomizeWidgetsSheet } from '@/components/page/home/customize-widgets-sheet'
import { getCategoryTotal, normalizeCategoryData } from '@/components/page/statistics/statistics-utils'
import { formatMoney } from '@/utils/formatter'
import { Skeleton } from '@/components/ui/skeleton'

const SHORTCUTS: { label: string; hint: string; href: string; icon: LucideIcon }[] = [
  { label: 'Budgets', hint: 'Set spending limits', href: '/budgets', icon: PieChart },
  { label: 'Bills', hint: 'See what is due', href: '/bills', icon: CreditCard },
  { label: 'Statistics', hint: 'Charts and trends', href: '/statistics', icon: BarChart3 },
  { label: 'Categories', hint: 'Organize spending', href: '/categories', icon: Tag },
]

const greetingFor = (date: Date) => {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

const asList = (data: any, keys: string[] = ['items']): any[] => {
  if (Array.isArray(data)) return data
  for (const key of keys) if (Array.isArray(data?.[key])) return data[key]
  return []
}

function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <section className={`rounded-3xl border border-border bg-card p-4 shadow-ios sm:p-5 ${className}`}>{children}</section>
}

function CardHeader({ title, to, linkLabel }: { title: string; to?: string; linkLabel?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-heading text-base font-semibold text-foreground">{title}</h2>
      {to && (
        <Link to={to} className="flex items-center gap-0.5 text-sm font-semibold text-primary hover:underline">
          {linkLabel ?? 'See all'}
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>('month')
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const user = useUser()
  const { currency, hideAmountsOnOpen } = useSettingsStore()
  const [showAmounts, setShowAmounts] = useState(!hideAmountsOnOpen)
  const money = (value: number) => formatMoney(value, currency, !showAmounts)

  const { data: walletsResponse, isLoading: walletsLoading } = useListWallets()
  const { data: statsResponse, isLoading: statsLoading } = useQuickStats({ period })
  const { data: categoriesResponse, isLoading: categoriesLoading } = useTopCategories({ period, type: 'expense' })
  const { data: obligationsResponse, isLoading: obligationsLoading } = useListObligations({ limit: '100', direction: 'lending' })
  const { data: transactionsResponse, isLoading: transactionsLoading } = useListTransactions({ limit: '5' })

  const today = useMemo(() => new Date(), [])
  const { data: billsResponse, isLoading: billsLoading } = useBillCalendar({
    startDate: format(subDays(today, 30), 'yyyy-MM-dd'),
    endDate: format(addDays(today, 14), 'yyyy-MM-dd'),
  })

  const firstName = user?.firstName || (user?.username || user?.email?.split('@')[0] || 'there').split(/[\s._-]/)[0]
  const periodPhrase = PERIODS.find((p) => p.value === period)?.phrase ?? 'this month'

  const wallets = useMemo(
    () =>
      asList(walletsResponse?.data, ['items', 'wallets'])
        .filter((w: any) => w.status !== 'archived')
        .map((w: any, index: number) => ({
          id: String(w._id ?? w.id ?? `wallet-${index}`),
          name: String(w.name ?? 'Wallet'),
          balance: Number(w.balance ?? w.currentBalance ?? 0),
          isCard: w.type === 'credit_card',
        })),
    [walletsResponse]
  )
  // A credit card's balance is what you owe, so it reduces the total instead of adding to it.
  const totalBalance = wallets.reduce((sum, w) => sum + (w.isCard ? -w.balance : w.balance), 0)

  // Quick stats come back flat ({ income, expenses, transfers, transactions }).
  const stats = (statsResponse?.data as any) ?? {}
  const income = Number(stats.income ?? 0)
  const expenses = Number(stats.expenses ?? 0)

  const categories = useMemo(() => normalizeCategoryData(categoriesResponse?.data).slice(0, 4), [categoriesResponse])
  const categoryTotal = useMemo(() => getCategoryTotal(categories), [categories])

  const insight = ((statsResponse?.data as any)?.topCategory as any)?.insight as string | undefined
  const note = useMemo(() => {
    if (insight) return insight
    if (categories.length > 0 && categoryTotal > 0) {
      const top = categories[0]
      const share = Math.round((top.amount / categoryTotal) * 100)
      return `Most of your spending ${periodPhrase} went to ${top.name}, about ${share}% of the total.`
    }
    return 'Add your first transaction and I will start spotting patterns for you.'
  }, [insight, categories, categoryTotal, periodPhrase])

  const transactions = useMemo(
    () =>
      asList(transactionsResponse?.data, ['items', 'transactions']).map((t: any, index: number) => ({
        id: String(t._id ?? t.id ?? `transaction-${index}`),
        title: String(t.title || t.description || 'Transaction'),
        date: new Date(t.date || t.createdAt || Date.now()),
        amount: Number(t.amount) || 0,
        type: (t.type === 'income' ? 'income' : 'expense') as 'income' | 'expense',
      })),
    [transactionsResponse]
  )

  const dueBills = useMemo(() => {
    const events = (billsResponse?.data as any)?.calendarEvents
    if (!events || typeof events !== 'object') return []
    return Object.entries(events)
      .flatMap(([dateKey, bills]) =>
        Array.isArray(bills)
          ? bills.map((bill: any, index: number) => ({
              id: String(bill._id ?? bill.id ?? `${dateKey}-${index}`),
              name: String(bill.name || 'Bill'),
              amount: Number(bill.amount || 0),
              due: parseISO(dateKey),
              paid: String(bill.paymentStatus || bill.status || '').toLowerCase() === 'paid',
            }))
          : []
      )
      .filter((bill) => !bill.paid)
      .sort((a, b) => a.due.getTime() - b.due.getTime())
      .slice(0, 4)
  }, [billsResponse])

  const owedPeople = useMemo(() => {
    const list: any[] = asList(obligationsResponse?.data, ['items', 'obligations'])
    const byPerson = new Map<string, { name: string; remaining: number }>()
    for (const o of list) {
      if (o.direction !== 'lending' || o.status === 'settled' || o.status === 'archived') continue
      const name = String(o.counterparty || 'Unknown').trim() || 'Unknown'
      const entry = byPerson.get(name.toLowerCase()) ?? { name, remaining: 0 }
      entry.remaining += Number(o.remainingBalance) || 0
      byPerson.set(name.toLowerCase(), entry)
    }
    return [...byPerson.values()].filter((p) => p.remaining > 0).sort((a, b) => b.remaining - a.remaining)
  }, [obligationsResponse])
  const owedTotal = owedPeople.reduce((sum, p) => sum + p.remaining, 0)

  const { data: investmentsResponse } = useListInvestments({ limit: '100' })
  const investments = useMemo(() => {
    const data = investmentsResponse?.data as any
    const list: any[] = Array.isArray(data) ? data : data?.items ?? []
    return list.map((i) => ({ ...i, id: String(i._id ?? i.id) })) as Investment[]
  }, [investmentsResponse])
  const { holdings: coinHoldings, liveById: coinLive, loading: coinsLoading } = useLiveHoldings(investments)
  const coinTotal = coinHoldings.reduce((sum, h) => sum + (coinLive[h.id]?.value ?? Number(h.currentValue) ?? 0), 0)

  const widgetNodes: Record<WidgetId, React.ReactNode> = {
    yourMoney: (
                    <Card className="order-3 lg:order-none">
                <CardHeader title="Your money" to="/wallets" linkLabel="Open" />
                <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
                  {walletsLoading &&
                    [0, 1, 2].map((i) => <Skeleton key={i} className="h-[4.25rem] min-w-[9.5rem] shrink-0 rounded-2xl" />)}
                  {wallets.map((wallet) => (
                    <Link
                      key={wallet.id}
                      to="/wallets"
                      className="min-w-[9.5rem] shrink-0 snap-start rounded-2xl border border-border bg-secondary/40 p-3 transition-colors hover:border-primary/50"
                    >
                      <span className="block truncate text-xs font-medium text-muted-foreground">{wallet.name}</span>
                      <span className="mt-1 block text-lg font-semibold tabular-nums text-foreground">
                        {wallet.isCard ? `-${money(wallet.balance)}` : money(wallet.balance)}
                      </span>
                    </Link>
                  ))}
                  {!walletsLoading && (
                  <Link
                    to="/wallets"
                    className="flex min-w-[9.5rem] shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border p-3 text-sm font-semibold text-primary hover:bg-primary/5"
                  >
                    <Plus className="h-5 w-5" />
                    New wallet
                  </Link>
                  )}
                </div>
              </Card>
    ),
    whereItWent: (
                    <Card className="order-4 lg:order-none">
                <CardHeader title={`Where it went ${periodPhrase}`} to="/statistics" linkLabel="Details" />
                {categoriesLoading ? (
                  <Skeleton className="h-24 rounded-2xl" />
                ) : categories.length > 0 ? (
                  <>
                    <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Spending split by category">
                      {categories.map((c) => (
                        <span
                          key={c.id}
                          style={{ width: `${Math.max((c.amount / categoryTotal) * 100, 3)}%`, backgroundColor: c.color }}
                        />
                      ))}
                    </div>
                    <ul className="mt-4 space-y-2.5">
                      {categories.map((c) => (
                        <li key={c.id} className="flex items-center gap-3 text-sm">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                          <span className="min-w-0 flex-1 truncate font-medium text-foreground">{c.name}</span>
                          <span className="tabular-nums text-muted-foreground">{Math.round((c.amount / categoryTotal) * 100)}%</span>
                          <span className="w-24 text-right font-semibold tabular-nums text-foreground">{money(c.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <EmptyState compact pose="advisor" title="No spending yet" description="Add an expense and it will show up here." />
                )}
              </Card>
    ),
    comingUp: (
                    <Card className="order-5 lg:order-none">
                <CardHeader title="Coming up" to="/bills" linkLabel="All bills" />
                {billsLoading ? (
                  <Skeleton className="h-24 rounded-2xl" />
                ) : dueBills.length > 0 ? (
                  <ul className="space-y-2">
                    {dueBills.map((bill) => {
                      const days = differenceInCalendarDays(bill.due, today)
                      const overdue = days < 0
                      const when = overdue
                        ? `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`
                        : days === 0
                          ? 'Due today'
                          : `In ${days} day${days === 1 ? '' : 's'}`
                      return (
                        <li key={bill.id} className="flex items-center gap-3 rounded-2xl bg-secondary/40 p-2.5">
                          <span
                            className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl text-center leading-none ${
                              overdue ? 'bg-destructive/15 text-destructive' : 'bg-card text-foreground'
                            }`}
                          >
                            <span className="text-[10px] font-semibold uppercase">{format(bill.due, 'MMM')}</span>
                            <span className="mt-0.5 text-lg font-bold">{format(bill.due, 'd')}</span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-foreground">{bill.name}</span>
                            <span className={`block text-xs ${overdue ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>{when}</span>
                          </span>
                          <span className="text-sm font-semibold tabular-nums text-foreground">{money(bill.amount)}</span>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="py-4 text-center text-sm text-muted-foreground">Nothing due soon. Bills you add will show up here.</p>
                )}
              </Card>
    ),
    owedToYou: (
      <Card>
        <CardHeader title="Owed to you" to="/debts" linkLabel="Open" />
        {obligationsLoading ? (
          <Skeleton className="h-24 rounded-2xl" />
        ) : owedPeople.length > 0 ? (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              {owedPeople.length} {owedPeople.length === 1 ? 'person owes' : 'people owe'} you{' '}
              <span className="font-semibold text-foreground">{money(owedTotal)}</span>
            </p>
            <ul className="divide-y divide-border">
              {owedPeople.slice(0, 4).map((person) => (
                <li key={person.name} className="flex items-center gap-3 py-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {person.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{person.name}</span>
                  <span className="text-sm font-semibold tabular-nums text-foreground">{money(person.remaining)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">Nobody owes you right now.</p>
        )}
      </Card>
    ),
    crypto:
      coinHoldings.length === 0 ? null : (
        <Card>
          <CardHeader title="Crypto" to="/investments" linkLabel="Open" />
          {coinsLoading ? (
            <Skeleton className="h-24 rounded-2xl" />
          ) : (
            <>
              <p className="font-heading text-2xl font-bold tabular-nums text-foreground">{money(coinTotal)}</p>
              <ul className="mt-3 divide-y divide-border">
                {coinHoldings.map((h) => {
                  const live = coinLive[h.id]
                  return (
                    <li key={h.id} className="flex items-center gap-3 py-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                        {coinLabel(h.coinId, h.coinSymbol).slice(0, 4)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">{h.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {Number(h.quantity)} {coinLabel(h.coinId, h.coinSymbol)}
                          {live?.change24h != null && (
                            <span className={live.change24h >= 0 ? 'text-success' : 'text-destructive'}>
                              {' '}
                              · {live.change24h >= 0 ? '+' : ''}
                              {live.change24h.toFixed(2)}%
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-foreground">{money(live ? live.value : Number(h.currentValue) || 0)}</span>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </Card>
      ),
    latestActivity: (
                    <Card className="order-6 lg:order-none">
                <CardHeader title="Latest activity" to="/transactions" />
                {transactionsLoading ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map((i) => (
                      <Skeleton key={i} className="h-12 rounded-2xl" />
                    ))}
                  </div>
                ) : transactions.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {transactions.map((t) => (
                      <li key={t.id} className="flex items-center gap-3 py-3">
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                            t.type === 'income' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'
                          }`}
                        >
                          {t.type === 'income' ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-foreground">{t.title}</span>
                          <span className="block text-xs text-muted-foreground">{format(t.date, 'MMM d')}</span>
                        </span>
                        <span className={`text-sm font-semibold tabular-nums ${t.type === 'income' ? 'text-success' : 'text-foreground'}`}>
                          {t.type === 'income' ? '+' : '-'}
                          {money(t.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-4 text-center text-sm text-muted-foreground">No activity yet. Tap + to add your first transaction.</p>
                )}
              </Card>
    ),
    quickActions: (
                    <Card className="hidden lg:block">
                <CardHeader title="Quick actions" />
                <div className="grid grid-cols-2 gap-3">
                  {SHORTCUTS.map(({ label, hint, href, icon: Icon }) => (
                    <Link
                      key={href}
                      to={href}
                      className="group flex items-center gap-3 rounded-2xl border border-border bg-secondary/40 p-3 transition-colors hover:border-primary/50 hover:bg-primary/5"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-foreground">{label}</span>
                        <span className="block truncate text-xs text-muted-foreground">{hint}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </Card>
    ),
  }

  const { order, hidden } = useHomeWidgets()
  const visibleWidgets = resolveOrder(order).filter((id) => !hidden.includes(id))

  return (
    <IonPage>
      <IonContent className="bg-background text-foreground">
        <main className="mx-auto max-w-7xl px-4 pb-10 pt-5 sm:px-6 lg:px-8">
          {/* Greeting */}
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {format(today, 'EEEE, MMMM d')}
            </p>
            <h1 className="mt-1 font-heading text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
              {greetingFor(today)}, <span className="text-primary">{firstName}</span>
            </h1>
          </div>

          <div className="mt-5">
            {/* Fico + balance */}
            <div>
              <FicoBalanceCard
                  note={note}
                  balance={money(totalBalance)}
                  income={money(income)}
                  expenses={money(expenses)}
                  statsLoading={statsLoading}
                  balanceLoading={walletsLoading}
                  noteLoading={statsLoading || categoriesLoading}
                  period={period}
                  onPeriodChange={setPeriod}
                  showAmounts={showAmounts}
                  onToggleAmounts={() => setShowAmounts((v) => !v)}
                />
              <nav aria-label="Shortcuts" className="-mx-1 mt-3 flex gap-2 lg:hidden overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {SHORTCUTS.map(({ label, href, icon: Icon }) => (
                    <Link
                      key={href}
                      to={href}
                      className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-ios transition-colors hover:border-primary/50"
                    >
                      <Icon className="h-4 w-4 text-primary" />
                      {label}
                    </Link>
                  ))}
                </nav>
            </div>

            <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[repeat(2,minmax(0,1fr))] lg:items-start">
              {visibleWidgets.map((id) => (
                <Fragment key={id}>{widgetNodes[id]}</Fragment>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setCustomizeOpen(true)}
              className="mx-auto mt-5 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-muted-foreground shadow-ios transition-colors hover:text-foreground"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Customize Home
            </button>
          </div>
        </main>
      </IonContent>
      <CustomizeWidgetsSheet open={customizeOpen} onClose={() => setCustomizeOpen(false)} />
    </IonPage>
  )
}
