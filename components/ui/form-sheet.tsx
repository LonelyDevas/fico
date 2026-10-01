'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { useSettingsStore } from '@/store/settings-store'

/** Shared look for the app's bottom-sheet / side-panel forms (same as the wallet and quick-add sheets). */
export const labelClass = 'mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground'
export const fieldClass =
  'w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary'
export const chipClass = (selected: boolean) =>
  `shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
    selected ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-foreground hover:border-primary/50'
  }`
export const scrollRowClass = 'flex gap-2 overflow-x-auto px-1 pb-1 -mx-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'

export const currencySymbol = (currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? currency
  } catch {
    return currency
  }
}

interface FormSheetProps {
  open: boolean
  onClose: () => void
  title: string
  /** Read by screen readers only. */
  description: string
  submitLabel: string
  onSubmit: () => void
  busy?: boolean
  submitDisabled?: boolean
  children: ReactNode
}

export function FormSheet({ open, onClose, title, description, submitLabel, onSubmit, busy, submitDisabled, children }: FormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="max-h-[94dvh] p-0 md:max-h-none md:max-w-md" showCloseButton={false}>
        <div className="flex h-full min-h-0 flex-col bg-card md:rounded-2xl">
          <div className="flex items-center justify-between px-5 pb-2 pt-1">
            <SheetTitle className="font-heading text-lg font-semibold text-foreground">{title}</SheetTitle>
            <SheetDescription className="sr-only">{description}</SheetDescription>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div data-vaul-no-drag className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-4">
            {children}
          </div>

          <div data-vaul-no-drag className="shrink-0 border-t border-border px-4 pb-4 pt-3">
            <button
              type="button"
              onClick={onSubmit}
              disabled={busy || submitDisabled}
              className="h-12 w-full rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-ios transition-opacity disabled:opacity-60"
            >
              {busy ? 'Saving…' : submitLabel}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** Large amount input with the currency symbol, used for every money field in these sheets. */
export function MoneyField({
  value,
  onChange,
  ariaLabel,
  placeholder = '0.00',
}: {
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  placeholder?: string
}) {
  const { currency } = useSettingsStore()
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 focus-within:ring-2 focus-within:ring-primary">
      <span className="text-lg text-muted-foreground">{currencySymbol(currency)}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/[^0-9.]/g, ''))}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="min-w-0 flex-1 bg-transparent font-heading text-2xl font-semibold tabular-nums text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
    </div>
  )
}

/** Small labelled block: label on top, control below. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <p className={labelClass}>{label}</p>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
