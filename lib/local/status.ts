// Observable sync state, read by the UI (offline badge) and by the query provider.
import { useSyncExternalStore } from 'react'

export interface SyncFailure {
  /** Short description of the change that could not be saved, e.g. "bills_mark_paid". */
  what: string
  message: string
  at: number
}

export interface SyncStatus {
  /** The local database is on and answering queries. */
  active: boolean
  /** First sign-in on this device: the offline copy is still downloading. */
  preparing: boolean
  /** Tables finished so far in the first download. */
  progress: { done: number; total: number } | null
  /** The first download had finished on this device before, but the device has since cleared the copy. */
  copyLost: boolean
  online: boolean
  syncing: boolean
  /** Changes made on this device that are not on the server yet. */
  pending: number
  /** The last sync ended with changes still waiting (server unreachable, or a table it doesn't have yet). */
  stalled: boolean
  failures: SyncFailure[]
  lastSyncedAt: number | null
  /** Set when the server rejected the sync for a reason other than being offline. */
  error: string | null
}

const initial: SyncStatus = {
  active: false,
  preparing: false,
  progress: null,
  copyLost: false,
  online: true,
  syncing: false,
  pending: 0,
  stalled: false,
  failures: [],
  lastSyncedAt: null,
  error: null,
}

let state = initial
const listeners = new Set<() => void>()
const dataListeners = new Set<() => void>()

export const syncStatus = {
  get: () => state,
  set(partial: Partial<SyncStatus>) {
    const next = { ...state, ...partial }
    if (Object.keys(partial).every((k) => Object.is(state[k as keyof SyncStatus], next[k as keyof SyncStatus]))) return
    state = next
    listeners.forEach((l) => l())
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  dismissFailures() {
    syncStatus.set({ failures: [] })
  },
}

/** Fires when a sync changed local data, so cached screens should reload. */
export const onLocalDataChanged = (listener: () => void) => {
  dataListeners.add(listener)
  return () => {
    dataListeners.delete(listener)
  }
}
export const notifyLocalDataChanged = () => dataListeners.forEach((l) => l())

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(syncStatus.subscribe, syncStatus.get, () => initial)
}
