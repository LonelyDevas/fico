import { differenceInCalendarDays, addDays, addMonths, addWeeks, addYears, format, parseISO, startOfDay } from 'date-fns'

export type LedgerWallet = {
  id: string
  name: string
  type: string
  balance: number
  status?: string
  createdAt?: string
}

export type LedgerTxn = {
  walletId: string
  toWalletId?: string | null
  amount: number
  type: 'income' | 'expense' | 'transfer'
  serviceFee?: number
  serviceFeeDeducted?: boolean
  billId?: string | null
  categoryId?: string | null
  date: string
}

export type ForecastBudget = {
  id: string
  name: string
  amount: number
  spent: number
  startDate: string
  endDate: string
  /** Empty means the budget covers every expense. */
  categoryIds: string[]
}

export type ForecastBill = {
  id: string
  type: 'bill' | 'income'
  name: string
  amount: number
  paidAmount?: number
  dueDate: string
  isRecurring: boolean
  recurringFrequency?: 'daily' | 'weekly' | 'monthly' | 'yearly'
  walletId?: string | null
  paymentStatus: string
}

const isCard = (type: string) => type === 'credit_card'

/** Change to a wallet from one transaction, with "money in" positive. */
const walletDelta = (txn: LedgerTxn, walletId: string): number => {
  const amount = Number(txn.amount) || 0
  if (txn.type === 'income') return txn.walletId === walletId ? amount : 0
  if (txn.type === 'expense') return txn.walletId === walletId ? -amount : 0
  const fee = txn.serviceFeeDeducted ? Number(txn.serviceFee) || 0 : 0
  if (txn.walletId === walletId) return -(amount + fee)
  if (txn.toWalletId === walletId) return amount
  return 0
}

export type WalletSnapshot = {
  wallet: LedgerWallet
  /** Null when the wallet did not exist yet on that date. */
  balance: number | null
}

/**
 * Rebuilds what each wallet held at the end of `asOf` by undoing every
 * completed transaction made after it. `txnsAfter` must only contain
 * completed transactions dated after `asOf`.
 */
export function balancesAt(wallets: LedgerWallet[], txnsAfter: LedgerTxn[], asOf: Date): WalletSnapshot[] {
  return wallets.map((wallet) => {
    const net = txnsAfter.reduce((sum, txn) => sum + walletDelta(txn, wallet.id), 0)
    // A credit card balance is the amount owed, so money in lowers it.
    const storedChange = isCard(wallet.type) ? -net : net
    const created = wallet.createdAt ? new Date(wallet.createdAt) : null
    const existed = !created || created.getTime() <= asOf.getTime()
    return {
      wallet,
      balance: existed ? round2(Number(wallet.balance) - storedChange) : null,
    }
  })
}

/** The n-th occurrence after `date`, counted from the original date so month ends do not drift. */
const occurrence = (date: Date, frequency: ForecastBill['recurringFrequency'], n: number): Date => {
  switch (frequency) {
    case 'daily':
      return addDays(date, n)
    case 'weekly':
      return addWeeks(date, n)
    case 'yearly':
      return addYears(date, n)
    default:
      return addMonths(date, n)
  }
}

export type ForecastEvent = {
  date: Date
  name: string
  /** Signed effect on cash: negative for bills, positive for income. */
  amount: number
  kind: 'bill' | 'income'
}

export type ForecastPoint = {
  date: string
  label: string
  balance: number
}

export type TypicalFlow = { dailyIncome: number; dailySpend: number }

/** Average everyday income and spending that is not tied to a bill. */
export function typicalFlow(
  txns: LedgerTxn[],
  cashWalletIds: Set<string>,
  days: number,
  /** Expenses in these categories are left out (a budget already plans them); 'all' leaves out every expense. */
  budgeted?: Set<string> | 'all'
): TypicalFlow {
  let income = 0
  let spend = 0
  const now = Date.now()
  for (const txn of txns) {
    if (new Date(txn.date).getTime() > now) continue
    if (txn.billId || !cashWalletIds.has(txn.walletId)) continue
    if (txn.type === 'income') income += Number(txn.amount) || 0
    else if (txn.type === 'expense') {
      if (budgeted === 'all' || (budgeted && txn.categoryId && budgeted.has(txn.categoryId))) continue
      spend += Number(txn.amount) || 0
    }
  }
  return { dailyIncome: income / days, dailySpend: spend / days }
}

export type Forecast = {
  points: ForecastPoint[]
  events: ForecastEvent[]
  startBalance: number
  endBalance: number
  totalBills: number
  totalIncome: number
  /** Planned spending from budgets over the horizon, by budget. */
  budgetSpend: { name: string; total: number }[]
  lowest: ForecastPoint
  /** First day the projected cash drops below zero, if it does. */
  shortfallDate: string | null
}

export function buildForecast(input: {
  startingCash: number
  bills: ForecastBill[]
  /** Wallet types by id, to leave out bills charged to a credit card. */
  walletTypes: Record<string, string>
  horizonDays: number
  typical?: TypicalFlow
  budgets?: ForecastBudget[]
  today?: Date
}): Forecast {
  const today = startOfDay(input.today ?? new Date())
  const end = addDays(today, input.horizonDays)
  const events: ForecastEvent[] = []

  for (const bill of input.bills) {
    if (bill.paymentStatus === 'paid' || bill.paymentStatus === 'received') continue
    if (bill.walletId && isCard(input.walletTypes[bill.walletId] ?? '')) continue

    const isIncome = bill.type === 'income'
    const sign = isIncome ? 1 : -1
    const remaining = Math.max(0, Number(bill.amount) - (Number(bill.paidAmount) || 0))
    const due = startOfDay(parseISO(bill.dueDate))

    // Already late: it will land the day you settle it, so count it today.
    const first = due < today ? today : due
    if (first <= end && remaining > 0) {
      events.push({ date: first, name: bill.name, amount: sign * remaining, kind: isIncome ? 'income' : 'bill' })
    }

    if (bill.isRecurring && bill.recurringFrequency) {
      let n = 1
      let next = occurrence(due, bill.recurringFrequency, n)
      // Skip occurrences that already passed; they are not coming back.
      while (next < today) next = occurrence(due, bill.recurringFrequency, ++n)
      while (next <= end) {
        events.push({ date: next, name: bill.name, amount: sign * Number(bill.amount), kind: isIncome ? 'income' : 'bill' })
        next = occurrence(due, bill.recurringFrequency, ++n)
      }
    }
  }

  events.sort((a, b) => a.date.getTime() - b.date.getTime())

  const dailyNet = input.typical ? input.typical.dailyIncome - input.typical.dailySpend : 0
  const byDay = new Map<string, number>()
  for (const event of events) {
    const key = format(event.date, 'yyyy-MM-dd')
    byDay.set(key, (byDay.get(key) ?? 0) + event.amount)
  }

  const budgetTotals = new Map<string, number>()
  const budgetOn = (day: Date) => {
    let total = 0
    for (const b of input.budgets ?? []) {
      const s = startOfDay(parseISO(b.startDate))
      const e = startOfDay(parseISO(b.endDate))
      const len = Math.max(1, differenceInCalendarDays(e, s) + 1)
      let rate = 0
      if (day < s) rate = 0
      else if (day > e) rate = Number(b.amount) / len // assume it renews for another period
      else if (s > today) rate = Number(b.amount) / len
      else rate = Math.max(0, Number(b.amount) - Number(b.spent)) / (differenceInCalendarDays(e, today) + 1)
      budgetTotals.set(b.name, (budgetTotals.get(b.name) ?? 0) + rate)
      total += rate
    }
    return total
  }

  const points: ForecastPoint[] = []
  let balance = input.startingCash
  let shortfallDate: string | null = null
  for (let i = 0; i <= input.horizonDays; i++) {
    const day = addDays(today, i)
    const key = format(day, 'yyyy-MM-dd')
    if (i > 0) balance += dailyNet
    if (i > 0) balance -= budgetOn(day)
    balance += byDay.get(key) ?? 0
    const point = { date: key, label: format(day, 'MMM d'), balance: round2(balance) }
    points.push(point)
    if (shortfallDate === null && point.balance < 0) shortfallDate = key
  }

  const lowest = points.reduce((min, p) => (p.balance < min.balance ? p : min), points[0])
  const sum = (kind: ForecastEvent['kind']) => events.filter((e) => e.kind === kind).reduce((s, e) => s + Math.abs(e.amount), 0)

  return {
    points,
    events,
    startBalance: round2(input.startingCash),
    endBalance: points[points.length - 1].balance,
    totalBills: round2(sum('bill')),
    totalIncome: round2(sum('income')),
    budgetSpend: [...budgetTotals].map(([name, total]) => ({ name, total: round2(total) })),
    lowest,
    shortfallDate,
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100
