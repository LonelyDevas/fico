// Past-period reports. The reports_* RPCs always count back from "now", so
// when the user steps back a week/month/etc. we read that window's completed
// transactions (RLS-scoped) and build the same response shapes client-side.

import { addDays, addMonths, addWeeks, addYears, format, getDaysInMonth, startOfDay, startOfMonth, startOfWeek, startOfYear } from 'date-fns'
import { supabase } from '@/utils/supabase-client'

export type ShiftablePeriod = 'today' | 'week' | 'month' | 'year'

export const isShiftablePeriod = (period: string): period is ShiftablePeriod =>
  period === 'today' || period === 'week' || period === 'month' || period === 'year'

/** Half-open window [start, end) for the period `offset` steps from the current one. */
export function getPeriodRange(period: ShiftablePeriod, offset: number): { start: Date; end: Date } {
  const now = new Date()
  switch (period) {
    case 'today': {
      const start = addDays(startOfDay(now), offset)
      return { start, end: addDays(start, 1) }
    }
    case 'week': {
      const start = addWeeks(startOfWeek(now, { weekStartsOn: 1 }), offset)
      return { start, end: addWeeks(start, 1) }
    }
    case 'month': {
      const start = addMonths(startOfMonth(now), offset)
      return { start, end: addMonths(start, 1) }
    }
    case 'year': {
      const start = addYears(startOfYear(now), offset)
      return { start, end: addYears(start, 1) }
    }
  }
}

/** Human label for the window, e.g. "This week", "Last month", "Sep 29 – Oct 5, 2026". */
export function describePeriod(period: string, offset = 0): string {
  if (period === 'all') return 'All time'
  if (!isShiftablePeriod(period)) return `This ${period}`
  if (offset === 0) return period === 'today' ? 'Today' : `This ${period}`
  if (offset === -1) return period === 'today' ? 'Yesterday' : `Last ${period}`
  const { start, end } = getPeriodRange(period, offset)
  switch (period) {
    case 'today':
      return format(start, 'EEE, MMM d, yyyy')
    case 'week':
      return `${format(start, 'MMM d')} – ${format(addDays(end, -1), 'MMM d, yyyy')}`
    case 'month':
      return format(start, 'MMMM yyyy')
    case 'year':
      return format(start, 'yyyy')
  }
}

type RangeRow = {
  type: 'income' | 'expense' | 'transfer'
  amount: number | string
  date: string
  category_id: string | null
  category: { name: string; icon?: string | null; color?: string | null } | null
}

const PAGE = 1000
const round2 = (n: number) => Math.round(n * 100) / 100

export async function fetchRangeRows(period: ShiftablePeriod, offset: number, walletId?: string): Promise<RangeRow[]> {
  const { start, end } = getPeriodRange(period, offset)
  const rows: RangeRow[] = []
  for (let from = 0; ; from += PAGE) {
    let query = supabase
      .from('transactions')
      .select('type,amount,date,category_id,category:categories(name,icon,color)')
      .eq('status', 'completed')
      .gte('date', start.toISOString())
      .lt('date', end.toISOString())
      .order('date', { ascending: true })
      .range(from, from + PAGE - 1)
    if (walletId) query = query.eq('wallet_id', walletId)
    const { data, error } = await query
    if (error) throw error
    rows.push(...((data ?? []) as unknown as RangeRow[]))
    if (!data || data.length < PAGE) break
  }
  return rows
}

const sumByType = (rows: RangeRow[]) => {
  const totals = { income: 0, expenses: 0, transfers: 0 }
  for (const r of rows) {
    const amount = Number(r.amount) || 0
    if (r.type === 'income') totals.income += amount
    else if (r.type === 'expense') totals.expenses += amount
    else if (r.type === 'transfer') totals.transfers += amount
  }
  return totals
}

export function buildQuickStats(rows: RangeRow[], period: ShiftablePeriod, offset: number) {
  const { start, end } = getPeriodRange(period, offset)
  const t = sumByType(rows)
  return {
    period,
    income: round2(t.income),
    expenses: round2(t.expenses),
    transfers: round2(t.transfers),
    transactions: rows.length,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  }
}

export function buildChartData(rows: RangeRow[], period: ShiftablePeriod, offset: number) {
  const { start, end } = getPeriodRange(period, offset)

  // Same slot labels the reports_chart_data RPC emits for each period.
  let slots: { key: string; label: Record<string, string | number> }[]
  let slotOf: (d: Date) => number
  switch (period) {
    case 'today':
      slots = Array.from({ length: 24 }, (_, hour) => ({ key: String(hour), label: { hour } }))
      slotOf = (d) => d.getHours()
      break
    case 'week':
      slots = Array.from({ length: 7 }, (_, i) => ({ key: String(i), label: { day: format(addDays(start, i), 'EEEE') } }))
      slotOf = (d) => (d.getDay() + 6) % 7 // Monday-first
      break
    case 'month':
      slots = Array.from({ length: getDaysInMonth(start) }, (_, i) => ({ key: String(i), label: { date: `${format(start, 'MMM')}.${i + 1}` } }))
      slotOf = (d) => d.getDate() - 1
      break
    case 'year':
      slots = Array.from({ length: 12 }, (_, i) => ({ key: String(i), label: { month: format(new Date(start.getFullYear(), i, 1), 'MMMM') } }))
      slotOf = (d) => d.getMonth()
      break
  }

  const buckets = slots.map(() => ({ income: 0, expenses: 0, transfers: 0 }))
  for (const r of rows) {
    const bucket = buckets[slotOf(new Date(r.date))]
    if (!bucket) continue
    const amount = Number(r.amount) || 0
    if (r.type === 'income') bucket.income += amount
    else if (r.type === 'expense') bucket.expenses += amount
    else if (r.type === 'transfer') bucket.transfers += amount
  }

  const dataPoints = slots.map((slot, i) => ({
    ...slot.label,
    income: round2(buckets[i].income),
    expenses: round2(buckets[i].expenses),
    transfers: round2(buckets[i].transfers),
  }))
  const t = sumByType(rows)
  return {
    period,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    dataPoints,
    totals: { income: round2(t.income), expenses: round2(t.expenses), transfers: round2(t.transfers) },
  }
}

export function buildCategoryBreakdown(rows: RangeRow[], type: 'income' | 'expense' | 'transfer') {
  const groups = new Map<string, { categoryId: string | null; name: string; icon: string | null; color: string | null; total: number; count: number }>()
  for (const r of rows) {
    if (r.type !== type) continue
    const key = r.category_id ?? 'none'
    const g = groups.get(key) ?? { categoryId: r.category_id, name: r.category?.name ?? 'Uncategorized', icon: r.category?.icon ?? null, color: r.category?.color ?? null, total: 0, count: 0 }
    g.total += Number(r.amount) || 0
    g.count += 1
    groups.set(key, g)
  }
  const sorted = [...groups.values()].sort((a, b) => b.total - a.total)
  const totalAmount = sorted.reduce((s, g) => s + g.total, 0)
  return {
    breakdown: sorted.map((g) => ({
      categoryId: g.categoryId,
      categoryName: g.name,
      categoryIcon: g.icon,
      categoryColor: g.color,
      total: g.total,
      count: g.count,
      percentage: totalAmount > 0 ? round2((g.total / totalAmount) * 100) : 0,
    })),
    totalAmount,
    transactionCount: sorted.reduce((s, g) => s + g.count, 0),
  }
}
