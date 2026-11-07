'use client'

import { useMemo, useState } from 'react'
import { IonContent, IonPage } from '@ionic/react'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { EmptyState } from '@/components/peacock-mascot'
import { ObligationCard } from '@/components/page/debts/obligation-card'
import { ObligationSheet } from '@/components/page/debts/obligation-sheet'
import { RecordPaymentSheet } from '@/components/page/debts/record-payment-sheet'
import { useArchiveObligation, useListObligations, useObligationSummary } from '@/queries/user/obligation/obligations'
import { useSettingsStore } from '@/store/settings-store'
import { ManageHeader } from '@/components/page/manage-header'
import { formatMoney } from '@/utils/formatter'
import type { Obligation, ObligationDirection } from '@/types/obligation'

type Tab = 'all' | ObligationDirection

const TABS: { value: Tab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'debt', label: 'I owe' },
  { value: 'lending', label: 'Owed to me' },
]

export default function DebtsPage() {
  const { currency, hideAmountsOnOpen } = useSettingsStore()
  const [showAmounts, setShowAmounts] = useState(!hideAmountsOnOpen)
  const [tab, setTab] = useState<Tab>('all')
  const [sheet, setSheet] = useState<{ open: boolean; obligation: Obligation | null; direction: ObligationDirection }>({ open: false, obligation: null, direction: 'debt' })
  const [paying, setPaying] = useState<Obligation | null>(null)

  const { data: listResponse, isLoading } = useListObligations({ limit: '100', ...(tab !== 'all' ? { direction: tab } : {}) })
  const { data: summaryResponse, isLoading: summaryLoading } = useObligationSummary()
  const { mutate: archive } = useArchiveObligation()

  const items: Obligation[] = useMemo(() => {
    const data = listResponse?.data as any
    const list: any[] = Array.isArray(data) ? data : data?.items ?? []
    return list.map((o) => ({ ...o, id: String(o._id ?? o.id) })) as Obligation[]
  }, [listResponse])

  const open = items.filter((o) => o.status !== 'settled')
  const settled = items.filter((o) => o.status === 'settled')

  const debtors = useMemo(() => {
    const byPerson = new Map<string, { name: string; remaining: number; count: number; contact?: string }>()
    for (const o of items) {
      if (o.direction !== 'lending' || o.status === 'settled' || o.status === 'archived') continue
      const name = o.counterparty?.trim() || 'Unknown'
      const key = name.toLowerCase()
      const entry = byPerson.get(key) ?? { name, remaining: 0, count: 0, contact: o.counterpartyContact }
      entry.remaining += Number(o.remainingBalance) || 0
      entry.count += 1
      byPerson.set(key, entry)
    }
    return [...byPerson.values()].sort((a, b) => b.remaining - a.remaining)
  }, [items])

  const summary = summaryResponse?.data as any
  const owe = Number(summary?.debt?.totalRemaining ?? 0)
  const owed = Number(summary?.lending?.totalRemaining ?? 0)
  const activeCount = Number(summary?.debt?.activeCount ?? 0) + Number(summary?.lending?.activeCount ?? 0)
  const money = (value: number) => formatMoney(value, currency, !showAmounts)

  const handleArchive = (obligation: Obligation) =>
    archive({ id: obligation.id }, { onSuccess: () => toast.success('Archived') })

  return (
    <IonPage>
      <IonContent className="bg-background text-foreground">
        <main className="mx-auto max-w-5xl px-4 pb-10 pt-5 sm:px-6 lg:px-8">
          <ManageHeader
            statsHref="/statistics#debts-total"
            eyebrow="Borrowed and lent"
            title="Debts & loans"
            loading={summaryLoading}
            summary={activeCount > 0 ? `You owe ${money(owe)} · owed to you ${money(owed)}` : undefined}
            showAmounts={showAmounts}
            onToggleAmounts={() => setShowAmounts((v) => !v)}
            onAdd={() => setSheet({ open: true, obligation: null, direction: tab === 'lending' ? 'lending' : 'debt' })}
          />

          <div role="group" aria-label="Filter" className="mt-5 inline-flex rounded-full bg-secondary p-1">
            {TABS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={tab === option.value}
                onClick={() => setTab(option.value)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${tab === option.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {tab === 'lending' && debtors.length > 0 && (
            <section aria-label="Who owes you" className="mt-4 rounded-3xl border border-border bg-card p-4 shadow-ios">
              <h2 className="mb-2 font-heading text-sm font-semibold text-muted-foreground">Who owes you</h2>
              <ul className="divide-y divide-border">
                {debtors.map((d) => (
                  <li key={d.name} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{d.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {d.count} loan{d.count === 1 ? '' : 's'}
                        {d.contact ? ` · ${d.contact}` : ''}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums text-success">{money(d.remaining)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mt-4">
            {isLoading ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[0, 1].map((i) => (
                  <div key={i} className="h-44 animate-pulse rounded-3xl bg-secondary" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-3xl border border-border bg-card p-10 shadow-ios">
                <EmptyState pose="advisor" title="Nothing here yet" description="Add a loan you took or money you lent, and track how it is paid back.">
                  <button
                    type="button"
                    onClick={() => setSheet({ open: true, obligation: null, direction: tab === 'lending' ? 'lending' : 'debt' })}
                    className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
                  >
                    <Plus className="h-4 w-4" />
                    Add one
                  </button>
                </EmptyState>
              </div>
            ) : (
              <div className="space-y-6">
                {open.length > 0 && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {open.map((o) => (
                      <ObligationCard key={o.id} obligation={o} hideAmounts={!showAmounts} onPay={setPaying} onEdit={(x) => setSheet({ open: true, obligation: x, direction: x.direction })} onArchive={handleArchive} />
                    ))}
                  </div>
                )}
                {settled.length > 0 && (
                  <section aria-label="Settled">
                    <h2 className="mb-2.5 px-1 font-heading text-sm font-semibold text-muted-foreground">Settled</h2>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {settled.map((o) => (
                        <ObligationCard key={o.id} obligation={o} hideAmounts={!showAmounts} onPay={setPaying} onEdit={(x) => setSheet({ open: true, obligation: x, direction: x.direction })} onArchive={handleArchive} />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </main>
      </IonContent>

      <ObligationSheet
        open={sheet.open}
        onClose={() => setSheet((s) => ({ ...s, open: false }))}
        obligation={sheet.obligation}
        initialDirection={sheet.direction}
      />
      <RecordPaymentSheet obligation={paying} onClose={() => setPaying(null)} />
    </IonPage>
  )
}
