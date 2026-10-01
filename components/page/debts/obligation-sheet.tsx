'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { WalletPicker } from '@/components/page/wallet/wallet-picker'
import { chipClass, Field, FormSheet, fieldClass, MoneyField, scrollRowClass } from '@/components/ui/form-sheet'
import { useCreateObligation, useUpdateObligation } from '@/queries/user/obligation/obligations'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import type { InstallmentFrequency, InterestType, Obligation, ObligationDirection } from '@/types/obligation'

interface ObligationSheetProps {
  open: boolean
  onClose: () => void
  /** When set, edits this debt or loan instead of creating one. */
  obligation?: Obligation | null
  initialDirection?: ObligationDirection
}

const today = () => new Date().toISOString().slice(0, 10)
const toDate = (value?: string) => (value ? String(value).slice(0, 10) : '')

const FREQUENCIES: { value: InstallmentFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

export function ObligationSheet({ open, onClose, obligation, initialDirection = 'debt' }: ObligationSheetProps) {
  const { currency } = useSettingsStore()
  const { mutate: create, isPending: creating } = useCreateObligation()
  const { mutate: update, isPending: updating } = useUpdateObligation()
  const isEdit = !!obligation

  const [direction, setDirection] = useState<ObligationDirection>('debt')
  const [name, setName] = useState('')
  const [counterparty, setCounterparty] = useState('')
  const [principal, setPrincipal] = useState('')
  const [startDate, setStartDate] = useState(today())
  const [dueDate, setDueDate] = useState('')
  const [rate, setRate] = useState('')
  const [interestType, setInterestType] = useState<InterestType>('simple')
  const [walletId, setWalletId] = useState('')
  const [notes, setNotes] = useState('')
  const [installment, setInstallment] = useState(false)
  const [installmentAmount, setInstallmentAmount] = useState('')
  const [installments, setInstallments] = useState('')
  const [frequency, setFrequency] = useState<InstallmentFrequency>('monthly')

  useEffect(() => {
    if (!open) return
    setDirection(obligation?.direction ?? initialDirection)
    setName(obligation?.name ?? '')
    setCounterparty(obligation?.counterparty ?? '')
    setPrincipal(obligation ? String(obligation.principalAmount) : '')
    setStartDate(obligation ? toDate(obligation.startDate) : today())
    setDueDate(toDate(obligation?.dueDate))
    setRate(obligation?.interestRate != null ? String(obligation.interestRate) : '')
    setInterestType(obligation?.interestType ?? 'simple')
    setWalletId(obligation?.walletId ?? '')
    setNotes(obligation?.notes ?? '')
    setInstallment(obligation?.isInstallment ?? false)
    setInstallmentAmount(obligation?.installmentAmount != null ? String(obligation.installmentAmount) : '')
    setInstallments(obligation?.totalInstallments != null ? String(obligation.totalInstallments) : '')
    setFrequency(obligation?.installmentFrequency ?? 'monthly')
  }, [open, obligation, initialDirection])

  const isDebt = direction === 'debt'
  const principalNum = Number(principal) || 0
  const countNum = Number(installments) || 0
  const suggested = principalNum > 0 && countNum > 0 ? principalNum / countNum : 0

  const finish = (message: string) => {
    toast.success(message)
    onClose()
  }

  const submit = () => {
    if (!name.trim()) return void toast.error('Give it a name')
    if (!counterparty.trim()) return void toast.error(isDebt ? 'Who did you borrow from?' : 'Who did you lend to?')

    if (isEdit && obligation) {
      update(
        {
          id: obligation.id,
          name: name.trim(),
          counterparty: counterparty.trim(),
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
          notes: notes.trim() || undefined,
        },
        { onSuccess: () => finish('Saved') }
      )
      return
    }

    if (principalNum <= 0) return void toast.error('Enter the amount')
    if (installment && (!(Number(installmentAmount) > 0) || countNum <= 0)) {
      return void toast.error('Enter the payment amount and how many payments')
    }

    create(
      {
        direction,
        name: name.trim(),
        counterparty: counterparty.trim(),
        principalAmount: principalNum,
        startDate: new Date(startDate || today()).toISOString(),
        currency,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        interestRate: Number(rate) > 0 ? Number(rate) : undefined,
        interestType: Number(rate) > 0 ? interestType : undefined,
        walletId: walletId || undefined,
        notes: notes.trim() || undefined,
        ...(installment
          ? { isInstallment: true, installmentAmount: Number(installmentAmount), totalInstallments: countNum, installmentFrequency: frequency }
          : {}),
      },
      { onSuccess: () => finish(isDebt ? 'Debt added' : 'Loan added') }
    )
  }

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit' : isDebt ? 'New debt' : 'New loan'}
      description="Track money you borrowed or lent, with optional interest and installments."
      submitLabel={isEdit ? 'Save changes' : isDebt ? 'Add debt' : 'Add loan'}
      onSubmit={submit}
      busy={creating || updating}
    >
      {!isEdit && (
        <div role="group" aria-label="Direction" className="grid grid-cols-2 gap-1 rounded-full bg-secondary p-1">
          {([
            ['debt', 'I borrowed'],
            ['lending', 'I lent'],
          ] as const).map(([value, text]) => (
            <button
              key={value}
              type="button"
              aria-pressed={direction === value}
              onClick={() => setDirection(value)}
              className={`rounded-full py-2 text-sm font-semibold transition-colors ${direction === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              {text}
            </button>
          ))}
        </div>
      )}

      {!isEdit && (
        <Field label="Amount">
          <MoneyField value={principal} onChange={setPrincipal} ariaLabel="Amount" />
        </Field>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="What is it for">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={isDebt ? 'Motorcycle loan' : 'Emergency help'} aria-label="Name" className={fieldClass} />
        </Field>
        <Field label={isDebt ? 'Borrowed from' : 'Lent to'}>
          <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder={isDebt ? 'Bank, person, lender' : 'Name'} aria-label="Person or lender" className={fieldClass} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {!isEdit && (
          <Field label="Started">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} aria-label="Start date" className={fieldClass} />
          </Field>
        )}
        <Field label="Due date (optional)">
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-label="Due date" className={fieldClass} />
        </Field>
      </div>

      {!isEdit && (
        <>
          <Field label="Interest (optional)">
            <div className="flex items-center gap-2">
              <div className="flex w-32 shrink-0 items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 focus-within:ring-2 focus-within:ring-primary">
                <input
                  inputMode="decimal"
                  value={rate}
                  onChange={(e) => setRate(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="0"
                  aria-label="Interest rate per year"
                  className="min-w-0 flex-1 bg-transparent text-sm tabular-nums focus:outline-none"
                />
                <span className="text-sm text-muted-foreground">% / yr</span>
              </div>
              <div className={scrollRowClass} role="group" aria-label="Interest type">
                {(['simple', 'compound'] as const).map((type) => (
                  <button key={type} type="button" aria-pressed={interestType === type} onClick={() => setInterestType(type)} className={chipClass(interestType === type)}>
                    {type === 'simple' ? 'Simple' : 'Compound'}
                  </button>
                ))}
              </div>
            </div>
          </Field>

          <Field label={isDebt ? 'Money went into' : 'Money came from'} hint="Optional. Pick a wallet to record the money moving, or leave it off to just track the debt.">
            <WalletPicker value={walletId} onChange={setWalletId} noneLabel="Don't record" />
          </Field>

          <div>
            <button
              type="button"
              aria-pressed={installment}
              onClick={() => setInstallment((v) => !v)}
              className={`${chipClass(installment)} flex items-center gap-1.5`}
            >
              Paid in installments
            </button>
            {installment && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Number of payments">
                    <input inputMode="numeric" value={installments} onChange={(e) => setInstallments(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))} placeholder="12" aria-label="Number of payments" className={fieldClass} />
                  </Field>
                  <Field label="How often">
                    <div className={scrollRowClass} role="group" aria-label="Frequency">
                      {FREQUENCIES.map((f) => (
                        <button key={f.value} type="button" aria-pressed={frequency === f.value} onClick={() => setFrequency(f.value)} className={chipClass(frequency === f.value)}>
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>
                <Field label="Each payment" hint={suggested > 0 ? `About ${formatMoney(suggested, currency, false)} each if split evenly, before interest.` : undefined}>
                  <MoneyField value={installmentAmount} onChange={setInstallmentAmount} ariaLabel="Each payment" />
                </Field>
                <button
                  type="button"
                  onClick={() => suggested > 0 && setInstallmentAmount(String(Math.ceil(suggested * 100) / 100))}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Use even split
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <Field label="Note (optional)">
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to remember" aria-label="Note" className={fieldClass} />
      </Field>
    </FormSheet>
  )
}
