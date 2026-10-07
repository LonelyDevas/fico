'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { PeacockMascot } from '@/components/peacock-mascot'
import { useCelebrationStore, type Celebration, type CelebrationKind } from '@/store/celebration-store'

const CONFETTI_COLORS = ['#0066CC', '#00D9CC', '#2ECC71', '#E8A33D', '#FF8FB1', '#7C5CFF']

type Piece = { x: number; y: number; rot: number; delay: number; color: string; size: number; round: boolean; fall: number; left: number }

const rand = (min: number, max: number) => min + Math.random() * (max - min)

/** A fresh random set of pieces each time a celebration opens. */
function makePieces(kind: CelebrationKind): Piece[] {
  const count = kind === 'check' ? 16 : kind === 'coins' ? 22 : 46
  return Array.from({ length: count }, (_, i) => {
    // Confetti fans out upward from the mascot; coins fall from the top of the screen.
    const angle = Math.PI + rand(0.15, Math.PI - 0.15)
    const distance = rand(110, 230)
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      rot: rand(-540, 540),
      delay: kind === 'coins' ? rand(0, 1.4) : rand(0, 0.18),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: kind === 'coins' ? rand(22, 34) : rand(6, 12),
      round: Math.random() < 0.3,
      fall: rand(240, 460),
      left: rand(4, 96),
    }
  })
}

function Particles({ kind }: { kind: CelebrationKind }) {
  const pieces = useMemo(() => makePieces(kind), [kind])
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) =>
        kind === 'coins' ? (
          <span
            key={i}
            className="cel-coin"
            style={{ left: `${p.left}%`, width: p.size, height: p.size, animationDelay: `${p.delay}s`, '--fall': `${p.fall + 400}px` } as CSSProperties}
          />
        ) : (
          <span
            key={i}
            className="cel-piece"
            style={
              {
                width: p.size,
                height: p.round ? p.size : p.size * 0.45,
                borderRadius: p.round ? '999px' : '2px',
                backgroundColor: p.color,
                animationDelay: `${p.delay}s`,
                '--x': `${p.x}px`,
                '--y': `${p.y}px`,
                '--r': `${p.rot}deg`,
                '--fall': `${p.fall}px`,
              } as CSSProperties
            }
          />
        )
      )}
    </div>
  )
}

function CheckBadge() {
  return (
    <div className="relative mx-auto flex size-24 items-center justify-center">
      <span className="cel-ring absolute inset-0 rounded-full bg-success/25" />
      <svg viewBox="0 0 56 56" className="relative size-24" fill="none">
        <circle cx="28" cy="28" r="26" className="cel-check-circle" stroke="#2ECC71" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M17 29.5l7.5 7.5L39 21" className="cel-check-tick" stroke="#2ECC71" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function Content({ celebration, onClose }: { celebration: Celebration; onClose: () => void }) {
  const { kind, title, message, highlight, actionLabel, onAction } = celebration
  return (
    <div className="pointer-events-auto relative w-[min(92vw,22rem)] overflow-hidden rounded-3xl border border-border bg-card px-6 pb-6 pt-7 text-center shadow-ios-lg animate-in fade-in zoom-in-95 duration-300">
      <Particles kind={kind} />
      <div className="relative">
        {kind === 'check' ? <CheckBadge /> : <PeacockMascot pose="happy" className="mx-auto h-28 w-28" label="" />}
        <DialogPrimitive.Title className="mt-3 font-heading text-2xl font-semibold leading-tight text-foreground">{title}</DialogPrimitive.Title>
        {message ? (
          <DialogPrimitive.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">{message}</DialogPrimitive.Description>
        ) : (
          <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
        )}
        {highlight && (
          <p className="mt-4 rounded-2xl bg-secondary/60 py-3 font-heading text-xl font-semibold tabular-nums text-foreground">{highlight}</p>
        )}
        <button
          type="button"
          onClick={() => {
            onAction?.()
            onClose()
          }}
          className="mt-6 h-12 w-full rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-ios transition-opacity hover:opacity-90"
        >
          {actionLabel ?? (kind === 'check' ? 'Done' : 'Awesome!')}
        </button>
      </div>
    </div>
  )
}

/** Mount once. Open it from anywhere with `celebrate({ kind, title, ... })`. */
export function CelebrationHost() {
  const current = useCelebrationStore((s) => s.current)
  const dismiss = useCelebrationStore((s) => s.dismiss)
  // Keep the last content on screen while the dialog fades out.
  const [shown, setShown] = useState<Celebration | null>(null)
  useEffect(() => {
    if (current) setShown(current)
  }, [current])

  return (
    <DialogPrimitive.Root open={current !== null} onOpenChange={(open) => !open && dismiss()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-x-0 top-0 z-[70] bg-black/60 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
          style={{ height: 'var(--app-h, 100dvh)' }}
        />
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[71] flex items-center justify-center p-4" style={{ height: 'var(--app-h, 100dvh)' }}>
          <DialogPrimitive.Content className="outline-none" onOpenAutoFocus={(e) => e.preventDefault()}>
            {shown && <Content key={shown.title + shown.kind} celebration={shown} onClose={dismiss} />}
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
