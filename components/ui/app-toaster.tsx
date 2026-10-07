'use client'

import { useRef } from 'react'
import { Toaster, toast, resolveValue, type Toast } from 'react-hot-toast'
import { CheckCircle2, Info, Loader2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const TONES: Record<string, string> = {
  success: 'bg-success/15 text-success',
  error: 'bg-destructive/15 text-destructive',
  loading: 'bg-primary/10 text-primary',
  blank: 'bg-primary/10 text-primary',
  custom: 'bg-primary/10 text-primary',
}

function ToastCard({ t }: { t: Toast }) {
  const startY = useRef<number | null>(null)
  const Icon = t.type === 'success' ? CheckCircle2 : t.type === 'error' ? XCircle : t.type === 'loading' ? Loader2 : Info

  const swipeEnd = (clientY: number) => {
    if (startY.current !== null && startY.current - clientY > 18) toast.dismiss(t.id)
    startY.current = null
  }

  return (
    <div
      role={t.type === 'error' ? 'alert' : 'status'}
      onClick={() => toast.dismiss(t.id)}
      onPointerDown={(e) => { startY.current = e.clientY }}
      onPointerUp={(e) => swipeEnd(e.clientY)}
      onPointerCancel={() => { startY.current = null }}
      className={cn(
        'pointer-events-auto flex w-[min(92vw,24rem)] cursor-pointer select-none items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3 text-foreground shadow-ios-lg',
        t.visible
          ? 'animate-in fade-in slide-in-from-top-4 duration-300'
          : 'animate-out fade-out slide-out-to-top-4 duration-200 fill-mode-forwards'
      )}
    >
      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', TONES[t.type] ?? TONES.blank)}>
        <Icon size={18} className={t.type === 'loading' ? 'animate-spin' : undefined} />
      </span>
      <p className="min-w-0 flex-1 text-sm font-medium leading-snug">{resolveValue(t.message, t)}</p>
    </div>
  )
}

/**
 * App-wide toasts: a card that drops in at the top centre, just under the status bar / Dynamic
 * Island (safe-area aware). Tap it, or swipe it up, to dismiss.
 */
export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      gutter={8}
      containerStyle={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}
      toastOptions={{ duration: 3200, error: { duration: 4500 } }}
    >
      {(t) => <ToastCard t={t} />}
    </Toaster>
  )
}
