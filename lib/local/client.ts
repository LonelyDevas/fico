// Wraps the Supabase client so the app's existing `supabase.from(...)` and `supabase.rpc(...)` calls
// are answered by the on-device database, and synced to the server in the background.
//
// Auth, storage and edge functions pass straight through to the real client. Tables and functions
// that only exist on the server (push subscriptions, account reset/delete...) also go to the server.
import type { SupabaseClient } from '@supabase/supabase-js'
import { recordingBuilder } from './builder'
import type { Call, QueryResult } from './engine'
import type { LocalDatabase } from './database'
import { readCachedSession } from './session'
import { syncStatus } from './status'
import type { SyncEngine } from './sync'

interface Runtime {
  local: LocalDatabase
  sync: SyncEngine
  release: () => void
}

/** After the local database fails to start, use the server for this long before trying again. */
const RETRY_AFTER_MS = 30_000

export const offlineEnabled = () =>
  typeof window !== 'undefined' &&
  typeof indexedDB !== 'undefined' &&
  process.env.NEXT_PUBLIC_BACKEND === 'supabase' &&
  process.env.NEXT_PUBLIC_OFFLINE !== 'off'

let real: SupabaseClient | null = null
interface Starting {
  userId: string
  promise: Promise<Runtime | null>
  /** Set once the database is open and has the user's data. */
  ready: Runtime | null
  /** First sign-in on this device: the user's data is still downloading. */
  hydrating: boolean
}

let current: Starting | null = null
let failedAt: { userId: string; at: number } | null = null
/** The last user a runtime was started for, so sign-out can clear a copy that never finished. */
let lastUserId: string | null = null

/** Resolves to the local runtime for the signed-in user, or null to use the server directly. */
// Every query asks for the runtime; the stored session only changes on auth events.
let sessionCache: { at: number; value: Awaited<ReturnType<typeof readCachedSession>> } | null = null
const SESSION_TTL_MS = 5000

async function cachedSession() {
  if (!sessionCache || Date.now() - sessionCache.at > SESSION_TTL_MS) {
    sessionCache = { at: Date.now(), value: await readCachedSession() }
  }
  return sessionCache.value
}

export async function getRuntime(): Promise<Runtime | null> {
  if (!offlineEnabled() || !real) return null
  const session = await cachedSession()
  if (!session) {
    if (current) void teardown(false)
    return null
  }
  if (current && current.userId !== session.userId) void teardown(false)
  if (!current) {
    if (failedAt?.userId === session.userId && Date.now() - failedAt.at < RETRY_AFTER_MS) return null
    lastUserId = session.userId
    const entry: Starting = { userId: session.userId, promise: Promise.resolve(null), ready: null, hydrating: false }
    entry.promise = startRuntime(entry, session.email, session.username).then(
      (rt) => {
        if (current === entry) {
          entry.ready = rt
          entry.hydrating = false
          // Null means another tab owns the database: use the server for a while rather than asking again per query.
          if (!rt) {
            current = null
            failedAt = { userId: session.userId, at: Date.now() }
          }
        }
        return rt
      },
      (e) => {
        console.warn('[offline] local database unavailable, using the server directly:', e)
        if (current === entry) {
          // Shown by the sync badge: without it a failed first download is invisible until the user is offline.
          syncStatus.set({ error: e instanceof Error ? e.message : String(e) })
          current = null
          failedAt = { userId: session.userId, at: Date.now() }
        }
        return null
      }
    )
    current = entry
  }
  if (current.ready) return current.ready
  // A first sign-in downloads everything, which can take a long time: the server answers meanwhile so
  // nothing waits on it. Otherwise the database is only opening, and changes made offline may still be
  // queued in it, so wait for it rather than read or write around them.
  if (current.hydrating) return null
  return current.promise
}

/** Only one tab may own the on-device database; others talk to the server. */
function acquireDbLock(): Promise<(() => void) | null> {
  const locks = (navigator as Navigator & { locks?: LockManager }).locks
  if (!locks) return Promise.resolve(() => {})
  return new Promise((resolve) => {
    let release: () => void = () => {}
    const held = new Promise<void>((r) => (release = r))
    locks
      .request('fico-local-db', { ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve(null)
          return undefined
        }
        resolve(release)
        return held
      })
      .catch(() => resolve(null))
  })
}

async function startRuntime(entry: Starting, email?: string, username?: string): Promise<Runtime | null> {
  const { userId } = entry
  const release = await acquireDbLock()
  if (!release) return null

  let local: LocalDatabase | null = null
  try {
    const [{ LocalDatabase }, { SyncEngine }] = await Promise.all([import('./database'), import('./sync')])
    let sync: SyncEngine | null = null
    local = await LocalDatabase.open({ userId, email, username, onQueued: () => sync?.queued() })
    sync = new SyncEngine(local, real!)

    const hydrated = await local.meta('last_pull_at')
    if (hydrated === null) {
      // First run on this device: download everything before the app starts reading from it. Until
      // then getRuntime() sends queries to the server.
      if (navigator.onLine === false) throw new Error('First sync needs a connection.')
      entry.hydrating = true
      syncStatus.set({ preparing: true, error: null })
      try {
        await sync.hydrate()
      } finally {
        syncStatus.set({ preparing: false })
      }
      sync.start()
      // Changes the user made on the server during the download: fetch them before reads switch over.
      await sync.request()
    } else {
      sync.start()
      void sync.request()
    }
    return { local, sync, release }
  } catch (e) {
    // Close it, or the next attempt opens a second copy of the same database while this one is still live.
    await local?.close().catch(() => {})
    release()
    throw e
  }
}

/**
 * Stops the local database. With `wipe`, the data is removed too (sign-out), unless changes are still
 * waiting to sync: those stay on the device until the same user signs in again.
 */
export async function teardown(wipe: boolean): Promise<void> {
  const active = current
  current = null
  const runtime = active ? await active.promise.catch(() => null) : null
  if (!runtime) {
    // No database open: a first download that failed or was cut short may still have left rows behind.
    const userId = active?.userId ?? lastUserId
    if (wipe && userId) {
      lastUserId = null
      const release = await acquireDbLock()
      if (release) {
        await import('./database').then(({ LocalDatabase }) => LocalDatabase.discard(userId)).catch(() => {})
        release()
      }
      syncStatus.set({ error: null })
    }
    return
  }
  runtime.sync.stop()
  const pending = await runtime.local.pendingCount().catch(() => 0)
  if (wipe && pending === 0) await runtime.local.destroy()
  else await runtime.local.close().catch(() => {})
  runtime.release()
  syncStatus.set({ active: false, pending: 0, stalled: false })
}

const applyCalls = <T>(start: T, calls: Call[]): T => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = start
  for (const [method, args] of calls) q = q[method](...args)
  return q
}

async function routeTable(client: SupabaseClient, table: string, calls: Call[]): Promise<QueryResult> {
  const runtime = await getRuntime()
  if (runtime && runtime.local.engine.hasTable(table)) return runtime.local.engine.execute('table', table, calls)
  return (await applyCalls(client.from(table), calls)) as unknown as QueryResult
}

async function routeRpc(client: SupabaseClient, name: string, calls: Call[]): Promise<QueryResult> {
  const runtime = await getRuntime()
  if (runtime && runtime.local.engine.hasFunction(name)) return runtime.local.engine.execute('rpc', name, calls)
  const args = (calls.find(([m]) => m === 'rpc-args')?.[1][0] ?? {}) as Record<string, unknown>
  const rest = calls.filter(([m]) => m !== 'rpc-args')
  return (await applyCalls(client.rpc(name, args), rest)) as unknown as QueryResult
}

export function withOfflineSupport(client: SupabaseClient): SupabaseClient {
  if (!offlineEnabled()) return client
  real = client

  // A start that failed because the device was offline is worth retrying as soon as it is back.
  // The badge reads `online` even when no sync engine is running (the first download never finished).
  syncStatus.set({ online: navigator.onLine })
  window.addEventListener('online', () => {
    failedAt = null
    syncStatus.set({ online: true })
  })
  window.addEventListener('offline', () => syncStatus.set({ online: false }))

  client.auth.onAuthStateChange((event) => {
    sessionCache = null
    if (event === 'SIGNED_OUT') void teardown(true)
  })

  return new Proxy(client, {
    get(target, prop) {
      if (prop === 'from') return (table: string) => recordingBuilder([], (calls) => routeTable(target, table, calls))
      if (prop === 'rpc') {
        return (name: string, args: Record<string, unknown> = {}) =>
          recordingBuilder([['rpc-args', [args]]], (calls) => routeRpc(target, name, calls))
      }
      const value = Reflect.get(target, prop, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

/** Runs a sync now (e.g. from a "Sync now" button). */
export async function syncNow(): Promise<void> {
  const runtime = await getRuntime()
  await runtime?.sync.request()
}
