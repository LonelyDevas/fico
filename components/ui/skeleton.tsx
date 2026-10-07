import { cn } from '@/lib/utils'

/**
 * Placeholder block shown while data loads, so a page never flashes zeros or "nothing here yet"
 * before the real numbers arrive. Pass a background (e.g. `bg-white/20`) to use it on a gradient.
 */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('block animate-pulse rounded-xl bg-secondary', className)} />
}
