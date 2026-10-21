'use client'

import { useState } from 'react'
import { format, differenceInCalendarDays, parseISO } from 'date-fns'
import { ArrowDownLeft, ArrowUpRight, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import type { PlannedItem } from '@/types/planned-item'

interface PlannedItemCardProps {
  item: PlannedItem
  hideAmounts: boolean
  onEdit: (item: PlannedItem) => void
  onDelete: (item: PlannedItem) => void
}

/** "₱5,000.00" when both estimates match, otherwise "₱5,000.00 – ₱8,000.00". */
export const formatRange = (low: number, high: number, currency: string, hidden: boolean) =>
  low === high ? formatMoney(low, currency, hidden) : `${formatMoney(low, currency, hidden)} – ${formatMoney(high, currency, hidden)}`

export function PlannedItemCard({ item, hideAmounts, onEdit, onDelete }: PlannedItemCardProps) {
  const { currency } = useSettingsStore()
  const [menu, setMenu] = useState(false)
  const isIncome = item.type === 'income'
  const confirmed = item.status === 'confirmed'

  const date = parseISO(item.date)
  const days = differenceInCalendarDays(date, new Date())
  const passed = days < 0
  const when = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : !passed && days <= 7 ? `In ${days} days` : format(date, 'MMM d, yyyy')

  const accent = isIncome ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'

  return (
    <article className={`min-w-0 rounded-3xl border border-border bg-card p-4 shadow-ios ${passed ? 'opacity-70' : ''}`}>
      <div className="flex items-start gap-3">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${accent}`}>
          {isIncome ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-foreground">{item.name}</h3>
          <p className="truncate text-xs text-muted-foreground">
            {isIncome ? 'Coming in' : 'Going out'}
            {item.category?.name ? ` · ${item.category.name}` : ''}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${confirmed ? 'bg-success/15 text-success' : 'bg-secondary text-muted-foreground'}`}>
          {confirmed ? 'Confirmed' : 'Expected'}
        </span>
        <div className="relative -mr-1">
          <button type="button" onClick={() => setMenu((v) => !v)} aria-label={`${item.name} actions`} className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary">
            <MoreHorizontal className="h-5 w-5" />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
              <div className="absolute right-0 z-50 mt-1 w-40 overflow-hidden rounded-2xl border border-border bg-card py-1 shadow-ios-lg">
                <button type="button" onClick={() => { setMenu(false); onEdit(item) }} className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm hover:bg-secondary">
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
                <button type="button" onClick={() => { setMenu(false); onDelete(item) }} className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-destructive hover:bg-secondary">
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{item.amountLow === item.amountHigh ? 'Amount' : 'Between'}</p>
          <p className={`truncate font-heading text-xl font-bold tabular-nums ${isIncome ? 'text-success' : 'text-foreground'}`}>
            {formatRange(item.amountLow, item.amountHigh, currency, hideAmounts)}
          </p>
        </div>
        <p className="shrink-0 pb-1 text-xs tabular-nums text-muted-foreground">{when}</p>
      </div>

      {item.notes && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{item.notes}</p>}
    </article>
  )
}
