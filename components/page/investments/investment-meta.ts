import { Building2, Bitcoin, Landmark, LineChart, PiggyBank, TrendingUp, Wallet, type LucideIcon } from 'lucide-react'
import type { InvestmentType } from '@/types/investment'

export const INVESTMENT_TYPES: { value: InvestmentType; label: string; icon: LucideIcon; color: string }[] = [
  { value: 'stocks', label: 'Stocks', icon: LineChart, color: '#2563EB' },
  { value: 'mutual_funds', label: 'Mutual funds', icon: TrendingUp, color: '#7C3AED' },
  { value: 'bonds', label: 'Bonds', icon: Landmark, color: '#0D9488' },
  { value: 'crypto', label: 'Crypto', icon: Bitcoin, color: '#F59E0B' },
  { value: 'real_estate', label: 'Real estate', icon: Building2, color: '#DC2626' },
  { value: 'savings', label: 'Savings', icon: PiggyBank, color: '#16A34A' },
  { value: 'other', label: 'Other', icon: Wallet, color: '#64748B' },
]

export const investmentType = (value: InvestmentType) => INVESTMENT_TYPES.find((t) => t.value === value) ?? INVESTMENT_TYPES[INVESTMENT_TYPES.length - 1]

/** Common Philippine places to invest, offered as suggestions only. */
export const PLATFORM_SUGGESTIONS = ['COL Financial', 'BPI Trade', 'GCash GInvest', 'Coins.ph', 'Pag-IBIG MP2', 'Treasury bonds (BTr)']
