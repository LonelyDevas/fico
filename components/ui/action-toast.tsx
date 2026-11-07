'use client'

import type { ReactNode } from 'react'
import toast from 'react-hot-toast'

/**
 * A toast with one action button, such as "Undo" or "Create rule". Tapping the button runs the
 * action and closes the toast; tapping elsewhere just closes it, like any other toast.
 */
export function actionToast(message: ReactNode, actionLabel: string, onAction: () => void, options?: { duration?: number; id?: string }) {
  return toast(
    (t) => (
      <span className="flex items-center gap-3">
        <span className="min-w-0 flex-1">{message}</span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            toast.dismiss(t.id)
            onAction()
          }}
          className="shrink-0 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15"
        >
          {actionLabel}
        </button>
      </span>
    ),
    { duration: options?.duration ?? 6000, id: options?.id }
  )
}
