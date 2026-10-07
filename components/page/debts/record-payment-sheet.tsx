'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { WalletPicker } from '@/components/page/wallet/wallet-picker'
import { Field, FormSheet, fieldClass, MoneyField } from '@/components/ui/form-sheet'
import { useRecordObligationPayment } from '@/queries/user/obligation/obligations'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { celebrate } from '@/store/celebration-store'
import type { Obligation } from '@/types/obligation'

interface RecordPaymentSheetProps {
  obligation: Obligation | null
  onClose: () => void
}

export function RecordPaymentSheet({ obligation, onClose }: RecordPaymentSheetProps) {
  const { currency } = useSettingsStore()
  const { mutate: record, isPending } = useRecordObligationPayment()
  const [amount, setAmount] = useState('')
  const [walletId, setWalletId] = useState('')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!obligation) return
    const next = obligation.isInstallment && obligation.installmentAmount ? Math.min(obligation.installmentAmount, obligation.remainingBalance) : obligation.remainingBalance
    setAmount(String(next))
    setWalletId(obligation.walletId ?? '')
    setDate(new Date().toISOString().slice(0, 10))
    setNote('')
  }, [obligation])

  if (!obligation) return null
  const isDebt = obligation.direction === 'debt'
  const amountNum = Number(amount) || 0

  const submit = () => {
    if (amountNum <= 0) return void toast.error('Enter an amount')
    if (!walletId) return void toast.error(isDebt ? 'Pick the wallet you paid from' : 'Pick the wallet it went into')
    record(
      {
        id: obligation.id,
        amount: amountNum,
        walletId,
        date: date ? new Date(date).toISOString() : undefined,
        notes: note.trim() || undefined,
        idempotencyKey: `${obligation.id}:${Date.now()}`,
      },
      {
        onSuccess: () => {
          // Paying off the last of it is a moment worth marking; part payments stay a quiet toast.
          if (amountNum >= obligation.remainingBalance - 0.005) {
            celebrate({
              kind: isDebt ? 'confetti' : 'coins',
              title: isDebt ? 'Debt cleared!' : 'Paid back in full!',
              message: isDebt
                ? `${obligation.name} is fully paid off. One less thing to worry about.`
                : `${obligation.counterparty} has paid you back for ${obligation.name}.`,
              highlight: formatMoney(amountNum, obligation.currency || currency, false),
            })
          } else {
            toast.success(isDebt ? 'Payment recorded' : 'Repayment recorded')
          }
          onClose()
        },
      }
    )
  }

  return (
    <FormSheet
      open
      onClose={onClose}
      title={isDebt ? `Pay ${obligation.counterparty}` : `Received from ${obligation.counterparty}`}
      description="Record a payment against this debt or loan."
      submitLabel={isDebt ? 'Record payment' : 'Record repayment'}
      onSubmit={submit}
      busy={isPending}
    >
      <p className="text-sm text-muted-foreground">
        {obligation.name} · {formatMoney(obligation.remainingBalance, currency, false)} left
      </p>
      <Field label="Amount">
        <MoneyField value={amount} onChange={setAmount} ariaLabel="Amount" />
      </Field>
      <Field label={isDebt ? 'Paid from' : 'Received into'}>
        <WalletPicker value={walletId} onChange={setWalletId} payFrom={isDebt} />
      </Field>
      <Field label="Date">
        <input type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} aria-label="Date" className={fieldClass} />
      </Field>
      <Field label="Note (optional)">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything to remember" aria-label="Note" className={fieldClass} />
      </Field>
    </FormSheet>
  )
}
