'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { WalletPicker } from '@/components/page/wallet/wallet-picker'
import { INVESTMENT_TYPES, PLATFORM_SUGGESTIONS } from '@/components/page/investments/investment-meta'
import { chipClass, Field, FormSheet, fieldClass, MoneyField, scrollBleedClass, scrollRowClass } from '@/components/ui/form-sheet'
import { useCreateInvestment, useUpdateInvestment } from '@/queries/user/investment/investments'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { celebrate } from '@/store/celebration-store'
import { COINS, coinLabel } from '@/utils/crypto-prices'
import type { Investment, InvestmentType } from '@/types/investment'

interface InvestmentSheetProps {
  open: boolean
  onClose: () => void
  /** When set, edits this investment instead of creating one. */
  investment?: Investment | null
}

const today = () => new Date().toISOString().slice(0, 10)
const toDate = (value?: string) => (value ? String(value).slice(0, 10) : '')

export function InvestmentSheet({ open, onClose, investment }: InvestmentSheetProps) {
  const { currency } = useSettingsStore()
  const { mutate: create, isPending: creating } = useCreateInvestment()
  const { mutate: update, isPending: updating } = useUpdateInvestment()
  const isEdit = !!investment

  const [type, setType] = useState<InvestmentType>('stocks')
  const [name, setName] = useState('')
  const [platform, setPlatform] = useState('')
  const [amount, setAmount] = useState('')
  const [startDate, setStartDate] = useState(today())
  const [maturity, setMaturity] = useState('')
  const [rate, setRate] = useState('')
  const [walletId, setWalletId] = useState('')
  const [notes, setNotes] = useState('')
  const [coinId, setCoinId] = useState('')
  const [coinQuery, setCoinQuery] = useState('')
  const [quantity, setQuantity] = useState('')

  useEffect(() => {
    if (!open) return
    setType(investment?.type ?? 'stocks')
    setName(investment?.name ?? '')
    setPlatform(investment?.platform ?? '')
    setAmount(investment ? String(investment.principalAmount) : '')
    setStartDate(investment ? toDate(investment.startDate) : today())
    setMaturity(toDate(investment?.maturityDate))
    setRate(investment?.expectedReturnRate != null ? String(investment.expectedReturnRate) : '')
    setWalletId(investment?.walletId ?? '')
    setNotes(investment?.notes ?? '')
    setCoinId(investment?.coinId ?? '')
    setCoinQuery('')
    setQuantity(investment?.quantity ? String(Number(investment.quantity)) : '')
  }, [open, investment])

  const finish = (message: string, celebration?: Parameters<typeof celebrate>[0]) => {
    if (celebration) celebrate(celebration)
    else toast.success(message)
    onClose()
  }

  const isCrypto = type === 'crypto'
  const query = coinQuery.trim().toLowerCase()
  const matches = (query ? COINS.filter((c) => c.symbol.toLowerCase().includes(query) || c.name.toLowerCase().includes(query) || c.id.includes(query)) : COINS).slice(0, 12)
  const customId = query.replace(/\s+/g, '-')
  const showCustom = !!query && !COINS.some((c) => c.id === customId)
  const pickCoin = (id: string, label: string) => {
    setCoinId(id)
    setCoinQuery('')
    if (!name.trim()) setName(label)
  }

  const submit = () => {
    if (!name.trim()) return void toast.error('Give the investment a name')
    const coinQty = Number(quantity) || 0
    if (isCrypto && coinId && coinQty <= 0) return void toast.error('Enter how many coins you hold')

    if (isEdit && investment) {
      update(
        {
          id: investment.id,
          name: name.trim(),
          platform: platform.trim() || undefined,
          maturityDate: maturity ? new Date(maturity).toISOString() : undefined,
          expectedReturnRate: Number(rate) > 0 ? Number(rate) : undefined,
          notes: notes.trim() || undefined,
          ...(isCrypto ? { coinId: coinId || null, coinSymbol: coinId ? coinLabel(coinId) : null, quantity: coinId ? coinQty : null } : {}),
        },
        { onSuccess: () => finish('Saved') }
      )
      return
    }

    const principal = Number(amount) || 0
    if (principal <= 0) return void toast.error('Enter how much you put in')

    create(
      {
        name: name.trim(),
        type,
        principalAmount: principal,
        startDate: new Date(startDate || today()).toISOString(),
        currency,
        platform: platform.trim() || undefined,
        walletId: walletId || undefined,
        maturityDate: maturity ? new Date(maturity).toISOString() : undefined,
        expectedReturnRate: Number(rate) > 0 ? Number(rate) : undefined,
        notes: notes.trim() || undefined,
        ...(isCrypto && coinId ? { coinId, coinSymbol: coinLabel(coinId), quantity: coinQty } : {}),
      },
      {
        onSuccess: () =>
          finish('Investment added', {
            kind: 'coins',
            title: 'Investment added',
            message: `${name.trim()} is now part of your portfolio.`,
            highlight: formatMoney(principal, currency, false),
          }),
      }
    )
  }

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit investment' : 'New investment'}
      description="Track an investment, what you put in, and how it is doing."
      submitLabel={isEdit ? 'Save changes' : 'Add investment'}
      onSubmit={submit}
      busy={creating || updating}
    >
      {!isEdit && (
        <Field label="Type">
          <div className={scrollRowClass} role="group" aria-label="Investment type">
            {INVESTMENT_TYPES.map((t) => (
              <button key={t.value} type="button" aria-pressed={type === t.value} onClick={() => setType(t.value)} className={`${chipClass(type === t.value)} flex items-center gap-1.5`}>
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </div>
        </Field>
      )}

      {!isEdit && (
        <Field label="Amount put in">
          <MoneyField value={amount} onChange={setAmount} ariaLabel="Amount put in" />
        </Field>
      )}

      {isCrypto && (
        <Field label="Coin" hint="Pick the coin to see its live price. Skip it to track the value by hand.">
          <input value={coinQuery} onChange={(e) => setCoinQuery(e.target.value)} placeholder="Search, e.g. BNB or bitcoin" aria-label="Search coins" className={fieldClass} />
          <div className={`${scrollBleedClass} mt-2`}>
            {coinId && (
              <button type="button" onClick={() => setCoinId('')} className={chipClass(true)}>
                {coinLabel(coinId)} ✕
              </button>
            )}
            {matches.map((c) => (
              <button key={c.id} type="button" aria-pressed={coinId === c.id} onClick={() => pickCoin(c.id, c.name)} className={chipClass(coinId === c.id)}>
                {c.symbol}
              </button>
            ))}
            {showCustom && (
              <button type="button" onClick={() => pickCoin(customId, coinQuery.trim())} className={chipClass(false)}>
                Use &quot;{customId}&quot;
              </button>
            )}
          </div>
          {coinId && (
            <div className="mt-3">
              <input
                value={quantity}
                onChange={(e) => setQuantity(e.target.value.replace(/[^0-9.]/g, ''))}
                inputMode="decimal"
                placeholder={`How many ${coinLabel(coinId)} you hold, e.g. 0.02158`}
                aria-label="Coins held"
                className={fieldClass}
              />
            </div>
          )}
        </Field>
      )}

      <Field label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ayala Land shares" aria-label="Name" className={fieldClass} />
      </Field>

      <Field label="Where (optional)">
        <input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="Broker, bank or app" aria-label="Platform" className={fieldClass} />
        <div className={`${scrollBleedClass} mt-2`}>
          {PLATFORM_SUGGESTIONS.map((p) => (
            <button key={p} type="button" onClick={() => setPlatform(p)} className={chipClass(platform === p)}>
              {p}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        {!isEdit && (
          <Field label="Bought on">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} aria-label="Start date" className={fieldClass} />
          </Field>
        )}
        <Field label="Matures on (optional)">
          <input type="date" value={maturity} onChange={(e) => setMaturity(e.target.value)} aria-label="Maturity date" className={fieldClass} />
        </Field>
      </div>

      <Field label="Expected return per year (optional)">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 focus-within:ring-2 focus-within:ring-primary">
          <input
            inputMode="decimal"
            value={rate}
            onChange={(e) => setRate(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0"
            aria-label="Expected return per year"
            className="min-w-0 flex-1 bg-transparent text-sm tabular-nums focus:outline-none"
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      </Field>

      {!isEdit && (
        <Field label="Paid from" hint="Optional. Pick a wallet and the amount comes out of it as an expense.">
          <WalletPicker value={walletId} onChange={setWalletId} noneLabel="Don't record" payFrom />
        </Field>
      )}

      <Field label="Note (optional)">
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to remember" aria-label="Note" className={fieldClass} />
      </Field>
    </FormSheet>
  )
}
