'use client'

import { useEffect } from 'react'
import { CloudOff, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { syncNow } from '@/lib/local/client'
import { syncStatus, useSyncStatus } from '@/lib/local/status'

/**
 * A small pill at the top of the screen that only appears when there is something to know:
 * the device is offline, or changes are still on their way to the server. Changes the server
 * refused are shown once as a toast.
 */
export function SyncStatusBadge() {
  const { active, preparing, online, pending, syncing, failures, error } = useSyncStatus()

  useEffect(() => {
    if (failures.length === 0) return
    for (const f of failures) toast.error(`Couldn't save a change (${f.what}): ${f.message}`, { duration: 7000 })
    syncStatus.dismissFailures()
  }, [failures])

  if (!active) {
    // Before the offline copy is ready the app works from the server; say so only when it matters.
    const note = preparing
      ? 'Saving your data for offline use…'
      : error && !online
        ? 'Offline · your data isn’t saved on this device yet'
        : null
    if (!note) return null
    return (
      <div className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}>
        <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-ios">
          {preparing ? <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" /> : <CloudOff className="h-3.5 w-3.5 text-warning" />}
          {note}
        </div>
      </div>
    )
  }
  if (online && pending === 0) return null

  const label = !online
    ? pending > 0
      ? `Offline · ${pending} change${pending === 1 ? '' : 's'} saved on this device`
      : 'Offline · working from this device'
    : syncing
      ? 'Syncing…'
      : `${pending} change${pending === 1 ? '' : 's'} waiting to sync`

  return (
    <div className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}>
      <button
        type="button"
        onClick={() => online && void syncNow()}
        disabled={!online}
        className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-ios"
      >
        {online ? <RefreshCw className={`h-3.5 w-3.5 text-primary ${syncing ? 'animate-spin' : ''}`} /> : <CloudOff className="h-3.5 w-3.5 text-warning" />}
        {label}
      </button>
    </div>
  )
}
