'use client'

import { useMemo } from 'react'
import { useListWallets } from '@/queries/user/wallet/wallets'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { chipClass, scrollRowClass } from '@/components/ui/form-sheet'

interface WalletPickerProps {
  value: string
  onChange: (walletId: string) => void
  /** Adds a chip that clears the choice (for wallets that are optional). */
  noneLabel?: string
}

const asList = (data: any): any[] => (Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [])

/** Row of wallet chips. Credit cards show what is left of the limit instead of a balance. */
export function WalletPicker({ value, onChange, noneLabel }: WalletPickerProps) {
  const { currency, hideAmountsOnOpen } = useSettingsStore()
  const { data } = useListWallets()
  const wallets = useMemo(() => asList(data?.data).filter((w) => w.status !== 'archived'), [data])

  if (wallets.length === 0) return <p className="text-sm text-muted-foreground">Create a wallet first.</p>

  return (
    <div className={scrollRowClass} role="group" aria-label="Wallet">
      {noneLabel && (
        <button type="button" aria-pressed={value === ''} onClick={() => onChange('')} className={chipClass(value === '')}>
          {noneLabel}
        </button>
      )}
      {wallets.map((wallet) => {
        const id = String(wallet._id ?? wallet.id)
        const isCard = wallet.type === 'credit_card' && wallet.creditLimit
        const amount = isCard
          ? `${formatMoney(Math.max(0, Number(wallet.creditLimit) - Number(wallet.balance ?? 0)), wallet.currency || currency, hideAmountsOnOpen)} left`
          : formatMoney(Number(wallet.balance ?? 0), wallet.currency || currency, hideAmountsOnOpen)
        return (
          <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)} className={chipClass(value === id)}>
            {wallet.name}
            <span className="ml-1.5 text-xs opacity-70">{amount}</span>
          </button>
        )
      })}
    </div>
  )
}
