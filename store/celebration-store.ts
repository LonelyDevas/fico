import { create } from 'zustand'

/**
 * confetti: a milestone (debt cleared, welcome). coins: money events. check: a serious confirmation.
 */
export type CelebrationKind = 'confetti' | 'coins' | 'check'

export interface Celebration {
  kind: CelebrationKind
  title: string
  message?: string
  /** A big figure shown under the message, e.g. the amount. */
  highlight?: string
  actionLabel?: string
  onAction?: () => void
}

interface CelebrationState {
  current: Celebration | null
  celebrate: (celebration: Celebration) => void
  dismiss: () => void
}

export const useCelebrationStore = create<CelebrationState>((set) => ({
  current: null,
  celebrate: (celebration) => set({ current: celebration }),
  dismiss: () => set({ current: null }),
}))

/** Call from anywhere (including mutation callbacks): `celebrate({ kind: 'confetti', title: '…' })`. */
export const celebrate = (celebration: Celebration) => useCelebrationStore.getState().celebrate(celebration)
