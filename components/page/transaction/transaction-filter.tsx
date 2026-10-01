'use client'

import { useState } from 'react'
import { Check, ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react'
import { useTransactionTags } from '@/queries/user/transaction/transaction'

export interface FilterState {
  type?: 'income' | 'expense' | 'transfer' | 'all'
  status?: 'completed' | 'pending' | 'cancelled' | 'all'
  search?: string
  dateRange?: 'today' | 'week' | 'month' | 'year' | 'all'
  walletId?: string
  tags?: string[]
}

export const DEFAULT_FILTERS: FilterState = {
  type: 'all',
  status: 'all',
  dateRange: 'month',
  walletId: '',
  search: '',
  tags: [],
}

interface TransactionFiltersProps {
  value: FilterState
  onChange: (filters: FilterState) => void
  wallets?: { id: string; name?: string }[]
}

const TYPES: { value: NonNullable<FilterState['type']>; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'income', label: 'Money in' },
  { value: 'expense', label: 'Money out' },
  { value: 'transfer', label: 'Transfers' },
]

const RANGES: { value: NonNullable<FilterState['dateRange']>; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All time' },
]

const STATUSES: { value: NonNullable<FilterState['status']>; label: string }[] = [
  { value: 'all', label: 'Any' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'cancelled', label: 'Cancelled' },
]

const labelClass = 'mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground'
const scrollRow = 'flex gap-2 overflow-x-auto px-1 pb-1 -mx-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
const chip = (selected: boolean) =>
  `shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
    selected ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-foreground hover:border-primary/50'
  }`

/** Normalizes the several shapes the tags endpoint has returned over time. */
const toTagList = (response: unknown): string[] => {
  const r = response as any
  if (!r) return []
  if (Array.isArray(r)) return r
  if (Array.isArray(r.tags)) return r.tags
  if (Array.isArray(r.data)) return r.data
  if (Array.isArray(r.data?.tags)) return r.data.tags
  return []
}

export function TransactionFilters({ value, onChange, wallets }: TransactionFiltersProps) {
  const [showMore, setShowMore] = useState(false)
  const { data: tagsResponse } = useTransactionTags()
  const availableTags = toTagList(tagsResponse).map((tag: any) => (typeof tag === 'string' ? tag : tag?.tag)).filter(Boolean) as string[]

  const set = (patch: Partial<FilterState>) => onChange({ ...value, ...patch })
  const toggleTag = (tag: string) => {
    const current = value.tags ?? []
    set({ tags: current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag] })
  }

  const moreCount = (value.status && value.status !== 'all' ? 1 : 0) + (value.tags?.length ?? 0)
  const isFiltered =
    (value.type && value.type !== 'all') ||
    !!value.walletId ||
    !!value.search ||
    moreCount > 0 ||
    (value.dateRange ?? 'month') !== DEFAULT_FILTERS.dateRange

  return (
    <div className="space-y-4 rounded-3xl border border-border bg-card p-4 shadow-ios sm:p-5">
      {/* Search */}
      <div className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 focus-within:ring-2 focus-within:ring-primary">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by note"
          aria-label="Search transactions"
          value={value.search ?? ''}
          onChange={(event) => set({ search: event.target.value })}
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        {value.search && (
          <button type="button" onClick={() => set({ search: '' })} aria-label="Clear search" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Type */}
      <div role="group" aria-label="Transaction type" className="grid grid-cols-4 gap-1 rounded-full bg-secondary p-1">
        {TYPES.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={(value.type ?? 'all') === option.value}
            onClick={() => set({ type: option.value })}
            className={`rounded-full py-2 text-xs font-semibold transition-colors sm:text-sm ${
              (value.type ?? 'all') === option.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* When */}
      <div>
        <p className={labelClass}>When</p>
        <div className={scrollRow} role="group" aria-label="Date range">
          {RANGES.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={(value.dateRange ?? 'month') === option.value}
              onClick={() => set({ dateRange: option.value })}
              className={chip((value.dateRange ?? 'month') === option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Wallet */}
      {wallets && wallets.length > 1 && (
        <div>
          <p className={labelClass}>Wallet</p>
          <div className={scrollRow} role="group" aria-label="Wallet">
            <button type="button" aria-pressed={!value.walletId} onClick={() => set({ walletId: '' })} className={chip(!value.walletId)}>
              All wallets
            </button>
            {wallets.map((wallet) => (
              <button
                key={wallet.id}
                type="button"
                aria-pressed={value.walletId === wallet.id}
                onClick={() => set({ walletId: value.walletId === wallet.id ? '' : wallet.id })}
                className={chip(value.walletId === wallet.id)}
              >
                {wallet.name || 'Wallet'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* More */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            aria-expanded={showMore}
            onClick={() => setShowMore((open) => !open)}
            className="flex items-center gap-1.5 text-sm font-semibold text-primary"
          >
            <SlidersHorizontal className="h-4 w-4" />
            More filters
            {moreCount > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{moreCount}</span>}
            <ChevronDown className={`h-4 w-4 transition-transform ${showMore ? 'rotate-180' : ''}`} />
          </button>
          {isFiltered && (
            <button type="button" onClick={() => onChange(DEFAULT_FILTERS)} className="text-sm font-semibold text-destructive hover:underline">
              Reset
            </button>
          )}
        </div>

        {showMore && (
          <div className="mt-3 space-y-4">
            <div>
              <p className={labelClass}>Status</p>
              <div className={scrollRow} role="group" aria-label="Status">
                {STATUSES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={(value.status ?? 'all') === option.value}
                    onClick={() => set({ status: option.value })}
                    className={chip((value.status ?? 'all') === option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {availableTags.length > 0 && (
              <div>
                <p className={labelClass}>Tags</p>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => {
                    const selected = !!value.tags?.includes(tag)
                    return (
                      <button key={tag} type="button" aria-pressed={selected} onClick={() => toggleTag(tag)} className={`${chip(selected)} flex items-center gap-1`}>
                        {selected && <Check className="h-3.5 w-3.5" />}
                        {tag}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
