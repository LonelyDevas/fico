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

const HYDRATE_TIMEOUT_MS = 30_000

export const offlineEnabled = () =>
  typeof window !== 'undefined' &&
  typeof indexedDB !== 'undefined' &&
  process.env.NEXT_PUBLIC_BACKEND === 'supabase' &&
  process.env.NEXT_PUBLIC_OFFLINE !== 'off'

let real: SupabaseClient | null = null
let current: { userId: string; promise: Promise<Runtime | null> } | null = null

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
  if (current && current.userId !== session.userId) await teardown(false)
  if (!current) {
    const promise = startRuntime(session.userId, session.email, session.username).catch((e) => {
      console.warn('[offline] local database unavailable, using the server directly:', e)
      return null
    })
    current = { userId: session.userId, promise }
    // Try again next time if this attempt could not start.
    void promise.then((rt) => {
      if (!rt && current?.promise === promise) current = null
    })
  }
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

async function startRuntime(userId: string, email?: string, username?: string): Promise<Runtime | null> {
  const release = await acquireDbLock()
  if (!release) return null

  try {
    const [{ LocalDatabase }, { SyncEngine }] = await Promise.all([import('./database'), import('./sync')])
    let sync: SyncEngine | null = null
    const local = await LocalDatabase.open({ userId, email, username, onQueued: () => sync?.queued() })
    sync = new SyncEngine(local, real!)

    const hydrated = await local.meta('last_pull_at')
    if (hydrated === null) {
      // First run on this device: nothing to show until the server's data is here.
      if (navigator.onLine === false) throw new Error('First sync needs a connection.')
      await Promise.race([
        sync.hydrate(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('First sync timed out.')), HYDRATE_TIMEOUT_MS)),
      ])
    }
    sync.start()
    void sync.request()
    return { local, sync, release }
  } catch (e) {
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
  if (!active) return
  const runtime = await active.promise.catch(() => null)
  if (!runtime) return
  runtime.sync.stop()
  const pending = await runtime.local.pendingCount().catch(() => 0)
  if (wipe && pending === 0) await runtime.local.destroy()
  else await runtime.local.close().catch(() => {})
  runtime.release()
  syncStatus.set({ active: false, pending: 0 })
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
