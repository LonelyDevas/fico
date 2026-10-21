import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { Goal } from '@/types/goal'

export interface GoalWallet {
  id: string
  name: string
  type: string
  balance: number
}

export interface GoalProgress {
  wallets: GoalWallet[]
  /** True when no wallets are linked, so every savings wallet counts. */
  usesAllSavings: boolean
  saved: number
  remaining: number
  pct: number
  reached: boolean
  daysLeft: number | null
  monthsLeft: number | null
  monthlyNeeded: number | null
}

const DAYS_PER_MONTH = 365.25 / 12

/**
 * Saved so far is the live balance of the linked wallets, or of every savings wallet when none are
 * linked. Same rule as the goals_progress tool in fico-api/mcp, so the app and Claude agree.
 */
export function goalProgress(goal: Goal, wallets: GoalWallet[]): GoalProgress {
  const linked = goal.linkedWalletIds ?? []
  const counted = linked.length ? wallets.filter((w) => linked.includes(w.id)) : wallets.filter((w) => w.type === 'savings')
  const target = Number(goal.targetAmount) || 0
  const saved = counted.reduce((sum, w) => sum + w.balance, 0)
  const remaining = Math.max(0, target - saved)
  const daysLeft = goal.deadline ? differenceInCalendarDays(parseISO(goal.deadline), new Date()) : null
  const monthsLeft = daysLeft === null ? null : Math.max(0, daysLeft) / DAYS_PER_MONTH
  return {
    wallets: counted,
    usesAllSavings: linked.length === 0,
    saved,
    remaining,
    pct: target > 0 ? Math.min(100, (saved / target) * 100) : 0,
    reached: target > 0 && remaining === 0,
    daysLeft,
    monthsLeft,
    // Under a month left means the whole remainder is due now.
    monthlyNeeded: monthsLeft === null ? null : remaining / Math.max(1, monthsLeft),
  }
}

/** Wallets that can hold savings for a goal: everything but credit cards. */
export const asGoalWallets = (data: any): GoalWallet[] => {
  const list: any[] = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
  return list
    .filter((w) => w.status !== 'archived' && w.type !== 'credit_card')
    .map((w) => ({ id: String(w._id ?? w.id), name: w.name, type: w.type, balance: Number(w.balance) || 0 }))
}
