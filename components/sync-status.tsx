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
  const { active, online, pending, syncing, failures } = useSyncStatus()

  useEffect(() => {
    if (failures.length === 0) return
    for (const f of failures) toast.error(`Couldn't save a change (${f.what}): ${f.message}`, { duration: 7000 })
    syncStatus.dismissFailures()
  }, [failures])

  if (!active || (online && pending === 0)) return null

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
