'use client'

import { useMemo, useState } from 'react'
import { IonContent, IonPage } from '@ionic/react'
import { format, differenceInCalendarDays, parseISO } from 'date-fns'
import { Eye, EyeOff, Plus, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { EmptyState, PeacockMascot } from '@/components/peacock-mascot'
import { ConfirmSheet } from '@/components/ui/confirm-sheet'
import { PlannedItemCard } from '@/components/page/planned/planned-item-card'
import { PlannedItemSheet } from '@/components/page/planned/planned-item-sheet'
import { useDeletePlannedItem, useListPlannedItems } from '@/queries/user/planned/planned-items'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { Skeleton } from '@/components/ui/skeleton'
import type { PlannedItem, PlannedItemType } from '@/types/planned-item'

type Tab = 'all' | PlannedItemType

const TABS: { value: Tab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'income', label: 'Coming in' },
  { value: 'expense', label: 'Going out' },
]

const localToday = () => format(new Date(), 'yyyy-MM-dd')

export default function PlannedPage() {
  const { currency, hideAmountsOnOpen } = useSettingsStore()
  const [showAmounts, setShowAmounts] = useState(!hideAmountsOnOpen)
  const [tab, setTab] = useState<Tab>('all')
  const [sheet, setSheet] = useState<{ open: boolean; item: PlannedItem | null; type: PlannedItemType }>({ open: false, item: null, type: 'income' })
  const [deleting, setDeleting] = useState<PlannedItem | null>(null)

  const { data, isLoading } = useListPlannedItems()
  const { mutate: remove, isPending: removing } = useDeletePlannedItem()

  const all = useMemo(() => data ?? [], [data])
  const items = tab === 'all' ? all : all.filter((i) => i.type === tab)
  const today = localToday()
  const upcoming = items.filter((i) => i.date >= today)
  const passed = items.filter((i) => i.date < today).reverse()

  // Totals cover everything still ahead, whichever tab is showing.
  const totals = useMemo(() => {
    const ahead = all.filter((i) => i.date >= today)
    const sum = (type: PlannedItemType, key: 'amountLow' | 'amountHigh') => ahead.filter((i) => i.type === type).reduce((s, i) => s + i[key], 0)
    const income = { low: sum('income', 'amountLow'), high: sum('income', 'amountHigh') }
    const expenses = { low: sum('expense', 'amountLow'), high: sum('expense', 'amountHigh') }
    return { income, expenses, lowNet: income.low - expenses.high, highNet: income.high - expenses.low, count: ahead.length }
  }, [all, today])

  const money = (value: number) => formatMoney(value, currency, !showAmounts)
  const signed = (value: number) => `${value > 0 ? '+' : ''}${money(value)}`

  const note = useMemo(() => {
    const next = all.find((i) => i.date >= today)
    if (next) {
      const days = differenceInCalendarDays(parseISO(next.date), parseISO(today))
      const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`
      const sure = next.status === 'confirmed' ? '' : ' It is not confirmed yet, so I count it as a maybe.'
      return `Next up: ${next.name}, ${format(parseISO(next.date), 'MMM d')} (${when}).${sure}`
    }
    if (all.length === 0) return 'Add money you expect that is not a bill, like a 13th month pay, gifts or a trip, and I will count it in your plans.'
    return 'Everything you planned has passed. Add what is coming next.'
  }, [all, today])

  const openNew = () => setSheet({ open: true, item: null, type: tab === 'expense' ? 'expense' : 'income' })
  const openEdit = (item: PlannedItem) => setSheet({ open: true, item, type: item.type })

  const confirmDelete = () => {
    if (!deleting) return
    remove({ id: deleting.id }, { onSuccess: () => { toast.success('Deleted'); setDeleting(null) } })
  }

  const tiles = [
    { label: 'Coming in', ...totals.income },
    { label: 'Going out', ...totals.expenses },
  ]

  return (
    <IonPage>
      <IonContent className="bg-background text-foreground">
        <main className="mx-auto max-w-5xl px-4 pb-10 pt-5 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Expected one-offs</p>
            <h1 className="mt-1 font-heading text-2xl font-semibold leading-tight text-foreground sm:text-3xl">Planned</h1>
          </div>

          <section className="mt-5">
            <div className="relative z-10 mb-3 flex items-end">
              <div className="relative min-w-0 max-w-2xl flex-1 rounded-[1.75rem] border border-border bg-card px-4 py-3.5 shadow-ios">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  Fico&apos;s take
                </p>
                {isLoading ? (
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
              <div className="relative">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white/75">Planned net, worst case</p>
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
                    onClick={openNew}
                    className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-primary shadow-sm hover:opacity-90"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>
                {isLoading ? (
                  <Skeleton className="mt-2 h-10 w-52 bg-white/20 sm:h-12" />
                ) : (
                  <p className="mt-1 font-heading text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">{signed(totals.lowNet)}</p>
                )}
                <p className="mt-1 text-xs text-white/75">
                  {totals.highNet !== totals.lowNet ? `Up to ${signed(totals.highNet)} if everything goes well. ` : ''}
                  Counts the {totals.count} item{totals.count === 1 ? '' : 's'} still ahead.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {tiles.map((tile) => (
                    <div key={tile.label} className="min-w-0 rounded-2xl bg-white/12 p-3">
                      <p className="text-xs font-medium text-white/75">{tile.label}</p>
                      <div className="mt-1 truncate text-base font-semibold tabular-nums sm:text-lg">{isLoading ? <Skeleton className="h-6 w-20 bg-white/20" /> : money(tile.low)}</div>
                      {!isLoading && tile.high !== tile.low && <p className="truncate text-xs tabular-nums text-white/75">up to {money(tile.high)}</p>}
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
                  <div key={i} className="h-36 animate-pulse rounded-3xl bg-secondary" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-3xl border border-border bg-card p-10 shadow-ios">
                <EmptyState pose="advisor" title="Nothing planned yet" description="Add a 13th month pay, gift money, a trip or a visit, with a low and a high guess.">
                  <button type="button" onClick={openNew} className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
                    <Plus className="h-4 w-4" />
                    Add one
                  </button>
                </EmptyState>
              </div>
            ) : (
              <div className="space-y-6">
                {upcoming.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {upcoming.map((item) => (
                      <PlannedItemCard key={item.id} item={item} hideAmounts={!showAmounts} onEdit={openEdit} onDelete={setDeleting} />
                    ))}
                  </div>
                )}
                {passed.length > 0 && (
                  <section aria-label="Already passed">
                    <h2 className="mb-2.5 px-1 font-heading text-sm font-semibold text-muted-foreground">Already passed</h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {passed.map((item) => (
                        <PlannedItemCard key={item.id} item={item} hideAmounts={!showAmounts} onEdit={openEdit} onDelete={setDeleting} />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </main>
      </IonContent>

      <PlannedItemSheet open={sheet.open} onClose={() => setSheet((s) => ({ ...s, open: false }))} item={sheet.item} initialType={sheet.type} />
      <ConfirmSheet
        open={!!deleting}
        onOpenChange={(next) => !next && setDeleting(null)}
        onConfirm={confirmDelete}
        variant="destructive"
        title="Delete this planned item?"
        description={deleting ? `${deleting.name} will be removed from your plan.` : undefined}
        confirmLabel="Delete"
        confirmingLabel="Deleting..."
        isConfirming={removing}
      />
    </IonPage>
  )
}
