'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { ArrowLeft, ArrowRight, ArrowUp, Check, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { QuickAddSheet } from '@/components/page/transaction/quick-add-sheet'
import { useListCategories } from '@/queries/user/category/categories'
import { useListTransactions, useTriageTransaction } from '@/queries/user/transaction/transaction'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { suggestCategory, type TriageCategory } from '@/utils/triage'
import { useActiveRules } from '@/queries/user/rule/rules'
import { offerRule } from '@/components/page/rules/offer-rule'

const asList = (data: any): any[] => (Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [])
const idOf = (x: any) => String(x._id ?? x.id)
const SWIPE = 90

/** Uncategorized transactions waiting to be sorted, for the Home card's count. */
export function useUncategorized() {
  const { data, isLoading } = useListTransactions({ categoryId: 'none', limit: '200' })
  return { items: asList(data?.data), isLoading }
}

/**
 * One card at a time: swipe right to take the suggested category, left to skip, up to edit. "Already in my
 * balance" flags the row so it never moves a wallet balance (for imported history).
 */
export function TriageInbox({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { currency, hideAmountsOnOpen } = useSettingsStore()
  const money = (n: number) => formatMoney(n, currency, hideAmountsOnOpen)
  const { items, isLoading: itemsLoading } = useUncategorized()
  const { data: historyResponse } = useListTransactions({ limit: '500' })
  const { data: categoriesResponse } = useListCategories()
  const { mutate: triage } = useTriageTransaction()

  const categories = useMemo<TriageCategory[]>(
    () => asList(categoriesResponse?.data).map((c) => ({ id: idOf(c), name: String(c.name), type: c.type ?? undefined })),
    [categoriesResponse]
  )
  const history = useMemo(
    () => asList(historyResponse?.data).map((t) => ({ description: t.description, categoryId: t.categoryId ?? null, type: t.type })),
    [historyResponse]
  )

  // The queue is fixed when the inbox opens, so refetches after each save don't reshuffle it.
  const [queue, setQueue] = useState<any[] | null>(null)
  const [index, setIndex] = useState(0)
  const [sorted, setSorted] = useState(0)
  const [editing, setEditing] = useState<any | null>(null)
  useEffect(() => {
    if (!open) {
      setQueue(null)
      return
    }
    if (queue === null && !itemsLoading && categoriesResponse) {
      setQueue(items.filter((t) => t.type !== 'transfer'))
      setIndex(0)
      setSorted(0)
    }
  }, [open, items, itemsLoading, categoriesResponse, queue])

  const current = queue?.[index]
  const rules = useActiveRules()
  const suggestion = useMemo(() => (current ? suggestCategory(current, history, categories, rules) : null), [current, history, categories, rules])
  const choices = useMemo(
    // Every category of the matching type: a cap here hid the last ones alphabetically (e.g. "Repaid").
    () => categories.filter((c) => !c.type || !current || c.type === current.type),
    [categories, current]
  )

  const next = (didSort: boolean) => {
    if (didSort) setSorted((n) => n + 1)
    setIndex((i) => i + 1)
    setDrag({ x: 0, y: 0 })
  }
  const accept = (category?: TriageCategory) => {
    if (!current || !category) return
    triage({ id: idOf(current), patch: { category_id: category.id } })
    // Picked something other than the suggestion (or there was none): offer to make it a rule.
    if (category.id !== suggestion?.category.id) offerRule({ description: current.description, type: current.type, categoryId: category.id, categoryName: category.name, rules })
    next(true)
  }
  const keepBalance = () => {
    if (!current) return
    triage({ id: idOf(current), patch: { affects_balance: false } }, { onSuccess: () => toast.success('Marked as already in your balance') })
    next(true)
  }

  // Swipe handling.
  const [drag, setDrag] = useState({ x: 0, y: 0 })
  const start = useRef<{ x: number; y: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current) return
    setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y })
  }
  const onPointerUp = () => {
    if (!start.current) return
    start.current = null
    if (drag.x > SWIPE && suggestion) return accept(suggestion.category)
    if (drag.x < -SWIPE) return next(false)
    if (drag.y < -SWIPE) {
      setDrag({ x: 0, y: 0 })
      return setEditing(current)
    }
    setDrag({ x: 0, y: 0 })
  }

  const total = queue?.length ?? 0
  const done = queue !== null && index >= total

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="max-h-[94dvh] p-0 md:max-w-md" showCloseButton={false}>
          <div className="flex h-full min-h-0 flex-col bg-card md:rounded-2xl">
            <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-1">
              <div>
                <SheetTitle className="font-heading text-lg font-semibold text-foreground">Sort transactions</SheetTitle>
                <SheetDescription className="mt-0.5 text-sm text-muted-foreground">
                  {queue === null ? 'Loading…' : done ? `${sorted} sorted` : `${index + 1} of ${total} without a category`}
                </SheetDescription>
              </div>
              <button type="button" onClick={onClose} className="rounded-full border border-border px-3 py-1.5 text-sm font-semibold text-foreground">
                Done
              </button>
            </div>

            <div data-vaul-no-drag className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
              {queue === null ? (
                <Skeleton className="h-56 rounded-3xl" />
              ) : done ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
                    <Check className="h-6 w-6" />
                  </span>
                  <p className="font-semibold text-foreground">{total === 0 ? 'Nothing to sort' : 'All caught up'}</p>
                  <p className="text-sm text-muted-foreground">
                    {total === 0 ? 'Every transaction has a category.' : `You sorted ${sorted} of ${total}. Skipped ones stay here for next time.`}
                  </p>
                </div>
              ) : (
                <>
                  <div
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    style={{
                      transform: `translate(${drag.x}px, ${Math.min(0, drag.y)}px) rotate(${drag.x / 20}deg)`,
                      transition: start.current ? 'none' : 'transform 200ms ease',
                      touchAction: 'none',
                    }}
                    className={`relative cursor-grab select-none rounded-3xl border-2 bg-background p-5 shadow-ios ${
                      drag.x > SWIPE / 2 && suggestion ? 'border-success' : drag.x < -SWIPE / 2 ? 'border-muted-foreground/40' : drag.y < -SWIPE / 2 ? 'border-primary' : 'border-border'
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {current.type === 'income' ? 'Income' : 'Expense'} · {format(new Date(current.date), 'EEE, MMM d, yyyy')}
                    </p>
                    <p className="mt-2 break-words font-heading text-xl font-semibold text-foreground">{current.description || 'No note'}</p>
                    <p className={`mt-1 font-heading text-3xl font-bold tabular-nums ${current.type === 'income' ? 'text-success' : 'text-foreground'}`}>
                      {current.type === 'income' ? '+' : '-'}
                      {money(Number(current.amount) || 0)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {current.wallet?.name ?? 'Wallet'}
                      {current.affectsBalance === false ? ' · not counted in balance' : ''}
                    </p>
                    <div className="mt-4 rounded-2xl bg-secondary/50 p-3 text-sm">
                      {suggestion ? (
                        <>
                          Suggested: <span className="font-semibold text-foreground">{suggestion.category.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {suggestion.reason === 'rule' ? 'From your rule' : suggestion.reason === 'history' ? 'You used it for this before' : 'From the note'} · swipe right to use it
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">No suggestion. Pick a category below.</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-semibold">
                    <button type="button" onClick={() => next(false)} className="flex flex-col items-center gap-1 rounded-2xl border border-border p-2.5 text-muted-foreground">
                      <ArrowLeft className="h-4 w-4" />
                      Skip
                    </button>
                    <button type="button" onClick={() => setEditing(current)} className="flex flex-col items-center gap-1 rounded-2xl border border-border p-2.5 text-primary">
                      <ArrowUp className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={!suggestion}
                      onClick={() => accept(suggestion?.category)}
                      className="flex flex-col items-center gap-1 rounded-2xl bg-success p-2.5 text-white disabled:opacity-40"
                    >
                      <ArrowRight className="h-4 w-4" />
                      Use it
                    </button>
                  </div>

                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Or pick</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {choices.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => accept(c)}
                        className="rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:border-primary/50"
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>

                  {current.affectsBalance !== false && (
                    <button
                      type="button"
                      onClick={keepBalance}
                      className="mt-4 flex w-full items-center gap-2 rounded-2xl border border-dashed border-border p-3 text-left text-sm text-muted-foreground hover:text-foreground"
                    >
                      <Wallet className="h-4 w-4 shrink-0" />
                      <span>
                        <span className="block font-semibold text-foreground">Already in my balance</span>
                        Keeps it in your history without changing any wallet balance
                      </span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <QuickAddSheet
        open={!!editing}
        onClose={() => setEditing(null)}
        onSuccess={() => {
          setEditing(null)
          next(true)
        }}
        title="Edit transaction"
        transaction={
          editing
            ? {
                id: idOf(editing),
                walletId: editing.walletId,
                toWalletId: editing.toWalletId,
                categoryId: editing.categoryId ?? undefined,
                amount: Number(editing.amount),
                type: editing.type,
                description: editing.description,
                date: editing.date,
                tags: editing.tags,
                attachments: editing.attachments,
                status: editing.status,
                affectsBalance: editing.affectsBalance,
                excludeFromBaseline: editing.excludeFromBaseline,
              }
            : null
        }
      />
    </>
  )
}
