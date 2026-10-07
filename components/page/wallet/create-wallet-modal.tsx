'use client'

import { useEffect, useMemo, useState } from 'react'
import { Banknote, Check, CreditCard, Landmark, PiggyBank, Search, Smartphone, Wallet, X, type LucideIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { InstitutionLogo } from '@/components/ui/institution-logo'
import { useCreateWallet, useUpdateWallet, useSetBalance } from '@/queries/user/wallet/wallets'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { celebrate } from '@/store/celebration-store'
import {
  getInstitution,
  INSTITUTION_KIND_LABEL,
  searchInstitutions,
  type InstitutionKind,
} from '@/lib/ph-institutions'
import { estimateYearlyInterest, PAYOUT_OPTIONS, SAVINGS_PRESETS, type SavingsPreset } from '@/lib/savings-presets'
import { CreateWalletData, InterestPayout, UpdateWalletData, WalletType } from '@/types/wallet'

interface CreateWalletModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  wallet?: {
    id: string
    name?: string
    type?: WalletType
    balance?: number
    color?: string
    icon?: string
    description?: string
    accountNumber?: string
    institution?: string
    creditLimit?: number
    statementDay?: number
    dueDay?: number
    interestRate?: number
    interestPayout?: InterestPayout
    interestTaxRate?: number
    maturityDate?: string
    totalInterestEarned?: number
  } | null
}

const DEFAULT_COLOR = '#0066CC'

const WALLET_TYPES: { value: WalletType; label: string; icon: LucideIcon }[] = [
  { value: 'bank', label: 'Bank', icon: Landmark },
  { value: 'savings', label: 'Savings', icon: PiggyBank },
  { value: 'ewallet', label: 'E-wallet', icon: Smartphone },
  { value: 'credit_card', label: 'Credit card', icon: CreditCard },
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'other', label: 'Other', icon: Wallet },
]

/** Which catalog sections each wallet type can pick an institution from. */
const KINDS_FOR_TYPE: Partial<Record<WalletType, InstitutionKind[]>> = {
  bank: ['bank', 'digital_bank'],
  savings: ['bank', 'digital_bank', 'government'],
  ewallet: ['ewallet'],
  credit_card: ['bank', 'digital_bank'],
}

const SWATCHES = ['#0066CC', '#00B287', '#F26B21', '#E31837', '#6A2C91', '#00A651', '#FFC72C', '#37517E', '#EC4899', '#111827']

const addMonths = (months: number) => {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

const currencySymbol = (currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? currency
  } catch {
    return currency
  }
}

const label = 'mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground'
const field =
  'w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary'

export function CreateWalletModal({ open, onClose, onSuccess, wallet }: CreateWalletModalProps) {
  const { currency } = useSettingsStore()
  const { mutate: createWallet, isPending } = useCreateWallet()
  const { mutate: updateWallet, isPending: isUpdating } = useUpdateWallet()
  const { mutate: setBalance, isPending: isOverriding } = useSetBalance()
  const isEdit = !!wallet
  const busy = isPending || isUpdating || isOverriding

  const [type, setType] = useState<WalletType>('bank')
  const [institution, setInstitution] = useState('')
  const [name, setName] = useState('')
  const [balanceText, setBalanceText] = useState('')
  const [limitText, setLimitText] = useState('')
  const [statementText, setStatementText] = useState('')
  const [dueText, setDueText] = useState('')
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [accountNumber, setAccountNumber] = useState('')
  const [description, setDescription] = useState('')
  const [query, setQuery] = useState('')
  const [presetId, setPresetId] = useState('')
  const [rateText, setRateText] = useState('')
  const [taxText, setTaxText] = useState('')
  const [payout, setPayout] = useState<InterestPayout>('monthly')
  const [maturity, setMaturity] = useState('')

  useEffect(() => {
    if (!open) return
    setType(wallet?.type ?? 'bank')
    setInstitution(wallet?.institution ?? '')
    setName(wallet?.name ?? '')
    setBalanceText(wallet?.balance !== undefined ? String(wallet.balance) : '')
    setLimitText(wallet?.creditLimit ? String(wallet.creditLimit) : '')
    setStatementText(wallet?.statementDay ? String(wallet.statementDay) : '')
    setDueText(wallet?.dueDay ? String(wallet.dueDay) : '')
    setColor(wallet?.color || DEFAULT_COLOR)
    setAccountNumber(wallet?.accountNumber ?? '')
    setDescription(wallet?.description ?? '')
    setQuery('')
    setPresetId(wallet?.type === 'savings' ? 'custom' : '')
    setRateText(wallet?.interestRate != null ? String(wallet.interestRate) : '')
    setTaxText(wallet?.interestTaxRate != null ? String(wallet.interestTaxRate) : '')
    setPayout(wallet?.interestPayout ?? 'monthly')
    setMaturity(wallet?.maturityDate ? String(wallet.maturityDate).slice(0, 10) : '')
  }, [open, wallet])

  const kinds = KINDS_FOR_TYPE[type]
  const sections = useMemo(() => {
    if (!kinds) return []
    const matches = searchInstitutions(query, kinds)
    return kinds
      .map((kind) => ({ kind, items: matches.filter((m) => m.kind === kind) }))
      .filter((section) => section.items.length > 0)
  }, [kinds, query])

  const chosen = getInstitution(institution)
  const balance = balanceText === '' || balanceText === '-' ? 0 : Number(balanceText)
  const balanceValid = Number.isFinite(balance)
  const isCard = type === 'credit_card'
  const limit = Number(limitText) || 0
  const isSavings = type === 'savings'
  const rate = Number(rateText) || 0
  const tax = Number(taxText) || 0
  const interestEarned = wallet?.totalInterestEarned ?? 0
  const yearlyInterest = estimateYearlyInterest(balance, rate, tax)
  const usedPct = limit > 0 ? Math.min(100, Math.max(0, (balance / limit) * 100)) : 0

  const changeType = (next: WalletType) => {
    setType(next)
    // The picked institution may not exist under the new type's catalog sections.
    const allowed = KINDS_FOR_TYPE[next]
    if (!allowed || (chosen && !allowed.includes(chosen.kind))) setInstitution('')
  }

  const applyPreset = (preset: SavingsPreset) => {
    setPresetId(preset.id)
    if (preset.id !== 'custom') {
      setRateText(String(preset.rate))
      setTaxText(String(preset.taxRate))
      setPayout(preset.payout)
    }
    setMaturity(preset.termMonths ? addMonths(preset.termMonths) : '')
    if (preset.institution) pickInstitution(preset.institution, true)
    if (!name.trim() || SAVINGS_PRESETS.some((p) => p.label === name)) setName(preset.id === 'custom' ? '' : preset.label)
  }

  const pickInstitution = (id: string, force = false) => {
    if (id === institution && !force) {
      setInstitution('')
      return
    }
    const next = getInstitution(id)
    if (!next) return
    // Only overwrite the name if the user hasn't typed their own.
    if (!name.trim() || name === chosen?.short) setName(next.short)
    setInstitution(id)
    setColor(next.color)
  }

  const submit = () => {
    if (!name.trim()) return void toast.error('Give the wallet a name')
    if (!balanceValid) return void toast.error('Enter a valid amount')
    if (isCard && limit <= 0) return void toast.error('Enter the credit limit')
    const statementDay = statementText ? Number(statementText) : undefined
    const dueDay = dueText ? Number(dueText) : undefined
    if (isCard && [statementDay, dueDay].some((day) => day !== undefined && (day < 1 || day > 28))) {
      return void toast.error('Statement and due day must be between 1 and 28')
    }
    if (isSavings && payout === 'maturity' && !maturity) return void toast.error('Pick a maturity date for interest paid at maturity')

    const common = {
      name: name.trim(),
      type,
      color,
      accountNumber: accountNumber.trim(),
      description: description.trim(),
      institution: institution || undefined,
      creditLimit: isCard ? limit : undefined,
      statementDay: isCard ? statementDay : undefined,
      dueDay: isCard ? dueDay : undefined,
      ...(isSavings ? { interestRate: rate, interestPayout: payout, interestTaxRate: tax, maturityDate: maturity || undefined } : {}),
    }
    const finish = (message: string) => {
      toast.success(message)
      onClose()
      onSuccess?.()
    }

    if (isEdit && wallet) {
      const update: UpdateWalletData = { id: wallet.id, ...common }
      const balanceChanged = balanceText !== '' && balance !== wallet.balance
      updateWallet(update, {
        onSuccess: () => {
          if (!balanceChanged) return finish('Wallet updated')
          setBalance({ id: wallet.id, balance }, { onSuccess: () => finish('Wallet updated and balance overridden') })
        },
      })
      return
    }

    const create: CreateWalletData = { ...common, balance, currency }
    createWallet(create, {
      onSuccess: () => {
        celebrate({
          kind: 'check',
          title: 'Wallet created',
          message: `${name.trim()} is ready. Add a transaction to start tracking it.`,
        })
        onClose()
        onSuccess?.()
      },
    })
  }

  const previewName = name.trim() || chosen?.short || 'New wallet'
  const typeLabel = WALLET_TYPES.find((t) => t.value === type)?.label ?? ''
  const saveLabel = busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create wallet'

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="max-h-[94dvh] p-0 md:max-h-none md:max-w-md" showCloseButton={false}>
        <div className="flex h-full min-h-0 flex-col bg-card md:rounded-2xl">
          <div className="flex items-center justify-between px-5 pb-2 pt-1">
            <SheetTitle className="font-heading text-lg font-semibold text-foreground">
              {isEdit ? 'Edit wallet' : 'New wallet'}
            </SheetTitle>
            <SheetDescription className="sr-only">Choose a type and institution, name the wallet and set its starting balance.</SheetDescription>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="max-md:hidden rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div data-vaul-no-drag className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-4">
            {/* Live preview */}
            <div
              className="relative overflow-hidden rounded-3xl p-4 text-white shadow-ios transition-colors"
              style={{ background: `linear-gradient(135deg, ${color}, ${color}CC)` }}
            >
              <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-white/15" aria-hidden="true" />
              <div className="relative flex items-center gap-3">
                <InstitutionLogo institution={chosen} fallbackLabel={previewName} fallbackColor="rgba(255,255,255,0.25)" className="size-11" />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{previewName}</p>
                  <p className="text-xs text-white/75">
                    {chosen ? `${chosen.name} · ` : ''}
                    {typeLabel}
                    {accountNumber.trim() ? ` · ••${accountNumber.trim().slice(-4)}` : ''}
                  </p>
                </div>
              </div>
              <p className="relative mt-5 text-xs text-white/75">{isCard ? 'Used' : 'Balance'}</p>
              <p className="relative font-heading text-3xl font-semibold tabular-nums">
                {balanceValid ? formatMoney(balance, currency, false) : '—'}
                {isCard && (
                  <span className="text-base font-medium text-white/75"> / {limit > 0 ? formatMoney(limit, currency, false) : 'limit'}</span>
                )}
              </p>
              {isSavings && (
                <p className="relative mt-3 text-xs text-white/80">
                  Put in {formatMoney(Math.max(0, balance - interestEarned), currency, false)} · Interest earned {formatMoney(interestEarned, currency, false)}
                  {rate > 0 && balance > 0 ? ` · ≈ ${formatMoney(yearlyInterest, currency, false)}/yr` : ''}
                </p>
              )}
              {isCard && (
                <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-white/25" aria-hidden="true">
                  <div className="h-full rounded-full bg-white transition-all" style={{ width: `${usedPct}%` }} />
                </div>
              )}
            </div>

            {/* Type */}
            <div role="group" aria-label="Wallet type" className="grid grid-cols-3 gap-1 rounded-2xl bg-secondary p-1 sm:grid-cols-6">
              {WALLET_TYPES.map(({ value, label: text, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={type === value}
                  onClick={() => changeType(value)}
                  className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold transition-colors ${
                    type === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {text}
                </button>
              ))}
            </div>

            {/* Institution picker */}
            {kinds && (
              <div>
                <p className={label}>{type === 'ewallet' ? 'Provider' : type === 'credit_card' ? 'Card issuer' : 'Bank'}</p>
                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search"
                    aria-label="Search institutions"
                    className={`${field} pl-10`}
                  />
                </div>
                <div className="max-h-56 space-y-3 overflow-y-auto pr-1">
                  {sections.length === 0 && <p className="text-sm text-muted-foreground">No match. You can still name the wallet yourself.</p>}
                  {sections.map((section) => (
                    <div key={section.kind}>
                      {kinds.length > 1 && (
                        <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">{INSTITUTION_KIND_LABEL[section.kind]}</p>
                      )}
                      <div className="grid grid-cols-3 gap-2">
                        {section.items.map((item) => {
                          const selected = item.id === institution
                          return (
                            <button
                              key={item.id}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => pickInstitution(item.id)}
                              className={`relative flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-2.5 text-center transition-colors ${
                                selected ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-primary/50'
                              }`}
                            >
                              <InstitutionLogo institution={item} className="size-9" />
                              <span className="line-clamp-1 w-full text-[11px] font-medium text-foreground">{item.short}</span>
                              {selected && (
                                <span className="absolute right-1.5 top-1.5 rounded-full bg-primary p-0.5 text-primary-foreground">
                                  <Check className="h-2.5 w-2.5" />
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isSavings && (
              <div className="space-y-3">
                <div>
                  <p className={label}>Account type</p>
                  <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {SAVINGS_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        aria-pressed={presetId === preset.id}
                        onClick={() => applyPreset(preset)}
                        className={`shrink-0 rounded-2xl border px-3.5 py-2 text-left transition-colors ${
                          presetId === preset.id ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-primary/50'
                        }`}
                      >
                        <span className="block text-sm font-semibold text-foreground">{preset.label}</span>
                        <span className="block text-[11px] text-muted-foreground">{preset.hint}</span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">Rates are starting points. Change them to match your account.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className={label}>Interest per year</p>
                    <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 focus-within:ring-2 focus-within:ring-primary">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={rateText}
                        onChange={(event) => setRateText(event.target.value.replace(/[^0-9.]/g, ''))}
                        placeholder="0"
                        aria-label="Interest rate per year"
                        className="min-w-0 flex-1 bg-transparent text-sm tabular-nums text-foreground placeholder:text-muted-foreground focus:outline-none"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                  <div>
                    <p className={label}>Tax withheld</p>
                    <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 focus-within:ring-2 focus-within:ring-primary">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={taxText}
                        onChange={(event) => setTaxText(event.target.value.replace(/[^0-9.]/g, ''))}
                        placeholder="0"
                        aria-label="Tax withheld on interest"
                        className="min-w-0 flex-1 bg-transparent text-sm tabular-nums text-foreground placeholder:text-muted-foreground focus:outline-none"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className={label}>Interest is paid</p>
                  <div role="group" aria-label="Interest payout" className="grid grid-cols-4 gap-1 rounded-2xl bg-secondary p-1">
                    {PAYOUT_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={payout === option.value}
                        onClick={() => setPayout(option.value)}
                        className={`rounded-xl px-1 py-2 text-xs font-semibold transition-colors ${
                          payout === option.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className={label}>{payout === 'maturity' ? 'Matures on' : 'Matures on (optional)'}</p>
                  <input
                    type="date"
                    value={maturity}
                    onChange={(event) => setMaturity(event.target.value)}
                    aria-label="Maturity date"
                    className={field}
                  />
                </div>
              </div>
            )}

            {/* Name + balance */}
            <div>
              <p className={label}>Name</p>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={chosen ? chosen.short : 'Main wallet'}
                aria-label="Wallet name"
                className={field}
              />
            </div>

            {isCard && (
              <div>
                <p className={label}>Credit limit</p>
                <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 focus-within:ring-2 focus-within:ring-primary">
                  <span className="text-lg text-muted-foreground">{currencySymbol(currency)}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={limitText}
                    onChange={(event) => setLimitText(event.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="50,000"
                    aria-label="Credit limit"
                    className="min-w-0 flex-1 bg-transparent font-heading text-2xl font-semibold tabular-nums text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                </div>
              </div>
            )}

            {isCard && (
              <div>
                <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className={label}>Statement day</p>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={statementText}
                    onChange={(event) => setStatementText(event.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
                    placeholder="e.g. 5"
                    aria-label="Statement day of the month"
                    className={field}
                  />
                </div>
                <div>
                  <p className={label}>Due day</p>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={dueText}
                    onChange={(event) => setDueText(event.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
                    placeholder="e.g. 20"
                    aria-label="Payment due day of the month"
                    className={field}
                  />
                </div>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">With a due day, Fico adds a payment bill for what you owe each month.</p>
              </div>
            )}

            <div>
              <p className={label}>{isCard ? (isEdit ? 'Amount used (override)' : 'Already used (optional)') : isSavings && !isEdit ? 'Amount put in' : isEdit ? 'Balance (override)' : 'Starting balance'}</p>
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 focus-within:ring-2 focus-within:ring-primary">
                <span className="text-lg text-muted-foreground">{currencySymbol(currency)}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={balanceText}
                  onChange={(event) => setBalanceText(event.target.value.replace(/[^0-9.-]/g, ''))}
                  placeholder="0.00"
                  aria-label="Balance"
                  className="min-w-0 flex-1 bg-transparent font-heading text-2xl font-semibold tabular-nums text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
              {isEdit && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Directly sets the balance. Transactions do not adjust it after an import, so use this to reconcile.
                </p>
              )}
            </div>

            {/* Color */}
            <div>
              <p className={label}>Color</p>
              <div className="flex flex-wrap gap-2">
                {SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    aria-label={`Color ${swatch}`}
                    aria-pressed={color.toLowerCase() === swatch.toLowerCase()}
                    onClick={() => setColor(swatch)}
                    className="flex size-8 items-center justify-center rounded-full border-2 border-transparent ring-offset-2 ring-offset-card transition-shadow aria-pressed:ring-2 aria-pressed:ring-primary"
                    style={{ backgroundColor: swatch }}
                  >
                    {color.toLowerCase() === swatch.toLowerCase() && <Check className="h-4 w-4 text-white" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Details */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className={label}>Account / card no.</p>
                <input
                  type="text"
                  inputMode="numeric"
                  value={accountNumber}
                  onChange={(event) => setAccountNumber(event.target.value)}
                  placeholder="Last 4 digits is enough"
                  aria-label="Account number"
                  className={field}
                />
              </div>
              <div>
                <p className={label}>Note</p>
                <input
                  type="text"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Optional"
                  aria-label="Note"
                  className={field}
                />
              </div>
            </div>
          </div>

          <div data-vaul-no-drag className="shrink-0 border-t border-border px-4 pb-4 pt-3">
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="h-12 w-full rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-ios transition-opacity disabled:opacity-60"
            >
              {saveLabel}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
