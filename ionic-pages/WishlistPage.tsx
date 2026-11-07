'use client'

import { useMemo, useState } from 'react'
import { IonContent, IonPage } from '@ionic/react'
import { format, differenceInCalendarDays, parseISO } from 'date-fns'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { EmptyState } from '@/components/peacock-mascot'
import { ConfirmSheet } from '@/components/ui/confirm-sheet'
import { WishlistItemCard } from '@/components/page/wishlist/wishlist-item-card'
import { WishlistItemSheet } from '@/components/page/wishlist/wishlist-item-sheet'
import { useDeleteWishlistItem, useListWishlist, useSetWishlistBought } from '@/queries/user/wishlist/wishlist'
import { useSettingsStore } from '@/store/settings-store'
import { ManageHeader } from '@/components/page/manage-header'
import { formatMoney } from '@/utils/formatter'
import type { WishlistItem, WishlistPriority, WishlistStatus } from '@/types/wishlist'

const TABS: { value: WishlistStatus; label: string }[] = [
  { value: 'wanted', label: 'Wanted' },
  { value: 'bought', label: 'Bought' },
]

const ORDER: Record<WishlistPriority, number> = { need: 0, want: 1, someday: 2 }
const DAYS_PER_MONTH = 365.25 / 12

const localToday = () => format(new Date(), 'yyyy-MM-dd')

/** What to put aside each month to have the price by the item's date. Under a month left means all of it now. */
const monthlyFor = (item: WishlistItem, today: string) => {
  if (!item.targetDate) return 0
  const months = Math.max(0, differenceInCalendarDays(parseISO(item.targetDate), parseISO(today))) / DAYS_PER_MONTH
  return item.price / Math.max(1, months)
}

export default function WishlistPage() {
  const { currency, hideAmountsOnOpen } = useSettingsStore()
  const [showAmounts, setShowAmounts] = useState(!hideAmountsOnOpen)
  const [tab, setTab] = useState<WishlistStatus>('wanted')
  const [sheet, setSheet] = useState<{ open: boolean; item: WishlistItem | null }>({ open: false, item: null })
  const [deleting, setDeleting] = useState<WishlistItem | null>(null)

  const { data, isLoading } = useListWishlist()
  const { mutate: remove, isPending: removing } = useDeleteWishlistItem()
  const { mutate: setBought } = useSetWishlistBought()

  const all = useMemo(() => data ?? [], [data])
  const today = localToday()
  const wanted = useMemo(
    () =>
      all
        .filter((i) => i.status === 'wanted')
        .sort((a, b) => ORDER[a.priority] - ORDER[b.priority] || (a.targetDate ?? '9999').localeCompare(b.targetDate ?? '9999')),
    [all]
  )
  const bought = useMemo(() => all.filter((i) => i.status === 'bought').sort((a, b) => (b.boughtOn ?? '').localeCompare(a.boughtOn ?? '')), [all])
  const items = tab === 'wanted' ? wanted : bought

  const totals = useMemo(() => {
    const sum = (list: WishlistItem[]) => list.reduce((s, i) => s + i.price, 0)
    return {
      wanted: sum(wanted),
      need: sum(wanted.filter((i) => i.priority === 'need')),
      needCount: wanted.filter((i) => i.priority === 'need').length,
      monthly: wanted.reduce((s, i) => s + monthlyFor(i, today), 0),
      dated: wanted.filter((i) => i.targetDate).length,
    }
  }, [wanted, today])

  const money = (value: number) => formatMoney(value, currency, !showAmounts)

  const openNew = () => setSheet({ open: true, item: null })
  const openEdit = (item: WishlistItem) => setSheet({ open: true, item })

  const toggleBought = (item: WishlistItem) => {
    const nowBought = item.status !== 'bought'
    setBought(
      { id: item.id, boughtOn: nowBought ? today : null },
      { onSuccess: () => toast.success(nowBought ? 'Marked as bought. Log it as an expense when you pay.' : 'Back on your wishlist') }
    )
  }

  const confirmDelete = () => {
    if (!deleting) return
    remove({ id: deleting.id }, { onSuccess: () => { toast.success('Deleted'); setDeleting(null) } })
  }

  return (
    <IonPage>
      <IonContent className="bg-background text-foreground">
        <main className="mx-auto max-w-5xl px-4 pb-10 pt-5 sm:px-6 lg:px-8">
          <ManageHeader
            statsHref="/statistics#wishlist"
            eyebrow="Things you want"
            title="Wishlist"
            loading={isLoading}
            summary={wanted.length > 0 ? `${money(totals.wanted)} still to buy · ${wanted.length} item${wanted.length === 1 ? '' : 's'}` : undefined}
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
                {tab === 'wanted' ? (
                  <EmptyState pose="advisor" title="Your wishlist is empty" description="Add a phone, shoes, a trip or anything you are saving up for, with its price.">
                    <button type="button" onClick={openNew} className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
                      <Plus className="h-4 w-4" />
                      Add one
                    </button>
                  </EmptyState>
                ) : (
                  <EmptyState pose="advisor" title="Nothing bought yet" description="When you buy something from your list, mark it as bought and it moves here." />
                )}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((item) => (
                  <WishlistItemCard key={item.id} item={item} hideAmounts={!showAmounts} onEdit={openEdit} onToggleBought={toggleBought} onDelete={setDeleting} />
                ))}
              </div>
            )}
          </div>
        </main>
      </IonContent>

      <WishlistItemSheet open={sheet.open} onClose={() => setSheet((s) => ({ ...s, open: false }))} item={sheet.item} />
      <ConfirmSheet
        open={!!deleting}
        onOpenChange={(next) => !next && setDeleting(null)}
        onConfirm={confirmDelete}
        variant="destructive"
        title="Delete this wish?"
        description={deleting ? `${deleting.name} will be removed from your wishlist.` : undefined}
        confirmLabel="Delete"
        confirmingLabel="Deleting..."
        isConfirming={removing}
      />
    </IonPage>
  )
}
