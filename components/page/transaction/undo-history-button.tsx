'use client'

import { useState } from 'react'
import { formatDistanceToNowStrict } from 'date-fns'
import toast from 'react-hot-toast'
import { Redo2, Undo2 } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useUndoStore } from '@/store/undo-store'
import { handleApiError } from '@/utils/error-handler'

/** Activity header button: the last few changes, each with Undo, and Redo for what was just undone. */
export function UndoHistoryButton() {
  const past = useUndoStore((s) => s.past)
  const future = useUndoStore((s) => s.future)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  if (past.length === 0 && future.length === 0) return null

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true)
    try {
      await fn()
      toast.success(done)
    } catch (error) {
      handleApiError(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Undo recent changes"
          className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-semibold text-foreground shadow-ios hover:border-primary/50"
        >
          <Undo2 className="h-4 w-4 text-primary" />
          <span className="hidden sm:inline">Undo</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        {future[0] && (
          <div className="mb-1 flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2">
            <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">Undone: {future[0].label}</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => useUndoStore.getState().redo(future[0].id), 'Redone')}
              className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
            >
              <Redo2 className="h-3.5 w-3.5" /> Redo
            </button>
          </div>
        )}
        {past.length === 0 ? (
          <p className="px-3 py-2 text-sm text-muted-foreground">Nothing left to undo.</p>
        ) : (
          <ul>
            {past.map((entry) => (
              <li key={entry.id} className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-secondary/50">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{entry.label}</p>
                  <p className="text-xs text-muted-foreground">{formatDistanceToNowStrict(entry.at)} ago</p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => useUndoStore.getState().undo(entry.id), 'Undone')}
                  className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                >
                  <Undo2 className="h-3.5 w-3.5" /> Undo
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
