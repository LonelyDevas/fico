'use client'

import { useMemo, useState } from 'react'
import { IonContent, IonPage } from '@ionic/react'
import { Eye, EyeOff, Plus, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { EmptyState, PeacockMascot } from '@/components/peacock-mascot'
import { InvestmentActionSheet, type InvestmentAction } from '@/components/page/investments/investment-action-sheet'
import { InvestmentCard } from '@/components/page/investments/investment-card'
import { INVESTMENT_TYPES } from '@/components/page/investments/investment-meta'
import { InvestmentSheet } from '@/components/page/investments/investment-sheet'
import { useArchiveInvestment, useInvestmentSummary, useListInvestments } from '@/queries/user/investment/investments'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { Skeleton } from '@/components/ui/skeleton'
import { useLiveHoldings } from '@/queries/crypto/prices'
import type { Investment, InvestmentType } from '@/types/investment'

export default function InvestmentsPage() {
  const { currency, hideAmountsOnOpen } = useSettingsStore()
  const [showAmounts, setShowAmounts] = useState(!hideAmountsOnOpen)
  const [type, setType] = useState<'all' | InvestmentType>('all')
  const [sheet, setSheet] = useState<{ open: boolean; investment: Investment | null }>({ open: false, investment: null })
  const [action, setAction] = useState<{ action: InvestmentAction; investment: Investment } | null>(null)

  const { data: listResponse, isLoading } = useListInvestments({ limit: '100' })
  const { data: summaryResponse, isLoading: summaryLoading } = useInvestmentSummary()
  const { mutate: archive } = useArchiveInvestment()

  const all: Investment[] = useMemo(() => {
    const data = listResponse?.data as any
    const list: any[] = Array.isArray(data) ? data : data?.items ?? []
    return list.map((i) => ({ ...i, id: String(i._id ?? i.id) })) as Investment[]
  }, [listResponse])

  const shown = type === 'all' ? all : all.filter((i) => i.type === type)
  const active = shown.filter((i) => i.status !== 'sold')
  const sold = shown.filter((i) => i.status === 'sold')
  const presentTypes = INVESTMENT_TYPES.filter((t) => all.some((i) => i.type === t.value))

  const summary = summaryResponse?.data as any
  const { holdings, liveById } = useLiveHoldings(all)
  // The summary uses stored values; swap each live crypto holding's stored value for its live one.
  const liveDelta = holdings.reduce((sum, h) => sum + (liveById[h.id] ? liveById[h.id].value - (Number(h.currentValue) || 0) : 0), 0)
  const worth = Number(summary?.totalCurrentValue ?? 0) + liveDelta
  const invested = Number(summary?.totalInvested ?? 0)
  const dividends = Number(summary?.totalDividends ?? 0)
  const gain = Number(summary?.totalGainLoss ?? 0) + liveDelta
  const rate = invested > 0 ? (gain / invested) * 100 : Number(summary?.returnRate ?? 0)
  const money = (value: number) => formatMoney(value, currency, !showAmounts)

  const note = useMemo(() => {
    if (all.length === 0) return 'Add your first investment and I will track how it is growing.'
    const best = [...all]
      .filter((i) => i.status !== 'sold' && i.principalAmount > 0)
      .sort((a, b) => (b.currentValue - b.principalAmount) / b.principalAmount - (a.currentValue - a.principalAmount) / a.principalAmount)[0]
    if (best && best.currentValue > best.principalAmount) {
      const pct = ((best.currentValue - best.principalAmount) / best.principalAmount) * 100
      return `${best.name} is your best performer, up ${pct.toFixed(1)}% on what you put in.`
    }
    return gain >= 0
      ? `Your investments are up ${formatMoney(gain, currency, false)} overall.`
      : `Your investments are down ${formatMoney(Math.abs(gain), currency, false)} overall. Long term matters more than one bad stretch.`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, gain, currency])

  const handleArchive = (investment: Investment) =>
    archive({ id: investment.id }, { onSuccess: () => toast.success('Archived') })

  const card = (i: Investment) => (
    <InvestmentCard
      key={i.id}
      investment={i}
      live={liveById[i.id]}
      hideAmounts={!showAmounts}
      onAction={(a, inv) => setAction({ action: a, investment: inv })}
      onEdit={(inv) => setSheet({ open: true, investment: inv })}
      onArchive={handleArchive}
    />
  )

  return (
    <IonPage>
      <IonContent className="bg-background text-foreground">
        <main className="mx-auto max-w-5xl px-4 pb-10 pt-5 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Growing your money</p>
            <h1 className="mt-1 font-heading text-2xl font-semibold leading-tight text-foreground sm:text-3xl">Investments</h1>
          </div>

          <section className="mt-5">
            <div className="relative z-10 mb-3 flex items-end">
              <div className="relative min-w-0 max-w-2xl flex-1 rounded-[1.75rem] border border-border bg-card px-4 py-3.5 shadow-ios">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  Fico&apos;s take
                </p>
                {summaryLoading ? (
                  <div className="mt-2 space-y-2" aria-label="Loading">
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3.5 w-2/3" />
                  </div>
                ) : (
                  <p className="mt-1.5 text-[15px] leading-relaxed text-foreground">{note}</p>
                )}
                <span aria-hidden="true" className="absolute -right-3.5 bottom-6 h-3.5 w-3.5 rounded-full border border-border bg-card shadow-sm sm:bottom-8" />
                <span aria-hidden="true" className="absolute -right-[1.65rem] bottom-4 h-2 w-2 rounded-full border border-border bg-card shadow-sm sm:bottom-6" />
              </div>
              <PeacockMascot pose="advisor" className="-mb-10 ml-7 h-24 w-24 shrink-0 sm:h-28 sm:w-28" label="Fico, your financial advisor" />
            </div>

            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-[#004C99] px-5 pb-5 pt-9 text-white shadow-ios-lg">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white/75">Total worth</p>
                  <button
                    type="button"
                    onClick={() => setShowAmounts((v) => !v)}
                    aria-label={showAmounts ? 'Hide amounts' : 'Show amounts'}
                    className="rounded-full p-1 text-white/75 hover:bg-white/15 hover:text-white"
                  >
                    {showAmounts ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setSheet({ open: true, investment: null })}
                  className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-primary shadow-sm hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>
              {summaryLoading ? (
                <>
                  <Skeleton className="mt-2 h-10 w-52 bg-white/20 sm:h-12" />
                  <Skeleton className="mt-2 h-3 w-40 bg-white/20" />
                </>
              ) : (
                <>
                  <p className="mt-1 font-heading text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">{money(worth)}</p>
                  <p className="mt-1 text-xs text-white/75">
                    {gain >= 0 ? '+' : '-'}
                    {money(Math.abs(gain))} ({rate >= 0 ? '+' : ''}
                    {rate.toFixed(1)}%) including returns
                  </p>
                </>
              )}
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  { label: 'Put in', value: invested },
                  { label: 'Returns received', value: dividends },
                ].map((tile) => (
                  <div key={tile.label} className="rounded-2xl bg-white/12 p-3">
                    <p className="text-xs font-medium text-white/75">{tile.label}</p>
                    <div className="mt-1 truncate text-base font-semibold tabular-nums sm:text-lg">{summaryLoading ? <Skeleton className="h-6 w-20 bg-white/20" /> : money(tile.value)}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {presentTypes.length > 1 && (
            <div className="-mx-1 mt-5 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filter by type">
              {[{ value: 'all' as const, label: 'All' }, ...presentTypes].map((t) => (
                <button
                  key={t.value}
                  type="button"
                  aria-pressed={type === t.value}
                  onClick={() => setType(t.value)}
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                    type === t.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:border-primary/50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          <div className="mt-4">
            {isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[0, 1].map((i) => (
                  <div key={i} className="h-60 animate-pulse rounded-3xl bg-secondary" />
                ))}
              </div>
            ) : shown.length === 0 ? (
              <div className="rounded-3xl border border-border bg-card p-10 shadow-ios">
                <EmptyState pose="advisor" title="No investments yet" description="Add stocks, funds, bonds, crypto or anything else you are growing.">
                  <button type="button" onClick={() => setSheet({ open: true, investment: null })} className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
                    <Plus className="h-4 w-4" />
                    Add an investment
                  </button>
                </EmptyState>
              </div>
            ) : (
              <div className="space-y-6">
                {active.length > 0 && <div className="grid gap-3 sm:grid-cols-2">{active.map(card)}</div>}
                {sold.length > 0 && (
                  <section aria-label="Sold">
                    <h2 className="mb-2.5 px-1 font-heading text-sm font-semibold text-muted-foreground">Sold</h2>
                    <div className="grid gap-3 sm:grid-cols-2">{sold.map(card)}</div>
                  </section>
                )}
              </div>
            )}
          </div>
        </main>
      </IonContent>

      <InvestmentSheet open={sheet.open} onClose={() => setSheet((s) => ({ ...s, open: false }))} investment={sheet.investment} />
      <InvestmentActionSheet action={action?.action ?? null} investment={action?.investment ?? null} onClose={() => setAction(null)} />
    </IonPage>
  )
}
