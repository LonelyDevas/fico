'use client'

import { Archive, ArrowDownLeft, ArrowUpRight, Banknote, CreditCard, MoreHorizontal, Pencil, PiggyBank, Smartphone, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { InstitutionLogo } from '@/components/ui/institution-logo'
import { getInstitution } from '@/lib/ph-institutions'

interface WalletCardProps {
  id: string
  name: string
  type: 'bank' | 'savings' | 'cash' | 'ewallet' | 'credit_card' | 'other'
  balance: number
  currency: string
  color?: string
  icon?: string
  accountNumber?: string
  institution?: string
  creditLimit?: number
  dueDay?: number
  interestRate?: number
  interestPayout?: string
  interestTaxRate?: number
  maturityDate?: string
  totalInterestEarned?: number
  status: 'active' | 'archived'
  /** Overrides the "hide amounts on open" setting, so a page-level toggle can control every card. */
  hideAmounts?: boolean
  onEdit?: (id: string) => void
  onArchive?: (id: string) => void
  onTransfer?: (id: string) => void
  onReceive?: (id: string) => void
}

const TYPE_ICON = {
  bank: CreditCard,
  savings: PiggyBank,
  cash: Banknote,
  ewallet: Smartphone,
  credit_card: CreditCard,
  other: Wallet,
} as const

const PAYOUT_WORD: Record<string, string> = {
  monthly: 'monthly',
  quarterly: 'quarterly',
  annually: 'yearly',
  maturity: 'at maturity',
}

/** Light brand colors (lime, yellow) need dark text to stay readable. */
const isLight = (hex: string) => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!m) return false
  const [r, g, b] = [m[1], m[2], m[3]].map((v) => parseInt(v, 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.62
}

export function WalletCard({
  id,
  name,
  type,
  balance,
  currency,
  color = '#0066CC',
  institution,
  creditLimit,
  dueDay,
  interestRate,
  interestPayout,
  interestTaxRate,
  totalInterestEarned = 0,
  status,
  hideAmounts,
  onEdit,
  onArchive,
  onTransfer,
  onReceive,
}: WalletCardProps) {
  const { hideAmountsOnOpen } = useSettingsStore()
  const [hiddenLocal, setHiddenLocal] = useState(hideAmountsOnOpen)
  const [showMenu, setShowMenu] = useState(false)

  useEffect(() => {
    setHiddenLocal(hideAmountsOnOpen)
  }, [hideAmountsOnOpen])

  const hidden = hideAmounts ?? hiddenLocal
  const money = (value: number) => formatMoney(value, currency, hidden)
  const known = getInstitution(institution)
  const TypeIcon = TYPE_ICON[type]
  const archived = status === 'archived'

  const dark = isLight(color)
  const text = dark ? 'text-[#0F1419]' : 'text-white'
  const soft = dark ? 'text-[#0F1419]/65' : 'text-white/75'
  const track = dark ? 'bg-black/15' : 'bg-white/30'
  const fill = dark ? 'bg-[#0F1419]/70' : 'bg-white'

  const isCard = type === 'credit_card'
  const hasLimit = isCard && !!creditLimit && creditLimit > 0
  const usedPct = hasLimit ? Math.min(100, Math.max(0, (balance / (creditLimit as number)) * 100)) : 0
  const isSavings = type === 'savings'
  const putIn = Math.max(0, balance - totalInterestEarned)

  const kindLabel = isCard ? 'Credit' : type === 'cash' ? 'Cash' : type === 'other' ? 'Other' : 'Debit'
  const subtitle = [
    kindLabel,
    currency,
    isCard && dueDay ? `due day ${dueDay}` : null,
    isSavings && interestRate ? `${interestRate}% ${PAYOUT_WORD[interestPayout ?? 'monthly'] ?? 'yearly'}` : null,
  ]
    .filter(Boolean)
    .join(' • ')

  void interestTaxRate

  return (
    <div
      className={`group relative flex min-h-[10.5rem] flex-col overflow-hidden rounded-3xl p-4 shadow-ios transition-shadow hover:shadow-ios-lg ${text}`}
      style={{ backgroundColor: color }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/15" aria-hidden="true" />

      <div className="relative flex items-start gap-2.5">
        {known ? (
          <InstitutionLogo institution={known} variant="glass" className="size-10 rounded-xl" />
        ) : (
          <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${dark ? 'bg-black/10' : 'bg-white/20'}`}>
            <TypeIcon className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="truncate text-sm font-semibold leading-tight">{name}</h3>
          <p className={`mt-0.5 truncate text-[11px] ${soft}`}>{subtitle}</p>
        </div>

        {!archived && (
          <div className="relative -mr-1.5 -mt-1">
            <button
              type="button"
              onClick={() => setShowMenu((open) => !open)}
              aria-label={`${name} actions`}
              className="rounded-full p-1.5 opacity-80 hover:bg-black/10 hover:opacity-100"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 z-50 mt-1 w-44 overflow-hidden rounded-2xl border border-border bg-card py-1 text-foreground shadow-ios-lg">
                  {[
                    { label: 'Edit', icon: Pencil, run: onEdit },
                    { label: 'Send money', icon: ArrowUpRight, run: onTransfer },
                    { label: 'Receive money', icon: ArrowDownLeft, run: onReceive },
                  ].map(({ label, icon: Icon, run }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        run?.(id)
                        setShowMenu(false)
                      }}
                      className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm hover:bg-secondary"
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                  <hr className="my-1 border-border" />
                  <button
                    type="button"
                    onClick={() => {
                      onArchive?.(id)
                      setShowMenu(false)
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-destructive hover:bg-secondary"
                  >
                    <Archive className="h-4 w-4" />
                    Archive
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="relative mt-auto pt-5">
        {hasLimit ? (
          <>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${soft}`}>Used credit</span>
              <div className={`h-1.5 flex-1 overflow-hidden rounded-full ${track}`}>
                <div className={`h-full rounded-full ${fill}`} style={{ width: `${usedPct}%` }} />
              </div>
            </div>
            <div className={`mt-1 flex justify-between text-[11px] ${soft}`}>
              <span>{usedPct.toFixed(0)}% used</span>
              <span className="tabular-nums">{money(Math.max(0, (creditLimit as number) - balance))} left</span>
            </div>
          </>
        ) : (
          <p className={`text-[10px] font-semibold uppercase tracking-wider ${soft}`}>{isCard ? 'Used credit' : 'Balance'}</p>
        )}
        <p className="mt-0.5 truncate font-heading text-xl font-bold tabular-nums">{money(balance)}</p>
        {isSavings && totalInterestEarned > 0 && (
          <p className={`mt-0.5 truncate text-[11px] tabular-nums ${soft}`}>
            Put in {money(putIn)} · Earned {money(totalInterestEarned)}
          </p>
        )}
      </div>

      {archived && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-muted-foreground shadow-ios">Archived</span>
        </div>
      )}
    </div>
  )
}
