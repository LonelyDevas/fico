import type { InterestPayout } from '@/types/wallet'

export interface SavingsPreset {
  id: string
  label: string
  hint: string
  /** Starting values only. Rates change, so the user edits them to match their account. */
  rate: number
  payout: InterestPayout
  taxRate: number
  /** Fixed-term products end after this many months. */
  termMonths?: number
  /** Catalog institution to preselect. */
  institution?: string
}

export const SAVINGS_PRESETS: SavingsPreset[] = [
  { id: 'regular', label: 'Regular savings', hint: 'Bank passbook / ATM account', rate: 0.25, payout: 'quarterly', taxRate: 20 },
  { id: 'high-yield', label: 'High-yield', hint: 'Digital bank savings', rate: 4, payout: 'monthly', taxRate: 20 },
  { id: 'mp2', label: 'Pag-IBIG MP2', hint: '5-year, dividends tax-free', rate: 6.5, payout: 'annually', taxRate: 0, termMonths: 60, institution: 'pagibig' },
  { id: 'time-deposit', label: 'Time deposit', hint: 'Fixed term, paid at maturity', rate: 3.5, payout: 'maturity', taxRate: 20, termMonths: 12 },
  { id: 'custom', label: 'Custom', hint: 'Set every rule yourself', rate: 0, payout: 'monthly', taxRate: 0 },
]

export const PAYOUT_OPTIONS: { value: InterestPayout; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Yearly' },
  { value: 'maturity', label: 'At maturity' },
]

/** Rough yearly interest after tax, ignoring compounding. */
export const estimateYearlyInterest = (balance: number, ratePct: number, taxPct: number) =>
  balance * (ratePct / 100) * (1 - taxPct / 100)
