'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, History, TrendingUp, TriangleAlert } from 'lucide-react'
import { IonContent, IonPage } from '@ionic/react'
import { useHistory } from 'react-router-dom'
import { format, parseISO, subDays } from 'date-fns'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useAllWallets, useOpenBills, useTransactionsAfter } from '@/queries/user/forecast/forecast'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { balancesAt, buildForecast, typicalFlow } from '@/utils/forecast'

type Tab = 'forecast' | 'lookback'

const HORIZONS = [
  { label: '30 days', days: 30 },
  { label: '3 months', days: 90 },
  { label: '6 months', days: 180 },
  { label: '1 year', days: 365 },
]

const TYPICAL_WINDOW_DAYS = 90
const todayInput = () => format(new Date(), 'yyyy-MM-dd')

export default function ForecastPage() {
  const history = useHistory()
  const [tab, setTab] = useState<Tab>('forecast')

  return (
    <IonPage>
      <IonContent className="bg-background text-foreground transition-colors duration-300">
        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <Button variant="outline" size="sm" onClick={() => history.push('/manage')} className="mb-4 gap-2 rounded-full">
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Analytics</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Forecast</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            See where your cash is heading based on your bills, or look back at what a wallet held on any past date.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-1.5">
            {([
              { id: 'forecast', label: 'Future', icon: TrendingUp },
              { id: 'lookback', label: 'Look back', icon: History },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                  tab === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="mt-6">{tab === 'forecast' ? <FutureView /> : <LookBackView />}</div>
        </main>
      </IonContent>
    </IonPage>
  )
}

function LoadError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : (error as { message?: string })?.message
  return (
    <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
      {'Could not load this' + (message ? ': ' + message : '.')}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className={`mt-2 break-words text-base font-black leading-tight sm:text-lg ${tone ?? 'text-foreground'}`}>{value}</p>
    </div>
  )
}

function FutureView() {
  const { currency, hideAmountsOnOpen } = useSettingsStore()
  const money = (n: number) => formatMoney(n, currency, hideAmountsOnOpen)
  const [days, setDays] = useState(90)
  const [includeTypical, setIncludeTypical] = useState(true)

  const windowStart = useMemo(() => subDays(new Date(), TYPICAL_WINDOW_DAYS).toISOString(), [])
  const walletsQ = useAllWallets()
  const billsQ = useOpenBills()
  const recentQ = useTransactionsAfter(windowStart)
  const { data: wallets } = walletsQ
  const { data: bills } = billsQ
  const { data: recent } = recentQ
  const error = walletsQ.error || billsQ.error || recentQ.error

  const forecast = useMemo(() => {
    if (!wallets || !bills || !recent) return null
    const active = wallets.filter((w) => w.status !== 'archived')
    const cash = active.filter((w) => w.type !== 'credit_card')
    const walletTypes = Object.fromEntries(wallets.map((w) => [w.id, w.type]))
    return buildForecast({
      startingCash: cash.reduce((sum, w) => sum + Number(w.balance), 0),
      bills,
      walletTypes,
      horizonDays: days,
      typical: includeTypical ? typicalFlow(recent, new Set(cash.map((w) => w.id)), TYPICAL_WINDOW_DAYS) : undefined,
    })
  }, [wallets, bills, recent, days, includeTypical])

  if (error) return <LoadError error={error} />
  if (!forecast) return <Skeleton className="h-96 w-full rounded-2xl" />

  const change = forecast.endBalance - forecast.startBalance
  const upcoming = forecast.events.slice(0, 12)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {HORIZONS.map((h) => (
            <button
              key={h.days}
              type="button"
              onClick={() => setDays(h.days)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                days === h.days ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:border-foreground/50'
              }`}
            >
              {h.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Include everyday spending &amp; income
          <Switch checked={includeTypical} onCheckedChange={setIncludeTypical} />
        </label>
      </div>

      {forecast.shortfallDate && (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p>
            Your cash is projected to run out around <span className="font-semibold">{format(parseISO(forecast.shortfallDate), 'MMM d, yyyy')}</span>.
            Lowest point: {money(forecast.lowest.balance)} on {format(parseISO(forecast.lowest.date), 'MMM d')}.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Cash today" value={money(forecast.startBalance)} />
        <Stat
          label={`In ${HORIZONS.find((h) => h.days === days)?.label ?? `${days} days`}`}
          value={money(forecast.endBalance)}
          tone={forecast.endBalance < 0 ? 'text-destructive' : undefined}
        />
        <Stat label="Bills due" value={money(forecast.totalBills)} />
        <Stat label="Net change" value={`${change >= 0 ? '+' : '-'}${money(Math.abs(change))}`} tone={change >= 0 ? 'text-success' : 'text-destructive'} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-semibold">Projected cash</p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={forecast.points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gradForecast" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0066CC" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#0066CC" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }} tickLine={false} axisLine={false} minTickGap={32} />
              <YAxis tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => (hideAmountsOnOpen ? '' : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(v)))} />
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
              <Tooltip formatter={(v) => money(Number(v))} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              <Area type="monotone" dataKey="balance" name="Cash" stroke="#0066CC" strokeWidth={2} fill="url(#gradForecast)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Counts your unpaid and recurring bills and income across non-credit-card wallets
          {includeTypical ? `, plus your average everyday spending and income over the last ${TYPICAL_WINDOW_DAYS} days` : ''}. Bills charged to a credit card are left out.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-semibold">Next on the calendar</p>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">No unpaid bills or income in this window.</p>
        ) : (
          <ul className="divide-y divide-border">
            {upcoming.map((e, i) => (
              <li key={`${e.name}-${e.date.toISOString()}-${i}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{e.name}</p>
                  <p className="text-xs text-muted-foreground">{format(e.date, 'EEE, MMM d')}</p>
                </div>
                <span className={`shrink-0 font-bold ${e.amount >= 0 ? 'text-success' : 'text-foreground'}`}>
                  {e.amount >= 0 ? '+' : '-'}
                  {money(Math.abs(e.amount))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function LookBackView() {
  const { currency, hideAmountsOnOpen } = useSettingsStore()
  const money = (n: number) => formatMoney(n, currency, hideAmountsOnOpen)
  const [dateText, setDateText] = useState(() => format(subDays(new Date(), 30), 'yyyy-MM-dd'))

  // End of the chosen local day, so everything that happened that day is included.
  const asOf = useMemo(() => {
    const [y, m, d] = dateText.split('-').map(Number)
    return y && m && d ? new Date(y, m - 1, d, 23, 59, 59, 999) : null
  }, [dateText])

  const walletsQ = useAllWallets()
  const afterQ = useTransactionsAfter(asOf?.toISOString() ?? '', !!asOf)
  const { data: wallets } = walletsQ
  const { data: after } = afterQ
  const error = walletsQ.error || afterQ.error

  const snapshots = useMemo(() => (wallets && after && asOf ? balancesAt(wallets, after, asOf) : null), [wallets, after, asOf])

  const totals = useMemo(() => {
    if (!snapshots) return null
    const sum = (rows: typeof snapshots) => rows.reduce((s, r) => s + (r.balance ?? 0), 0)
    const cash = snapshots.filter((r) => r.wallet.type !== 'credit_card')
    const cards = snapshots.filter((r) => r.wallet.type === 'credit_card')
    // Only wallets that existed then, so a later opening balance is not read as income.
    const nowCash = cash.filter((r) => r.balance !== null).reduce((s, r) => s + Number(r.wallet.balance), 0)
    return { cash: sum(cash), cards: sum(cards), nowCash }
  }, [snapshots])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground" htmlFor="lookback-date">
          Balance at the end of
        </label>
        <input
          id="lookback-date"
          type="date"
          value={dateText}
          max={todayInput()}
          onChange={(e) => setDateText(e.target.value)}
          className="mt-2 block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
        />
      </div>

      {error ? (
        <LoadError error={error} />
      ) : !asOf ? (
        <p className="text-sm text-muted-foreground">Pick a date to see your balances.</p>
      ) : !snapshots || !totals ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Cash then" value={money(totals.cash)} />
            <Stat
              label="Change since"
              value={`${totals.nowCash - totals.cash >= 0 ? '+' : '-'}${money(Math.abs(totals.nowCash - totals.cash))}`}
              tone={totals.nowCash - totals.cash >= 0 ? 'text-success' : 'text-destructive'}
            />
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-3 text-sm font-semibold">Wallets on {asOf ? format(asOf, 'MMM d, yyyy') : ''}</p>
            <ul className="divide-y divide-border">
              {snapshots.map(({ wallet, balance }) => (
                <li key={wallet.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{wallet.name}</p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {wallet.type.replace('_', ' ')}
                      {wallet.type === 'credit_card' ? ' · amount owed' : ''}
                      {wallet.status === 'archived' ? ' · archived' : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {balance === null ? (
                      <span className="text-xs text-muted-foreground">Not created yet</span>
                    ) : (
                      <>
                        <p className="font-bold">{money(balance)}</p>
                        <p className="text-xs text-muted-foreground">now {money(Number(wallet.balance))}</p>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Worked out by undoing every transaction after that date from today&apos;s balance. Balances you set or adjusted by hand
              (and interest) are not transactions, so they can make an older date a little off.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
