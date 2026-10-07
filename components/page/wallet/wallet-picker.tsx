'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useListWallets } from '@/queries/user/wallet/wallets'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { chipClass, scrollBleedClass } from '@/components/ui/form-sheet'
import { Skeleton } from '@/components/ui/skeleton'

interface WalletPickerProps {
  value: string
  onChange: (walletId: string) => void
  /** Adds a chip that clears the choice (for wallets that are optional). */
  noneLabel?: string
  /** The money is going out of this wallet (a payment). Savings wallets are left out. */
  payFrom?: boolean
}

const asList = (data: any): any[] => (Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [])

/** Row of wallet chips. Credit cards show what is left of the limit instead of a balance. */
export function WalletPicker({ value, onChange, noneLabel, payFrom }: WalletPickerProps) {
  const { currency, hideAmountsOnOpen } = useSettingsStore()
  const { data, isLoading } = useListWallets()
  const allWallets = useMemo(() => asList(data?.data).filter((w) => w.status !== 'archived'), [data])
  // Money paid out can't come straight from a savings wallet: it has to be transferred first.
  const wallets = useMemo(() => (payFrom ? allWallets.filter((w) => w.type !== 'savings') : allWallets), [allWallets, payFrom])
  const hiddenSavings = allWallets.length - wallets.length
  const rowRef = useRef<HTMLDivElement>(null)

  // A savings wallet remembered from before (say, saved on the debt) can no longer be the payer.
  useEffect(() => {
    if (!payFrom || !value) return
    if (allWallets.some((w) => String(w._id ?? w.id) === value && w.type === 'savings')) onChange('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payFrom, value, allWallets])

  // Bring the selected wallet to the middle of the row (or start at the left if none is picked).
  useEffect(() => {
    const row = rowRef.current
    if (!row) return
    const selected = row.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!selected) {
      row.scrollLeft = 0
      return
    }
    row.scrollLeft = Math.max(0, selected.offsetLeft - (row.clientWidth - selected.offsetWidth) / 2)
  }, [value, wallets.length, isLoading])

  if (isLoading) {
    return (
      <div className={scrollBleedClass} aria-label="Loading wallets">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-10 w-28 shrink-0 rounded-full" />
        ))}
      </div>
    )
  }

  if (wallets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {hiddenSavings > 0 ? 'Savings wallets can\u2019t pay directly. Transfer the money to another wallet first.' : 'Create a wallet first.'}
      </p>
    )
  }

  return (
    <>
    <div ref={rowRef} className={`relative ${scrollBleedClass}`} role="group" aria-label="Wallet">
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
    {payFrom && hiddenSavings > 0 && <p className="mt-1.5 text-xs text-muted-foreground">{'Savings wallets can\u2019t pay directly. Transfer the money to another wallet first.'}</p>}
    </>
  )
}
