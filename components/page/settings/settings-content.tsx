'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { Bell, CalendarDays, Check, ChevronRight, Coins, Download, EyeOff, House, LayoutList, LogOut, Moon, RotateCcw, Trash2, UserRound } from 'lucide-react'
import { ConfirmSheet } from '@/components/ui/confirm-sheet'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { DEFAULT_SETTINGS, useSettingsStore } from '@/store/settings-store'
import { useAuthStore } from '@/store/auth-store'
import { useDeleteMyAccount, useLogout, useResetMyData } from '@/queries/auth/auth'
import { useRootNavigate } from '@/utils/use-root-navigate'
import { useThemeStore } from '@/store/theme-store'
import { formatMoney } from '@/utils/formatter'
import { cn } from '@/lib/utils'
import { currentPushSubscription, disablePush, enablePush, pushSupport, sendTestPush, type PushSupport } from '@/utils/push'
import type { CurrencyCode, DateFormat, LandingPage } from '@/types/settings'

const currencyOptions: { value: CurrencyCode; label: string; symbol: string }[] = [
  { value: 'PHP', label: 'Philippine Peso', symbol: '₱' },
  { value: 'USD', label: 'US Dollar', symbol: '$' },
  { value: 'EUR', label: 'Euro', symbol: '€' },
  { value: 'GBP', label: 'British Pound', symbol: '£' },
  { value: 'CAD', label: 'Canadian Dollar', symbol: 'C$' },
  { value: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
  { value: 'NGN', label: 'Nigerian Naira', symbol: '₦' },
  { value: 'GHS', label: 'Ghanaian Cedi', symbol: 'GH₵' },
  { value: 'KES', label: 'Kenyan Shilling', symbol: 'KSh' },
  { value: 'ZAR', label: 'South African Rand', symbol: 'R' },
]

const landingPageOptions: { value: LandingPage; label: string; description: string }[] = [
  { value: '/dashboard', label: 'Home', description: 'The overview with your balance and latest activity.' },
  { value: '/transactions', label: 'Activity', description: 'Straight to your transactions.' },
  { value: '/wallets', label: 'Money', description: 'Your wallets and balances first.' },
  { value: '/bills', label: 'Bills', description: 'Upcoming bills and due dates.' },
  { value: '/budgets', label: 'Budgets', description: 'Your spending targets first.' },
]

const dateFormatOptions: { value: DateFormat; token: string }[] = [
  { value: 'MM/DD/YYYY', token: 'MM/dd/yyyy' },
  { value: 'DD/MM/YYYY', token: 'dd/MM/yyyy' },
  { value: 'YYYY-MM-DD', token: 'yyyy-MM-dd' },
]

const TONES = {
  primary: 'bg-primary/10 text-primary',
  warning: 'bg-warning/15 text-warning',
  success: 'bg-success/15 text-success',
  neutral: 'bg-secondary text-foreground',
  destructive: 'bg-destructive/10 text-destructive',
} as const

/** iOS-style switch: a big, easy thumb target. */
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={(event) => {
        // The whole row also toggles on tap; without this the tap would reach the row and flip it twice.
        event.stopPropagation()
        onChange(!checked)
      }}
      className={cn(
        'relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200',
        checked ? 'bg-success' : 'bg-secondary ring-1 ring-inset ring-border'
      )}
    >
      <span
        className={cn(
          'absolute left-0.5 top-0.5 size-[27px] rounded-full bg-white shadow-md transition-transform duration-200',
          checked ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  )
}

interface RowProps {
  icon: ReactNode
  tone?: keyof typeof TONES
  label: string
  hint?: string
  /** Current value shown on the right, with a chevron: tapping opens a picker. */
  value?: string
  onClick?: () => void
  to?: string
  /** A control on the right, such as a switch. The whole row toggles it. */
  control?: ReactNode
  onRowClick?: () => void
  destructive?: boolean
  /** A small pill after the label, e.g. "3 changed". */
  badge?: string
}

function Row({ icon, tone = 'neutral', label, hint, value, onClick, to, control, onRowClick, destructive, badge }: RowProps) {
  const body = (
    <>
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', TONES[destructive ? 'destructive' : tone])}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[15px] font-medium leading-tight', destructive ? 'text-destructive' : 'text-foreground')}>{label}
          {badge && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 align-middle text-[11px] font-semibold text-primary">{badge}</span>}
        </span>
        {hint && <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{hint}</span>}
      </span>
      {value && <span className="max-w-[40%] shrink-0 truncate text-sm text-muted-foreground">{value}</span>}
      {control}
      {(onClick || to) && <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />}
    </>
  )
  const base = 'flex min-h-[3.75rem] w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-secondary/60'

  if (to) return <Link to={to} className={base}>{body}</Link>
  if (onClick) return <button type="button" onClick={onClick} className={base}>{body}</button>
  if (onRowClick) return <div role="presentation" onClick={onRowClick} className={cn(base, 'cursor-pointer')}>{body}</div>
  return <div className={base}>{body}</div>
}

function Group({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  return (
    <section>
      {title && <h2 className="mb-2 px-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</h2>}
      <div className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card shadow-ios">{children}</div>
      {footer && <p className="mt-2 px-4 text-xs leading-relaxed text-muted-foreground">{footer}</p>}
    </section>
  )
}

interface PickerOption<T extends string> {
  value: T
  label: string
  description?: string
  leading?: ReactNode
  badge?: string
}

/** A bottom sheet with big tap rows, instead of a small dropdown. */
function Picker<T extends string>({
  open,
  onOpenChange,
  title,
  description,
  options,
  value,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  options: PickerOption<T>[]
  value: T
  onSelect: (value: T) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-h-[85dvh] p-0 sm:max-w-md" showCloseButton={false}>
        <SheetHeader className="border-b-0 pb-2">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription className={description ? undefined : 'sr-only'}>{description ?? title}</SheetDescription>
        </SheetHeader>
        <div data-vaul-no-drag className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-6">
          {options.map((option) => {
            const selected = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onSelect(option.value)
                  onOpenChange(false)
                }}
                className={cn(
                  'flex min-h-[3.5rem] w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors',
                  selected ? 'bg-primary/10' : 'active:bg-secondary/70 hover:bg-secondary/50'
                )}
              >
                {option.leading && (
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-sm font-semibold text-foreground">{option.leading}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-[15px] font-medium', selected ? 'text-primary' : 'text-foreground')}>
                    {option.label}
                    {option.badge && <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 align-middle text-[11px] font-semibold text-muted-foreground">{option.badge}</span>}
                  </span>
                  {option.description && <span className="mt-0.5 block text-xs text-muted-foreground">{option.description}</span>}
                </span>
                {selected && <Check className="size-5 shrink-0 text-primary" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** Concentric eye-spot rings, the same motif as the peacock's tail feathers. */
function EyeSpots() {
  return (
    <svg viewBox="0 0 200 200" className="pointer-events-none absolute -bottom-10 -right-10 h-52 w-52 opacity-25" aria-hidden="true">
      <g transform="translate(120 110)">
        <circle r="70" fill="#00D9CC" />
        <circle r="48" fill="#0066CC" />
        <circle r="28" fill="#00D9CC" />
        <circle r="11" fill="#2ECC71" />
      </g>
    </svg>
  )
}

const PUSH_HINTS: Record<PushSupport, string> = {
  ready: 'Get a heads up on this device when bills are overdue or due soon.',
  'needs-install': 'On iPhone, add Fico to your Home Screen first, then open it from there to turn this on.',
  unsupported: 'This browser cannot show notifications.',
  unconfigured: 'Reminders are not set up on the server yet.',
}

function BillReminderRow() {
  const [support, setSupport] = useState<PushSupport>('unsupported')
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const state = pushSupport()
    setSupport(state)
    if (state === 'ready') currentPushSubscription().then((sub) => setEnabled(!!sub)).catch(() => {})
  }, [])

  const change = async (next: boolean) => {
    setBusy(true)
    try {
      if (next) {
        await enablePush()
        setEnabled(true)
        await sendTestPush().catch(() => {})
        toast.success('Bill reminders are on')
      } else {
        await disablePush()
        setEnabled(false)
        toast.success('Bill reminders are off')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not change reminders')
    } finally {
      setBusy(false)
    }
  }

  const usable = support === 'ready' && !busy
  return (
    <Row
      icon={<Bell className="size-[18px]" />}
      tone="primary"
      label="Bill reminders"
      hint={PUSH_HINTS[support]}
      onRowClick={usable ? () => change(!enabled) : undefined}
      control={<Toggle checked={enabled} onChange={(next) => usable && change(next)} label="Bill reminders" />}
    />
  )
}

export function SettingsPageContent() {
  const settings = useSettingsStore()
  const { isDarkMode, setDarkMode } = useThemeStore()
  const [picker, setPicker] = useState<null | 'currency' | 'landing' | 'date'>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [confirmWipe, setConfirmWipe] = useState<null | 'data' | 'account'>(null)
  const [wipeText, setWipeText] = useState('')
  const user = useAuthStore((state) => state.user)
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const { mutate: logout, isPending: signingOut } = useLogout()
  const rootNavigate = useRootNavigate()
  const { mutate: resetData, isPending: resettingData } = useResetMyData()
  const { mutate: deleteAccount, isPending: deletingAccount } = useDeleteMyAccount()

  const closeWipe = (open: boolean) => {
    if (open) return
    setConfirmWipe(null)
    setWipeText('')
  }
  const handleWipe = () => {
    if (confirmWipe === 'data') {
      resetData(undefined, {
        onSuccess: () => {
          closeWipe(false)
          toast.success('All your data was erased')
          rootNavigate('/dashboard', { clearCache: true })
        },
      })
    } else {
      deleteAccount(undefined, {
        onSuccess: () => {
          closeWipe(false)
          clearAuth()
          toast.success('Your account was deleted')
          rootNavigate('/signin', { clearCache: true })
        },
      })
    }
  }

  // How many of the settings differ from the defaults: shown as a badge on Reset.
  const changedCount = (['currency', 'hideAmountsOnOpen', 'compactLayout', 'defaultLandingPage', 'dateFormat'] as const).filter(
    (key) => settings[key] !== DEFAULT_SETTINGS[key]
  ).length

  const downloadBackup = () => {
    const { currency, hideAmountsOnOpen, compactLayout, defaultLandingPage, dateFormat } = useSettingsStore.getState()
    const blob = new Blob([JSON.stringify({ currency, hideAmountsOnOpen, compactLayout, defaultLandingPage, dateFormat }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'fico-settings-backup.json'
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Backup saved')
  }

  const handleSignOut = () => {
    logout(undefined, {
      onSettled: () => {
        clearAuth()
        rootNavigate('/signin', { clearCache: true })
      },
    })
  }

  const currency = currencyOptions.find((o) => o.value === settings.currency) ?? currencyOptions[0]
  const landing = landingPageOptions.find((o) => o.value === settings.defaultLandingPage) ?? landingPageOptions[0]
  const dateToken = (dateFormatOptions.find((o) => o.value === settings.dateFormat) ?? dateFormatOptions[0]).token
  const today = new Date()

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-10 pt-5 sm:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Make it yours</p>
        <h1 className="mt-1 font-heading text-2xl font-semibold leading-tight text-foreground sm:text-3xl">Settings</h1>
      </div>

      {/* Live preview of the money settings */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-[#004C99] p-5 text-white shadow-ios-lg">
        <EyeSpots />
        <div className="relative">
          <p className="text-sm font-medium text-white/75">Preview</p>
          <p className="mt-1 font-heading text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
            {formatMoney(12584.32, settings.currency, settings.hideAmountsOnOpen)}
          </p>
          <p className="mt-1 text-xs text-white/75">
            {settings.hideAmountsOnOpen ? 'Balances start hidden when you open the app.' : 'Balances show as soon as you open the app.'}
          </p>
        </div>
      </section>

      <Group title="Look and feel">
        <Row
          icon={<Moon className="size-[18px]" />}
          tone="primary"
          label="Dark mode"
          hint="Easier on the eyes at night."
          onRowClick={() => setDarkMode(!isDarkMode)}
          control={<Toggle checked={isDarkMode} onChange={setDarkMode} label="Dark mode" />}
        />
        <Row
          icon={<LayoutList className="size-[18px]" />}
          tone="primary"
          label="Compact layout"
          hint="Tighter spacing to fit more on screen."
          onRowClick={settings.toggleCompactLayout}
          control={<Toggle checked={settings.compactLayout} onChange={settings.setCompactLayout} label="Compact layout" />}
        />
      </Group>

      <Group title="Money" footer="Hiding amounts keeps your balance private when someone is looking over your shoulder. Tap the eye on Home to show it.">
        <Row
          icon={<Coins className="size-[18px]" />}
          tone="warning"
          label="Currency"
          value={`${currency.symbol} ${currency.value}`}
          onClick={() => setPicker('currency')}
        />
        <Row
          icon={<EyeOff className="size-[18px]" />}
          tone="warning"
          label="Hide amounts when I open the app"
          onRowClick={settings.toggleHideAmountsOnOpen}
          control={<Toggle checked={settings.hideAmountsOnOpen} onChange={settings.setHideAmountsOnOpen} label="Hide amounts when I open the app" />}
        />
      </Group>

      <Group title="Notifications">
        <BillReminderRow />
      </Group>

      <Group title="Getting around">
        <Row
          icon={<House className="size-[18px]" />}
          tone="success"
          label="Open the app on"
          hint={landing.description}
          value={landing.label}
          onClick={() => setPicker('landing')}
        />
        <Row
          icon={<CalendarDays className="size-[18px]" />}
          tone="success"
          label="Date format"
          value={format(today, dateToken)}
          onClick={() => setPicker('date')}
        />
      </Group>

      <Group title="Account">
        <Row
          icon={<UserRound className="size-[18px]" />}
          label="Profile"
          hint="Name, photo, username and password."
          value={user?.username ? `@${user.username}` : undefined}
          to="/profile"
        />
        <Row icon={<LogOut className="size-[18px]" />} label="Sign out" onClick={() => setConfirmSignOut(true)} />
      </Group>

      <Group title="Danger zone" footer="These cannot be undone. Resetting keeps your account and settings; deleting removes your account completely.">
        <Row icon={<RotateCcw className="size-[18px]" />} label="Reset all data" destructive hint="Erase wallets, transactions, bills, budgets, debts and investments." onClick={() => setConfirmWipe('data')} />
        <Row icon={<Trash2 className="size-[18px]" />} label="Delete account" destructive hint="Permanently remove your account and everything in it." onClick={() => setConfirmWipe('account')} />
      </Group>

      <Group title="This device" footer="Your settings are saved on this device and apply right away.">
        <Row icon={<Download className="size-[18px]" />} tone="neutral" label="Save a settings backup" hint="Downloads a small file you can keep." onClick={downloadBackup} />
        <Row
          icon={<RotateCcw className="size-[18px]" />}
          label="Reset to defaults"
          destructive
          badge={changedCount > 0 ? `${changedCount} changed` : undefined}
          hint={changedCount === 0 ? 'Everything is already on its default.' : undefined}
          onClick={changedCount > 0 ? () => setConfirmReset(true) : undefined}
        />
      </Group>

      <Picker
        open={picker === 'currency'}
        onOpenChange={(open) => !open && setPicker(null)}
        title="Currency"
        description="Used for every amount in the app."
        options={currencyOptions.map((o) => ({ value: o.value, label: o.label, description: o.value, leading: o.symbol, badge: o.value === DEFAULT_SETTINGS.currency ? 'Default' : undefined }))}
        value={settings.currency}
        onSelect={(value) => {
          settings.setCurrency(value)
          toast.success(`Currency set to ${value}`)
        }}
      />
      <Picker
        open={picker === 'landing'}
        onOpenChange={(open) => !open && setPicker(null)}
        title="Open the app on"
        description="The first screen you see after signing in."
        options={landingPageOptions.map((o) => ({ value: o.value, label: o.label, description: o.description, badge: o.value === DEFAULT_SETTINGS.defaultLandingPage ? 'Default' : undefined }))}
        value={settings.defaultLandingPage}
        onSelect={(value) => {
          settings.setDefaultLandingPage(value)
          toast.success('Start screen updated')
        }}
      />
      <Picker
        open={picker === 'date'}
        onOpenChange={(open) => !open && setPicker(null)}
        title="Date format"
        options={dateFormatOptions.map((o) => ({ value: o.value, label: format(today, o.token), description: o.value, badge: o.value === DEFAULT_SETTINGS.dateFormat ? 'Default' : undefined }))}
        value={settings.dateFormat}
        onSelect={(value) => {
          settings.setDateFormat(value)
          toast.success('Date format updated')
        }}
      />

      <ConfirmSheet
        open={confirmSignOut}
        onOpenChange={setConfirmSignOut}
        title="Sign out of Fico?"
        description="You can sign back in any time. Your data stays safe in your account."
        confirmLabel="Sign out"
        isConfirming={signingOut}
        confirmingLabel="Signing out..."
        onConfirm={handleSignOut}
      />

      <ConfirmSheet
        open={confirmWipe !== null}
        onOpenChange={closeWipe}
        variant="destructive"
        title={confirmWipe === 'account' ? 'Delete your account?' : 'Erase all your data?'}
        description={
          confirmWipe === 'account'
            ? 'Your account, wallets, transactions and everything else will be permanently deleted. You will need to sign up again to use Fico.'
            : 'All wallets, transactions, bills, budgets, debts, investments and your own categories will be permanently erased. Your account and settings stay.'
        }
        confirmLabel={confirmWipe === 'account' ? 'Delete account' : 'Erase everything'}
        isConfirming={resettingData || deletingAccount}
        confirmingLabel="Working..."
        confirmDisabled={wipeText.trim().toUpperCase() !== (confirmWipe === 'account' ? 'DELETE' : 'RESET')}
        onConfirm={handleWipe}
      >
        <input
          value={wipeText}
          onChange={(e) => setWipeText(e.target.value)}
          placeholder={`Type ${confirmWipe === 'account' ? 'DELETE' : 'RESET'} to confirm`}
          aria-label="Type the word to confirm"
          autoCapitalize="characters"
          autoComplete="off"
          className="mt-4 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-destructive/40"
        />
      </ConfirmSheet>

      <ConfirmSheet
        open={confirmReset}
        onOpenChange={setConfirmReset}
        variant="destructive"
        title="Reset settings?"
        description="Currency, privacy, layout and start screen go back to their defaults. Your wallets and transactions are not touched."
        confirmLabel="Reset"
        onConfirm={() => {
          settings.resetSettings()
          setConfirmReset(false)
          toast.success('Settings reset')
        }}
      />
    </main>
  )
}
