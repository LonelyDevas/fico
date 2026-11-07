'use client'

import { useMemo, useState } from 'react'
import { IonContent, IonPage } from '@ionic/react'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { EmptyState } from '@/components/peacock-mascot'
import { InvestmentActionSheet, type InvestmentAction } from '@/components/page/investments/investment-action-sheet'
import { InvestmentCard } from '@/components/page/investments/investment-card'
import { INVESTMENT_TYPES } from '@/components/page/investments/investment-meta'
import { InvestmentSheet } from '@/components/page/investments/investment-sheet'
import { useArchiveInvestment, useInvestmentSummary, useListInvestments } from '@/queries/user/investment/investments'
import { useSettingsStore } from '@/store/settings-store'
import { ManageHeader } from '@/components/page/manage-header'
import { formatMoney } from '@/utils/formatter'
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
  const gain = Number(summary?.totalGainLoss ?? 0) + liveDelta
  const rate = invested > 0 ? (gain / invested) * 100 : Number(summary?.returnRate ?? 0)
  const money = (value: number) => formatMoney(value, currency, !showAmounts)

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
          <ManageHeader
            statsHref="/statistics#investments"
            eyebrow="Growing your money"
            title="Investments"
            loading={summaryLoading}
            summary={all.length > 0 ? `${money(worth)} total · ${gain >= 0 ? '+' : '-'}${money(Math.abs(gain))} (${rate >= 0 ? '+' : ''}${rate.toFixed(1)}%)` : undefined}
            showAmounts={showAmounts}
            onToggleAmounts={() => setShowAmounts((v) => !v)}
            onAdd={() => setSheet({ open: true, investment: null })}
          />

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
