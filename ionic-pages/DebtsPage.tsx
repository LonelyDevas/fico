'use client'

import { useMemo, useState } from 'react'
import { IonContent, IonPage } from '@ionic/react'
import { format, differenceInCalendarDays } from 'date-fns'
import { Eye, EyeOff, Plus, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { EmptyState, PeacockMascot } from '@/components/peacock-mascot'
import { ObligationCard } from '@/components/page/debts/obligation-card'
import { ObligationSheet } from '@/components/page/debts/obligation-sheet'
import { RecordPaymentSheet } from '@/components/page/debts/record-payment-sheet'
import { useArchiveObligation, useListObligations, useObligationSummary } from '@/queries/user/obligation/obligations'
import { useSettingsStore } from '@/store/settings-store'
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
  const { data: summaryResponse } = useObligationSummary()
  const { mutate: archive } = useArchiveObligation()

  const items: Obligation[] = useMemo(() => {
    const data = listResponse?.data as any
    const list: any[] = Array.isArray(data) ? data : data?.items ?? []
    return list.map((o) => ({ ...o, id: String(o._id ?? o.id) })) as Obligation[]
  }, [listResponse])

  const open = items.filter((o) => o.status !== 'settled')
  const settled = items.filter((o) => o.status === 'settled')

  const summary = summaryResponse?.data as any
  const owe = Number(summary?.debt?.totalRemaining ?? 0)
  const owed = Number(summary?.lending?.totalRemaining ?? 0)
  const net = Number(summary?.netPosition ?? owed - owe)
  const activeCount = Number(summary?.debt?.activeCount ?? 0) + Number(summary?.lending?.activeCount ?? 0)
  const money = (value: number) => formatMoney(value, currency, !showAmounts)

  const note = useMemo(() => {
    const dated = items
      .filter((o) => o.direction === 'debt' && o.status !== 'settled' && o.dueDate)
      .sort((a, b) => new Date(a.dueDate as string).getTime() - new Date(b.dueDate as string).getTime())[0]
    if (dated) {
      const days = differenceInCalendarDays(new Date(dated.dueDate as string), new Date())
      if (days < 0) return `${dated.name} is ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue. Paying even part of it helps.`
      return `Next up: ${dated.name}, due ${format(new Date(dated.dueDate as string), 'MMM d')}${days <= 7 ? ` (${days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`})` : ''}.`
    }
    if (activeCount === 0) return 'No debts or loans on record. Add one when you borrow or lend and I will keep track.'
    return `You owe ${formatMoney(owe, currency, false)} and are owed ${formatMoney(owed, currency, false)}.`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, owe, owed, activeCount, currency])

  const handleArchive = (obligation: Obligation) =>
    archive({ id: obligation.id }, { onSuccess: () => toast.success('Archived') })

  const tiles = [
    { label: 'You owe', value: owe },
    { label: 'Owed to you', value: owed },
  ]

  return (
    <IonPage>
      <IonContent className="bg-background text-foreground">
        <main className="mx-auto max-w-5xl px-4 pb-10 pt-5 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Borrowed and lent</p>
            <h1 className="mt-1 font-heading text-2xl font-semibold leading-tight text-foreground sm:text-3xl">Debts &amp; loans</h1>
          </div>

          <section className="mt-5">
            <div className="relative z-10 mb-3 flex items-end">
              <div className="relative min-w-0 max-w-2xl flex-1 rounded-[1.75rem] border border-border bg-card px-4 py-3.5 shadow-ios">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  Fico&apos;s take
                </p>
                <p className="mt-1.5 text-[15px] leading-relaxed text-foreground">{note}</p>
                <span aria-hidden="true" className="absolute -right-3.5 bottom-6 h-3.5 w-3.5 rounded-full border border-border bg-card shadow-sm sm:bottom-8" />
                <span aria-hidden="true" className="absolute -right-[1.65rem] bottom-4 h-2 w-2 rounded-full border border-border bg-card shadow-sm sm:bottom-6" />
              </div>
              <PeacockMascot pose="advisor" className="-mb-10 ml-7 h-24 w-24 shrink-0 sm:h-28 sm:w-28" label="Fico, your financial advisor" />
            </div>

            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-[#004C99] px-5 pb-5 pt-9 text-white shadow-ios-lg">
              <div className="relative">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white/75">Net position</p>
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
                    onClick={() => setSheet({ open: true, obligation: null, direction: tab === 'lending' ? 'lending' : 'debt' })}
                    className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-primary shadow-sm hover:opacity-90"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>
                <p className="mt-1 font-heading text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
                  {net > 0 ? '+' : ''}
                  {money(net)}
                </p>
                <p className="mt-1 text-xs text-white/75">What you are owed minus what you owe</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {tiles.map((tile) => (
                    <div key={tile.label} className="rounded-2xl bg-white/12 p-3">
                      <p className="text-xs font-medium text-white/75">{tile.label}</p>
                      <p className="mt-1 truncate text-base font-semibold tabular-nums sm:text-lg">{money(tile.value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

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

          <div className="mt-4">
            {isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">
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
                  <div className="grid gap-3 sm:grid-cols-2">
                    {open.map((o) => (
                      <ObligationCard key={o.id} obligation={o} hideAmounts={!showAmounts} onPay={setPaying} onEdit={(x) => setSheet({ open: true, obligation: x, direction: x.direction })} onArchive={handleArchive} />
                    ))}
                  </div>
                )}
                {settled.length > 0 && (
                  <section aria-label="Settled">
                    <h2 className="mb-2.5 px-1 font-heading text-sm font-semibold text-muted-foreground">Settled</h2>
                    <div className="grid gap-3 sm:grid-cols-2">
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
