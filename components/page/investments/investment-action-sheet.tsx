'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { WalletPicker } from '@/components/page/wallet/wallet-picker'
import { Field, FormSheet, fieldClass, MoneyField } from '@/components/ui/form-sheet'
import { useRecordInvestmentReturn, useSellInvestment, useUpdateInvestmentValue } from '@/queries/user/investment/investments'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import type { Investment } from '@/types/investment'

export type InvestmentAction = 'value' | 'return' | 'sell'

interface InvestmentActionSheetProps {
  action: InvestmentAction | null
  investment: Investment | null
  onClose: () => void
}

const COPY: Record<InvestmentAction, { title: string; amount: string; submit: string; done: string; wallet?: string }> = {
  value: { title: 'Update value', amount: 'Current value', submit: 'Save value', done: 'Value updated' },
  return: { title: 'Add a return', amount: 'Amount received', submit: 'Record return', done: 'Return recorded', wallet: 'Received into' },
  sell: { title: 'Sell', amount: 'Sale amount', submit: 'Sell investment', done: 'Investment sold', wallet: 'Proceeds go into' },
}

/** One small sheet for the three things you do to an existing investment: re-value it, log a payout, or sell it. */
export function InvestmentActionSheet({ action, investment, onClose }: InvestmentActionSheetProps) {
  const { currency } = useSettingsStore()
  const { mutate: updateValue, isPending: valuing } = useUpdateInvestmentValue()
  const { mutate: recordReturn, isPending: returning } = useRecordInvestmentReturn()
  const { mutate: sell, isPending: selling } = useSellInvestment()
  const [amount, setAmount] = useState('')
  const [walletId, setWalletId] = useState('')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!action || !investment) return
    setAmount(action === 'return' ? '' : String(investment.currentValue))
    setWalletId(investment.walletId ?? '')
    setDate(new Date().toISOString().slice(0, 10))
    setNote('')
  }, [action, investment])

  if (!action || !investment) return null
  const copy = COPY[action]
  const amountNum = Number(amount) || 0

  const submit = () => {
    if (amountNum <= 0) return void toast.error('Enter an amount')
    if (copy.wallet && !walletId) return void toast.error('Pick a wallet')
    const common = { id: investment.id, date: date ? new Date(date).toISOString() : undefined, notes: note.trim() || undefined }
    const done = { onSuccess: () => { toast.success(copy.done); onClose() } }

    if (action === 'value') updateValue({ ...common, value: amountNum }, done)
    else if (action === 'return') recordReturn({ ...common, amount: amountNum, walletId }, done)
    else sell({ ...common, saleAmount: amountNum, walletId }, done)
  }

  const gain = action === 'sell' ? amountNum - investment.principalAmount : 0

  return (
    <FormSheet
      open
      onClose={onClose}
      title={`${copy.title}: ${investment.name}`}
      description="Update this investment."
      submitLabel={copy.submit}
      onSubmit={submit}
      busy={valuing || returning || selling}
    >
      <p className="text-sm text-muted-foreground">
        Put in {formatMoney(investment.principalAmount, currency, false)} · worth {formatMoney(investment.currentValue, currency, false)} now
      </p>
      <Field label={copy.amount}>
        <MoneyField value={amount} onChange={setAmount} ariaLabel={copy.amount} />
      </Field>
      {action === 'sell' && amountNum > 0 && (
        <p className={`-mt-2 text-sm font-semibold ${gain >= 0 ? 'text-success' : 'text-destructive'}`}>
          {gain >= 0 ? 'Gain' : 'Loss'} of {formatMoney(Math.abs(gain), currency, false)} on what you put in
        </p>
      )}
      {copy.wallet && (
        <Field label={copy.wallet}>
          <WalletPicker value={walletId} onChange={setWalletId} />
        </Field>
      )}
      <Field label="Date">
        <input type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} aria-label="Date" className={fieldClass} />
      </Field>
      <Field label="Note (optional)">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything to remember" aria-label="Note" className={fieldClass} />
      </Field>
    </FormSheet>
  )
}
