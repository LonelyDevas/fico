import { create } from 'zustand'

/**
 * Recent changes that can be undone (and redone), newest first. Each entry undoes itself through the
 * same mutation path as the change, so balances and the sync queue stay right.
 *
 * Deletes wait a few seconds before they run: undoing inside that window cancels the delete, so the
 * sync queue never sends a delete and then a re-create. The row is hidden meanwhile (`pendingDeletes`).
 */
export interface UndoEntry {
  id: string
  /** What happened, e.g. "Deleted “Lunch”". */
  label: string
  at: number
  undo: () => Promise<void>
  redo: () => Promise<void>
}

/** How long a delete waits for Undo before it runs. */
export const DELETE_DELAY_MS = 5000
const KEEP = 10

interface UndoState {
  past: UndoEntry[]
  future: UndoEntry[]
  pendingDeletes: string[]
  push: (entry: Omit<UndoEntry, 'id' | 'at'>) => UndoEntry
  undo: (id?: string) => Promise<UndoEntry | null>
  redo: (id?: string) => Promise<UndoEntry | null>
  /** Hides `rowId` and runs `commit` after the delay unless cancelled. Returns a cancel function. */
  deferDelete: (rowId: string, commit: () => Promise<void>) => { cancel: () => boolean; flush: () => Promise<void> }
  /** Runs every delete still waiting (the app is closing). */
  flushDeletes: () => Promise<void>
}

const timers = new Map<string, { timer: ReturnType<typeof setTimeout>; commit: () => Promise<void> }>()

export const useUndoStore = create<UndoState>((set, get) => ({
  past: [],
  future: [],
  pendingDeletes: [],

  push(entry) {
    const full = { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at: Date.now() }
    set((s) => ({ past: [full, ...s.past].slice(0, KEEP), future: [] }))
    return full
  },

  async undo(id) {
    const entry = id ? get().past.find((e) => e.id === id) : get().past[0]
    if (!entry) return null
    await entry.undo()
    set((s) => ({ past: s.past.filter((e) => e.id !== entry.id), future: [entry, ...s.future].slice(0, KEEP) }))
    return entry
  },

  async redo(id) {
    const entry = id ? get().future.find((e) => e.id === id) : get().future[0]
    if (!entry) return null
    await entry.redo()
    set((s) => ({ future: s.future.filter((e) => e.id !== entry.id), past: [entry, ...s.past].slice(0, KEEP) }))
    return entry
  },

  deferDelete(rowId, commit) {
    const done = () => {
      timers.delete(rowId)
      set((s) => ({ pendingDeletes: s.pendingDeletes.filter((x) => x !== rowId) }))
    }
    const run = async () => {
      const t = timers.get(rowId)
      if (!t) return
      clearTimeout(t.timer)
      try {
        await t.commit()
      } finally {
        done()
      }
    }
    set((s) => ({ pendingDeletes: [...s.pendingDeletes.filter((x) => x !== rowId), rowId] }))
    timers.set(rowId, { timer: setTimeout(run, DELETE_DELAY_MS), commit })
    return {
      cancel: () => {
        const t = timers.get(rowId)
        if (!t) return false
        clearTimeout(t.timer)
        done()
        return true
      },
      flush: run,
    }
  },

  async flushDeletes() {
    await Promise.all(
      [...timers.entries()].map(async ([rowId, t]) => {
        clearTimeout(t.timer)
        timers.delete(rowId)
        try {
          await t.commit()
        } finally {
          set((s) => ({ pendingDeletes: s.pendingDeletes.filter((x) => x !== rowId) }))
        }
      })
    )
  },
}))

// A delete waiting for Undo still runs if the app is closed or hidden before the window ends.
if (typeof window !== 'undefined') {
  const flush = () => void useUndoStore.getState().flushDeletes()
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush())
}
