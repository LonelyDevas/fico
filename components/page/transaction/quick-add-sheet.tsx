'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Delete, Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { useCreateTransaction, useUpdateTransaction } from '@/queries/user/transaction/transaction'
import { useListWallets } from '@/queries/user/wallet/wallets'
import { useListCategories } from '@/queries/user/category/categories'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import type { CreateTransactionData, TransactionType, UpdateTransactionData } from '@/types/transaction'

export interface QuickAddSheetProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  title?: string
  initialWalletId?: string
  initialType?: TransactionType
  /** Pre-fills the sheet, for example from the AI assistant's parsed text. */
  initialData?: Partial<CreateTransactionData>
  /** When set, the sheet edits this transaction instead of creating a new one. */
  transaction?: ({ id: string } & Partial<UpdateTransactionData> & Partial<CreateTransactionData>) | null
}

const TYPES: { value: TransactionType; label: string }[] = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
]

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'] as const
type Key = (typeof KEYS)[number]

const LAST_WALLET_KEY = 'fico:last-wallet'

const readLastWallet = () => {
  try {
    return window.localStorage.getItem(LAST_WALLET_KEY) ?? ''
  } catch {
    return ''
  }
}

const currencySymbol = (currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? currency
  } catch {
    return currency
  }
}

/** "1234.5" becomes "1,234.5" while keeping a trailing dot or zero the user just typed. */
const prettyDigits = (digits: string) => {
  const [whole, decimals] = digits.split('.')
  const grouped = Number(whole).toLocaleString('en-US')
  return decimals === undefined ? grouped : `${grouped}.${decimals}`
}

const walletIdOf = (wallet: any, index: number): string => String(wallet._id ?? wallet.id ?? `wallet-${index}`)
const asList = (data: any): any[] => (Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [])
const toDigits = (amount?: number) => (amount && amount > 0 ? String(amount) : '0')
const toDateInput = (value?: string) => (value ? String(value).slice(0, 10) : '')

export function QuickAddSheet({
  open,
  onClose,
  onSuccess,
  title,
  initialWalletId,
  initialType,
  initialData,
  transaction,
}: QuickAddSheetProps) {
  const isEdit = !!transaction
  const { currency, hideAmountsOnOpen } = useSettingsStore()
  const { data: walletsResponse } = useListWallets()
  const { data: categoriesResponse } = useListCategories()
  const { mutate: createTransaction, isPending: isCreating } = useCreateTransaction()
  const { mutate: updateTransaction, isPending: isUpdating } = useUpdateTransaction()
  const isPending = isCreating || isUpdating

  const wallets = useMemo(
    () => asList(walletsResponse?.data).filter((w) => w.status !== 'archived'),
    [walletsResponse]
  )
  const categories = useMemo(() => asList(categoriesResponse?.data), [categoriesResponse])

  const [type, setType] = useState<TransactionType>('expense')
  const [digits, setDigits] = useState('0')
  const [walletId, setWalletId] = useState('')
  const [toWalletId, setToWalletId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState('')
  const [feeOn, setFeeOn] = useState(false)
  const [feeText, setFeeText] = useState('')

  // Start fresh (or from the transaction being edited / pre-filled data) each time it opens.
  useEffect(() => {
    if (!open) return
    const source = transaction ?? initialData
    setType(source?.type ?? initialType ?? 'expense')
    setDigits(toDigits(source?.amount))
    setToWalletId(source?.toWalletId ?? '')
    setCategoryId(source?.categoryId ?? '')
    setNote(source?.description ?? '')
    setDate(toDateInput(source?.date))
    const fee = source?.serviceFee ?? 0
    setFeeOn(fee > 0)
    setFeeText(fee > 0 ? String(fee) : '')
    setWalletId(source?.walletId ?? initialWalletId ?? (isEdit ? '' : readLastWallet()))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transaction?.id])

  // An expense can't be paid straight from a savings wallet: transfer the money out first.
  const sourceWallets = type === 'expense' ? wallets.filter((w) => w.type !== 'savings') : wallets
  const savingsHidden = wallets.length - sourceWallets.length

  // Fall back to the first wallet when nothing (or a stale wallet) was remembered.
  useEffect(() => {
    if (!open || wallets.length === 0) return
    const ids = sourceWallets.map(walletIdOf)
    if (ids.length > 0 && !ids.includes(walletId)) setWalletId(ids[0])
  }, [open, sourceWallets, walletId])

  const amount = parseFloat(digits) || 0
  const fee = feeOn ? parseFloat(feeText) || 0 : 0
  const visibleCategories = categories.filter((c) => !c.type || c.type === type)
  const destinations = wallets.filter((w, i) => walletIdOf(w, i) !== walletId)

  const press = (key: Key) => {
    setDigits((prev) => {
      if (key === 'back') return prev.length > 1 ? prev.slice(0, -1) : '0'
      if (key === '.') return prev.includes('.') ? prev : `${prev}.`
      const decimals = prev.split('.')[1]
      if (decimals !== undefined && decimals.length >= 2) return prev
      if (prev.replace('.', '').length >= 10) return prev
      return prev === '0' ? key : prev + key
    })
  }

  // Let a hardware keyboard type the amount too, unless a text field has focus.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (/^[0-9]$/.test(event.key) || event.key === '.') press(event.key as Key)
      else if (event.key === 'Backspace') press('back')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  const selectWallet = (id: string) => {
    setWalletId(id)
    if (toWalletId === id) setToWalletId('')
  }

  const submit = () => {
    if (!walletId) return void toast.error('Pick a wallet first')
    if (amount <= 0) return void toast.error('Enter an amount')
    if (type === 'transfer' && !toWalletId) return void toast.error('Choose where to send it')

    const categoryName = visibleCategories.find((c) => String(c._id ?? c.id) === categoryId)?.name
    const description = note.trim() || (type === 'transfer' ? 'Transfer' : categoryName || (type === 'income' ? 'Income' : 'Expense'))
    const finish = (message: string) => {
      if (!isEdit) {
        try {
          window.localStorage.setItem(LAST_WALLET_KEY, walletId)
        } catch {
          /* remembering the wallet is a convenience only */
        }
      }
      toast.success(message)
      onClose()
      onSuccess?.()
    }

    if (isEdit && transaction) {
      const update: UpdateTransactionData = {
        id: transaction.id,
        walletId,
        categoryId: type !== 'transfer' && categoryId ? categoryId : undefined,
        amount,
        type,
        description,
        date: date || transaction.date,
        tags: transaction.tags,
        attachments: transaction.attachments,
        status: transaction.status,
      }
      updateTransaction(update, {
        onSuccess: () => finish('Changes saved'),
        onError: (error) => console.error('Error updating transaction:', error),
      })
      return
    }

    const payload: CreateTransactionData = {
      walletId,
      amount,
      type,
      description,
      ...(type !== 'transfer' && categoryId ? { categoryId } : {}),
      ...(type === 'transfer' ? { toWalletId } : {}),
      ...(date ? { date } : {}),
      ...(fee > 0 ? { serviceFee: fee } : {}),
    }
    createTransaction(payload, {
      onSuccess: () => finish('Saved!'),
      onError: (error) => console.error('Error creating transaction:', error),
    })
  }

  const amountTone = type === 'income' ? 'text-success' : type === 'transfer' ? 'text-primary' : 'text-foreground'
  const typeWord = type === 'income' ? 'income' : type === 'transfer' ? 'transfer' : 'expense'
  const saveLabel = isPending
    ? 'Saving…'
    : amount <= 0
      ? 'Enter an amount'
      : isEdit
        ? 'Save changes'
        : `Save ${typeWord} · ${formatMoney(amount + fee, currency, false)}`

  const chip = (selected: boolean) =>
    `shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
      selected ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background hover:border-primary/50 text-foreground'
    }`
  const scrollRow = 'flex gap-2 overflow-x-auto px-1 pb-1 -mx-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
  const label = 'mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground'

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="max-h-[94dvh] p-0 md:max-h-none md:max-w-md" showCloseButton={false}>
        <div className="flex h-full min-h-0 flex-col bg-card md:rounded-2xl">
          <div className="flex items-center justify-between px-5 pb-2 pt-1">
            <SheetTitle className="font-heading text-lg font-semibold text-foreground">
              {title ?? (isEdit ? 'Edit transaction' : 'Add')}
            </SheetTitle>
            <SheetDescription className="sr-only">Enter an amount, choose a wallet and save a transaction.</SheetDescription>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="max-md:hidden rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div data-vaul-no-drag className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-3">
            <div role="group" aria-label="Transaction type" className="grid grid-cols-3 gap-1 rounded-full bg-secondary p-1">
              {TYPES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={type === option.value}
                  onClick={() => {
                    setType(option.value)
                    setCategoryId('')
                    setToWalletId('')
                  }}
                  className={`rounded-full py-2 text-sm font-semibold transition-colors ${
                    type === option.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="py-1 text-center" aria-live="polite">
              <p className={`flex items-baseline justify-center gap-1.5 font-heading font-semibold tabular-nums ${amountTone}`}>
                <span className="text-2xl opacity-60">{currencySymbol(currency)}</span>
                <span className="text-5xl tracking-tight">{prettyDigits(digits)}</span>
              </p>
            </div>

            <div>
              <p className={label}>{type === 'transfer' ? 'From' : 'Wallet'}</p>
              {sourceWallets.length > 0 ? (
                <div className={scrollRow}>
                  {sourceWallets.map((wallet, index) => {
                    const id = walletIdOf(wallet, index)
                    return (
                      <button key={id} type="button" onClick={() => selectWallet(id)} className={chip(walletId === id)}>
                        {wallet.name || 'Wallet'}
                        <span className="ml-1.5 text-xs opacity-70">
                          {wallet.type === 'credit_card' && wallet.creditLimit
                            ? `${formatMoney(Math.max(0, Number(wallet.creditLimit) - Number(wallet.balance ?? 0)), wallet.currency || currency, hideAmountsOnOpen)} left`
                            : formatMoney(Number(wallet.balance ?? wallet.currentBalance ?? 0), wallet.currency || currency, hideAmountsOnOpen)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {savingsHidden > 0 ? 'Savings wallets can\u2019t pay directly. Transfer the money to another wallet first.' : 'Create a wallet first, then come back to add transactions.'}
                </p>
              )}
              {savingsHidden > 0 && sourceWallets.length > 0 && (
                <p className="mt-1.5 text-xs text-muted-foreground">Savings wallets can\u2019t pay directly. Transfer the money to another wallet first.</p>
              )}
            </div>

            {type === 'transfer' ? (
              <div>
                <p className={label}>To</p>
                <div className={scrollRow}>
                  {destinations.length > 0 ? (
                    destinations.map((wallet) => {
                      const id = walletIdOf(wallet, wallets.indexOf(wallet))
                      return (
                        <button key={id} type="button" onClick={() => setToWalletId(id)} className={chip(toWalletId === id)}>
                          {wallet.name || 'Wallet'}
                        </button>
                      )
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">You need a second wallet to transfer money.</p>
                  )}
                </div>
              </div>
            ) : (
              visibleCategories.length > 0 && (
                <div>
                  <p className={label}>Category</p>
                  <div className={scrollRow}>
                    {visibleCategories.map((category) => {
                      const id = String(category._id ?? category.id)
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setCategoryId(categoryId === id ? '' : id)}
                          className={chip(categoryId === id)}
                        >
                          {category.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            )}

            <div className="flex items-center gap-2">
              <input
                id="quick-add-note"
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Add a note (optional)"
                aria-label="Note"
                className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <label className="relative flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-2.5 text-sm font-medium text-foreground">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                {date ? date.slice(5).replace('-', '/') : 'Today'}
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  aria-label="Date"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </label>
            </div>

            {!isEdit && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  aria-pressed={feeOn}
                  onClick={() => setFeeOn((v) => !v)}
                  className={`${chip(feeOn)} flex items-center gap-1.5`}
                >
                  {!feeOn && <Plus className="h-4 w-4" />}
                  Service fee
                </button>
                {feeOn && (
                  <>
                    <input
                      id="quick-add-fee"
                      type="text"
                      inputMode="decimal"
                      value={feeText}
                      onChange={(event) => setFeeText(event.target.value.replace(/[^0-9.]/g, ''))}
                      placeholder="0.00"
                      aria-label="Service fee amount"
                      className="w-28 rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    {amount > 0 && (
                      <span className="text-sm text-muted-foreground tabular-nums">Total {formatMoney(amount + fee, currency, false)}</span>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div data-vaul-no-drag className="shrink-0 border-t border-border px-4 pb-4 pt-3">
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Number pad">
              {KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => press(key)}
                  aria-label={key === 'back' ? 'Delete' : key === '.' ? 'Decimal point' : key}
                  className="flex h-12 touch-manipulation items-center justify-center rounded-2xl bg-secondary text-xl font-semibold text-foreground transition-colors active:bg-primary/15"
                >
                  {key === 'back' ? <Delete className="h-6 w-6" /> : key}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={isPending}
              className="mt-3 h-12 w-full rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-ios transition-opacity disabled:opacity-60"
            >
              {saveLabel}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
