'use client'

import { useMemo, useState } from 'react'
import { IonContent, IonPage } from '@ionic/react'
import { format } from 'date-fns'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { EmptyState } from '@/components/peacock-mascot'
import { ConfirmSheet } from '@/components/ui/confirm-sheet'
import { PlannedItemCard } from '@/components/page/planned/planned-item-card'
import { PlannedItemSheet } from '@/components/page/planned/planned-item-sheet'
import { useDeletePlannedItem, useListPlannedItems } from '@/queries/user/planned/planned-items'
import { useSettingsStore } from '@/store/settings-store'
import { ManageHeader } from '@/components/page/manage-header'
import { formatMoney } from '@/utils/formatter'
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

  const openNew = () => setSheet({ open: true, item: null, type: tab === 'expense' ? 'expense' : 'income' })
  const openEdit = (item: PlannedItem) => setSheet({ open: true, item, type: item.type })

  const confirmDelete = () => {
    if (!deleting) return
    remove({ id: deleting.id }, { onSuccess: () => { toast.success('Deleted'); setDeleting(null) } })
  }

  return (
    <IonPage>
      <IonContent className="bg-background text-foreground">
        <main className="mx-auto max-w-5xl px-4 pb-10 pt-5 sm:px-6 lg:px-8">
          <ManageHeader
            statsHref="/statistics#planned"
            eyebrow="Expected one-offs"
            title="Planned"
            loading={isLoading}
            summary={totals.count > 0 ? `${signed(totals.lowNet)} planned net · ${totals.count} still ahead` : undefined}
            showAmounts={showAmounts}
            onToggleAmounts={() => setShowAmounts((v) => !v)}
            onAdd={openNew}
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
