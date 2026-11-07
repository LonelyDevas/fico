// Keeps the on-device database and Supabase in step.
//
//  1. Push: every queued change (an RPC call or a table write) is replayed against Supabase in the
//     order it was made, through sync_replay() (migration 0047) so rows keep the ids the device chose.
//  2. Pull: once nothing is waiting, the server's rows replace the local ones. The server wins, so a
//     change that was rejected, or touched by another device, ends up matching the server.
//
// Pull is incremental: each table fetches only rows changed since its last pull, plus a row count to
// spot deletes. A full id comparison runs once a day (or from Sync details) to catch anything missed.
//
// A change the server keeps failing on doesn't block the rest for ever: after a few tries spaced out
// with backoff it is set aside ('dead'), kept on the device, and shown in Settings > Sync details
// where it can be retried or discarded.
//
// Every table syncs on its own: one the server doesn't have yet (an app update that is ahead of the
// server's migrations) or one that fails to download is skipped, and the rest still sync. Changes to a
// table the server doesn't have are held on the device and sent once it does.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PGlite, Transaction } from '@electric-sql/pglite'
import type { LocalDatabase } from './database'
import type { Call } from './engine'
import { notifyLocalDataChanged, syncStatus, type SyncFailure } from './status'

export { syncStatus }

/** Tables copied down from the server, in a stable order. */
export const SYNCED_TABLES = [
  'profiles',
  'user_details',
  'wallets',
  'categories',
  'transactions',
  'bills',
  // Plans and their groups before budgets, which point at a group.
  'budget_plans',
  'budget_plan_groups',
  'budgets',
  'obligations',
  'investments',
  'investment_value_snapshots',
  'planned_items',
  'goals',
  'wishlist_items',
  'rules',
]

const PAGE = 1000
const FETCH_CHUNK = 150
/** Tries before a change the server keeps failing on is set aside. */
export const MAX_ATTEMPTS = 8
const BACKOFF_MIN_MS = 60_000
const BACKOFF_MAX_MS = 30 * 60_000
/** Background sync while the app is on screen (it also syncs on resume, reconnect and after each change). */
const POLL_MS = 5 * 60_000
/** Incremental pulls look back this far past the last change seen, for transactions that committed late. */
const OVERLAP_MS = 2 * 60_000
/** How often every table's ids are compared in full, to catch deletes and anything else missed. */
const FULL_CHECK_MS = 24 * 60 * 60_000

interface OutboxEntry {
  seq: number
  op_id: string
  kind: 'rpc' | 'table'
  payload: { name?: string; args?: Record<string, unknown>; table?: string; calls?: Call[] }
  ids: string[]
  attempts: number
}

interface RemoteError {
  message?: string
  code?: string
}

/**
 * ok: applied. held: its table isn't on the server yet. refused: the server said no for good.
 * failing: the server errored on it (counts as a try). offline / auth / server-old: nothing to do with
 * this change; wait and try again without counting it.
 */
type Outcome = 'ok' | 'held' | 'refused' | 'failing' | 'offline' | 'auth' | 'server-old'

interface Incoming {
  upserts: Record<string, unknown>[]
  deletes: string[]
}

interface Downloaded {
  change: Incoming | null
  /** Latest updated_at seen, to pull from next time. */
  mark: string | null
}

/** One change waiting on the device, as shown in Sync details (no row data). */
export interface QueuedChange {
  seq: number
  what: string
  status: 'pending' | 'dead'
  attempts: number
  lastError: string | null
  createdAt: string
}

export interface SyncDetails {
  pending: number
  dead: number
  changes: QueuedChange[]
  missing: string[]
  refreshing: string[]
  lastSyncedAt: number | null
  lastFullCheckAt: number | null
  retryAt: number | null
  serverNeedsUpdate: boolean
  error: string | null
}

/**
 * Inserts or replaces rows by id. Only the columns the rows carry are written: a column they don't
 * have (the server or an older copy is behind the schema) keeps its local default instead of
 * becoming null and failing a not-null constraint. Callers turn off triggers and foreign keys.
 */
export async function upsertRows(tx: Transaction | PGlite, table: string, rows: Record<string, unknown>[]): Promise<void> {
  if (!rows.length) return
  const cols = (
    await tx.query<{ column_name: string }>(
      // Generated columns (budgets.remaining, budgets.percentage_spent) can't be written; they recompute.
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = $1 and is_generated = 'NEVER' order by ordinal_position`,
      [table]
    )
  ).rows
    .map((r) => r.column_name)
    .filter((c) => rows.some((row) => c in row))
  const list = cols.map((c) => `"${c}"`).join(', ')
  const setList = cols.filter((c) => c !== 'id').map((c) => `"${c}" = excluded."${c}"`).join(', ')
  for (let i = 0; i < rows.length; i += 200) {
    await tx.query(
      `insert into public."${table}" (${list}) select ${list} from json_populate_recordset(null::public."${table}", $1::json)
       on conflict (id) do ${setList ? `update set ${setList}` : 'nothing'}`,
      [JSON.stringify(rows.slice(i, i + 200))]
    )
  }
}

/** A download error, with the code the server gave so callers can tell what kind it was. */
const remoteError = (table: string, error: RemoteError) =>
  Object.assign(new Error(`${table}: ${error.message ?? 'download failed'}`), { code: error.code })

/** The server has no such table (its migrations are behind the app). */
const isMissingTable = (error: RemoteError | null | undefined) =>
  error?.code === 'PGRST205' || error?.code === '42P01'

const looksOffline = (e: RemoteError | null | undefined) =>
  /failed to fetch|network|load failed|fetch failed|timeout|timed out|aborted/i.test(e?.message ?? '')

const isAuthError = (e: RemoteError | null | undefined) => e?.code === 'PGRST301' || /jwt expired|invalid jwt/i.test(e?.message ?? '')

const deviceOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

/** What a failed replay means for the change. */
function classify(error: RemoteError, status?: number): Outcome {
  if (deviceOffline()) return 'offline'
  if (isAuthError(error)) return 'auth'
  // sync_replay missing: the server is not migrated yet, so keep the queue and say so once.
  if (error.code === 'PGRST202') return 'server-old'
  // The server answered with a database error (a code and a 5xx): this change is what it fails on.
  if (status !== undefined && status >= 500 && error.code && !looksOffline(error)) return 'failing'
  // A gateway error, rate limit or lost connection: the server, not the change.
  if (looksOffline(error) || (status !== undefined && (status >= 500 || status === 429 || status === 408))) return 'offline'
  return 'refused'
}

const describe = (entry: Pick<OutboxEntry, 'kind' | 'payload'>) =>
  entry.kind === 'rpc' ? entry.payload.name ?? 'change' : `${entry.payload.calls?.[0]?.[0] ?? 'write'} ${entry.payload.table ?? ''}`.trim()

const EPOCH = '1970-01-01T00:00:00.000Z'
const stampOf = (v: unknown) => String(new Date(v as string | Date).getTime())
const laterMark = (a: string | null, b: string | null) => (!a ? b : !b ? a : Date.parse(b) > Date.parse(a) ? b : a)

export class SyncEngine {
  private running = false
  private again = false
  /** Set by a forced request that arrived while a sync was running. */
  private againForced = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private interval: ReturnType<typeof setInterval> | null = null
  private cleanups: Array<() => void> = []
  private stopped = false
  /** Tables the server doesn't have yet: not downloaded, and their changes wait on the device. */
  private missing = new Set<string>()
  /** Consecutive syncs that ended with changes failing; sets the backoff. */
  private failedRuns = 0
  private retryAt = 0
  private fullCheckRequested = false

  constructor(
    private readonly local: LocalDatabase,
    /** The real Supabase client (never the offline wrapper). */
    private readonly remote: SupabaseClient
  ) {}

  start() {
    const online = () => {
      syncStatus.set({ online: true })
      // Back online: try straight away, whatever the backoff said.
      this.request(true)
    }
    const offline = () => syncStatus.set({ online: false })
    const visible = () => document.visibilityState === 'visible' && this.request()
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    document.addEventListener('visibilitychange', visible)
    this.cleanups.push(
      () => window.removeEventListener('online', online),
      () => window.removeEventListener('offline', offline),
      () => document.removeEventListener('visibilitychange', visible)
    )
    // Capacitor apps get no visibilitychange when resumed from the background.
    import('@capacitor/app')
      .then(({ App }) =>
        App.addListener('appStateChange', ({ isActive }) => isActive && this.request()).then((handle) => {
          if (this.stopped) handle.remove()
          else this.cleanups.push(() => handle.remove())
        })
      )
      .catch(() => {})
    this.interval = setInterval(() => document.visibilityState === 'visible' && this.request(), POLL_MS)
    syncStatus.set({ online: navigator.onLine, active: true })
    void this.refreshPending()
  }

  stop() {
    this.stopped = true
    this.cleanups.forEach((fn) => fn())
    this.cleanups = []
    if (this.timer) clearTimeout(this.timer)
    if (this.retryTimer) clearTimeout(this.retryTimer)
    if (this.interval) clearInterval(this.interval)
    syncStatus.set({ active: false, syncing: false })
  }

  /** First run on a device: downloads everything before the app starts reading. */
  async hydrate(): Promise<void> {
    this.running = true
    try {
      do {
        this.again = false
        // Table by table, so a download cut short (the app closed, the connection dropped) keeps what
        // it got and the next attempt only fetches the rest.
        await this.pull(true)
      } while (this.again)
    } finally {
      this.running = false
    }
  }

  /** Called after a change is queued. Waits a moment so a burst of changes syncs together. */
  queued() {
    void this.refreshPending()
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.request(), 400)
  }

  /**
   * Starts a sync unless one is running (then runs again right after it). While changes are failing
   * the server is left alone until the backoff ends; `force` (the user tapped Sync, or the device came
   * back online) tries now.
   */
  request(force = false): Promise<void> {
    if (this.stopped) return Promise.resolve()
    if (this.running) {
      this.again = true
      if (force) this.againForced = true
      return Promise.resolve()
    }
    return this.run(force)
  }

  private async run(force: boolean) {
    this.running = true
    try {
      do {
        this.again = false
        if (deviceOffline()) break
        if (!force && Date.now() < this.retryAt) break
        force = this.againForced
        this.againForced = false
        syncStatus.set({ syncing: true })
        const pushed = await this.push()
        if (pushed === 'failing') this.backOff()
        else if (pushed === 'done' || pushed === 'held') this.clearBackoff()
        // Changes held for a table the server lacks don't stop the other tables from coming down.
        if (pushed === 'done' || pushed === 'held') await this.pull()
        syncStatus.set({ stalled: pushed !== 'done' })
      } while (this.again && !this.stopped)
    } catch (e) {
      syncStatus.set({ error: e instanceof Error ? e.message : 'Sync failed', stalled: true })
    } finally {
      this.running = false
      syncStatus.set({ syncing: false })
      await this.refreshPending()
    }
  }

  /** Waits 1, 2, 4… up to 30 minutes before the next try, and schedules it. */
  private backOff() {
    this.failedRuns++
    const delay = Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2 ** (this.failedRuns - 1))
    this.retryAt = Date.now() + delay
    syncStatus.set({ retryAt: this.retryAt })
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = setTimeout(() => this.request(), delay)
  }

  private clearBackoff() {
    this.failedRuns = 0
    this.retryAt = 0
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = null
    syncStatus.set({ retryAt: null })
  }

  private async refreshPending() {
    try {
      const res = await this.local.db.query<{ pending: number; dead: number }>(
        `select count(*) filter (where status = 'pending')::int as pending, count(*) filter (where status = 'dead')::int as dead
           from public._sync_outbox`
      )
      syncStatus.set({ pending: res.rows[0]?.pending ?? 0, dead: res.rows[0]?.dead ?? 0 })
    } catch {
      // database closing
    }
  }

  // --- push ---------------------------------------------------------------------------------------

  /**
   * done: everything went up. held: everything except changes to tables the server doesn't have yet.
   * failing: a change failed and is waiting for its next try. waiting: offline, signed out or the
   * server needs a migration. stopped: the engine was stopped.
   */
  private async push(): Promise<'done' | 'held' | 'failing' | 'waiting' | 'stopped'> {
    let after = 0
    let held = false
    for (;;) {
      if (this.stopped) return 'stopped'
      const res = await this.local.db.query<OutboxEntry>(
        `select seq, op_id, kind, payload, ids, attempts from public._sync_outbox where status = 'pending' and seq > $1 order by seq limit 1`,
        [after]
      )
      const entry = res.rows[0]
      if (!entry) return held ? 'held' : 'done'

      const { outcome, message } = await this.replay(entry)
      if (outcome !== 'server-old' && syncStatus.get().serverNeedsUpdate) syncStatus.set({ serverNeedsUpdate: false })
      switch (outcome) {
        case 'ok':
          await this.local.db.query(`delete from public._sync_outbox where seq = $1`, [entry.seq])
          await this.refreshPending()
          continue
        case 'held':
          // Stays queued, in order, behind any earlier change to the same table.
          held = true
          after = entry.seq
          continue
        case 'refused':
          await this.setAside(entry, message, entry.attempts + 1)
          continue
        case 'failing': {
          const attempts = entry.attempts + 1
          if (attempts >= MAX_ATTEMPTS) {
            await this.setAside(entry, message, attempts)
            continue
          }
          await this.local.db.query(`update public._sync_outbox set attempts = $2, last_error = $3 where seq = $1`, [entry.seq, attempts, message])
          return 'failing'
        }
        case 'server-old':
          syncStatus.set({ serverNeedsUpdate: true })
          await this.local.db.query(`update public._sync_outbox set last_error = $2 where seq = $1`, [entry.seq, message])
          // Not this change's fault, but there is no point asking every minute either.
          return 'failing'
        default:
          // offline or auth: the next sync (reconnect, resume, refreshed session) tries again.
          return 'waiting'
      }
    }
  }

  private async replay(entry: OutboxEntry): Promise<{ outcome: Outcome; message: string }> {
    const result = (outcome: Outcome, error?: RemoteError) => ({ outcome, message: error?.message ?? '' })
    try {
      if (entry.kind === 'rpc') {
        const { name = '', args = {} } = entry.payload
        const { error, status } = await this.remote.rpc('sync_replay', {
          p_op_id: entry.op_id,
          p_name: name,
          p_args: args,
          p_ids: entry.ids,
        })
        if (!error) return result('ok')
        const outcome = classify(error, status)
        if (outcome === 'auth') await this.remote.auth.refreshSession().catch(() => {})
        return result(outcome, error)
      }

      const { table = '', calls = [] } = entry.payload
      if (this.missing.has(table)) return result('held')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = this.remote.from(table)
      for (const [method, args] of calls) query = query[method](...args)
      const { error, status } = await query
      if (!error) return result('ok')
      if (isMissingTable(error)) {
        this.missing.add(table)
        return result('held')
      }
      // Already there (a retry after the reply was lost): same as success.
      if (error.code === '23505' && calls.some(([m]) => m === 'insert')) return result('ok')
      const outcome = classify(error, status)
      if (outcome === 'auth') await this.remote.auth.refreshSession().catch(() => {})
      return result(outcome, error)
    } catch (e) {
      // supabase-js throws on network failure when throwOnError is on; treat a network throw as transient.
      if (looksOffline(e as RemoteError) || deviceOffline()) return result('offline', e as RemoteError)
      return result('refused', { message: e instanceof Error ? e.message : String(e) })
    }
  }

  /**
   * Sets a change aside so the ones after it can go up. Its data stays on the device for Retry or
   * Discard in Sync details; the user is told once. Until then the server's copy wins on the device.
   */
  private async setAside(entry: OutboxEntry, message: string, attempts: number) {
    const reason = message || 'The server rejected this change.'
    await this.local.db.query(`update public._sync_outbox set status = 'dead', attempts = $2, last_error = $3 where seq = $1`, [entry.seq, attempts, reason])
    const failure: SyncFailure = { what: describe(entry), message: reason, at: Date.now() }
    syncStatus.set({ failures: [...syncStatus.get().failures, failure].slice(-5) })
    await this.refreshPending()
  }

  // --- Sync details ---------------------------------------------------------------------------------

  /** What Sync details shows: counts, the oldest waiting changes and why, and the pull state. No row data. */
  async details(limit = 20): Promise<SyncDetails> {
    const res = await this.local.db.query<{ seq: number; kind: 'rpc' | 'table'; payload: OutboxEntry['payload']; status: 'pending' | 'dead'; attempts: number; last_error: string | null; created_at: Date | string }>(
      `select seq, kind, payload, status, attempts, last_error, created_at from public._sync_outbox
        where status in ('pending', 'dead') order by (status = 'dead') desc, seq limit $1`,
      [limit]
    )
    const counts = await this.local.db.query<{ pending: number; dead: number }>(
      `select count(*) filter (where status = 'pending')::int as pending, count(*) filter (where status = 'dead')::int as dead from public._sync_outbox`
    )
    const st = syncStatus.get()
    return {
      pending: counts.rows[0]?.pending ?? 0,
      dead: counts.rows[0]?.dead ?? 0,
      changes: res.rows.map((r) => ({
        seq: Number(r.seq),
        what: describe(r),
        status: r.status,
        attempts: r.attempts,
        lastError: r.last_error,
        createdAt: new Date(r.created_at).toISOString(),
      })),
      missing: [...this.missing].sort(),
      refreshing: (await this.local.meta<string[]>('refresh_tables')) ?? ((await this.local.meta('refresh_all')) === true ? ['every table'] : []),
      lastSyncedAt: st.lastSyncedAt ?? (await this.local.meta<number>('last_pull_at')),
      lastFullCheckAt: await this.local.meta<number>('full_check_at'),
      retryAt: this.retryAt || null,
      serverNeedsUpdate: st.serverNeedsUpdate,
      error: st.error,
    }
  }

  /** Puts changes that were set aside back in the queue (all of them, or one) and syncs. */
  async retry(seq?: number): Promise<void> {
    await this.local.db.query(
      `update public._sync_outbox set status = 'pending', attempts = 0, last_error = null where status = 'dead' and ($1::bigint is null or seq = $1)`,
      [seq ?? null]
    )
    this.clearBackoff()
    await this.refreshPending()
    await this.request(true)
  }

  /** Throws away a change that was set aside. The server's copy stays as it is. */
  async discard(seq: number): Promise<void> {
    await this.local.db.query(`delete from public._sync_outbox where seq = $1 and status = 'dead'`, [seq])
    await this.refreshPending()
  }

  /** Compares every table's ids with the server now, instead of waiting for the daily check. */
  async fullCheck(): Promise<void> {
    this.fullCheckRequested = true
    await this.request(true)
  }

  // --- pull ---------------------------------------------------------------------------------------

  /**
   * Replaces local rows with the server's. Returns true when anything changed. Normally every table is
   * applied in one transaction; `eachTable` saves each one as soon as it arrives (first download).
   *
   * A table that fails to download is skipped and the others still apply; the next sync fetches it.
   * Only losing the connection stops a pull, so a first download cut short is picked up next time.
   * A table that keeps failing must not hold the whole device copy back: the app would then start
   * the first download over on every launch and never work offline.
   */
  async pull(eachTable = false): Promise<boolean> {
    if (this.stopped) return false
    const tables = SYNCED_TABLES.filter((t) => this.local.engine.hasTable(t))
    const incoming: Record<string, Incoming> = {}
    const failed: string[] = []
    let changedAny = false

    // After an app update moved the device copy to a new schema its rows came across from the old copy,
    // which may be missing columns the update added, so each table fetches every row once. Tracked per
    // table: one that keeps failing doesn't make the others download everything again.
    if ((await this.local.meta('refresh_all')) === true) {
      await this.local.setMeta('refresh_tables', tables)
      await this.local.setMeta('refresh_all', false)
    }
    const refresh = new Set((await this.local.meta<string[]>('refresh_tables')) ?? [])
    const marks = { ...((await this.local.meta<Record<string, string>>('pull_marks')) ?? {}) }
    const lastFull = (await this.local.meta<number>('full_check_at')) ?? 0
    const fullCheck = this.fullCheckRequested || Date.now() - lastFull > FULL_CHECK_MS
    this.fullCheckRequested = false
    const newMarks: Record<string, string | null> = {}
    const done = new Set<string>()

    const fetch = (t: string) => this.download(t, { refresh: refresh.has(t), full: fullCheck, mark: marks[t] ?? null })
    const landed = (table: string, d: Downloaded) => {
      newMarks[table] = d.mark
      done.add(table)
    }
    const save = async (only?: Iterable<string>) => {
      for (const t of only ?? done) {
        refresh.delete(t)
        if (newMarks[t]) marks[t] = newMarks[t] as string
      }
      await this.local.setMeta('pull_marks', marks)
      await this.local.setMeta('refresh_tables', [...refresh])
    }

    // A failed table is skipped, unless the device went offline: then nothing else gets through either.
    const settle = (table: string, e: unknown) => {
      const err = e as RemoteError
      // An error the server sent back (it has a code, e.g. a statement timeout) means it was reachable.
      if ((!err?.code && looksOffline(err)) || deviceOffline()) throw e
      if (isMissingTable(err)) this.missing.add(table)
      else failed.push(err.message ?? table)
    }
    const arrived = (table: string) => {
      // The server has it now: changes held for it can go up on the next round.
      if (this.missing.delete(table)) this.again = true
    }

    if (eachTable) {
      let count = 0
      syncStatus.set({ progress: { done: count, total: tables.length } })
      for (const table of tables) {
        if (count > 0) syncStatus.set({ progress: { done: count, total: tables.length } })
        count++
        let result: Downloaded
        try {
          result = await fetch(table)
        } catch (e) {
          settle(table, e)
          continue
        }
        arrived(table)
        if (result.change) {
          let applied: boolean
          try {
            applied = await this.applyIncoming({ [table]: result.change })
          } catch (e) {
            failed.push(`${table}: ${e instanceof Error ? e.message : String(e)}`)
            continue
          }
          if (!applied) {
            this.again = true
            return false
          }
          changedAny = true
        }
        landed(table, result)
        await save([table])
      }
    } else {
      // Tables download side by side, so a sync takes about as long as its slowest table.
      const results = await Promise.allSettled(tables.map(fetch))
      const downloaded: Record<string, Downloaded> = {}
      results.forEach((r, i) => {
        const table = tables[i]
        if (r.status === 'rejected') settle(table, r.reason)
        else {
          arrived(table)
          downloaded[table] = r.value
          if (r.value.change) incoming[table] = r.value.change
        }
      })

      if (Object.keys(incoming).length > 0) {
        let applied: boolean
        try {
          applied = await this.applyIncoming(incoming)
        } catch {
          // One table's rows don't fit the device copy: apply the others on their own and report that one.
          applied = true
          for (const [table, change] of Object.entries(incoming)) {
            try {
              if (!(await this.applyIncoming({ [table]: change }))) {
                applied = false
                break
              }
            } catch (e) {
              failed.push(`${table}: ${e instanceof Error ? e.message : String(e)}`)
              delete downloaded[table]
            }
          }
        }
        if (!applied) {
          // Something was queued while downloading; the server copy is stale for it. Go round again.
          this.again = true
          return false
        }
      }
      for (const [table, d] of Object.entries(downloaded)) landed(table, d)
      await save()
    }

    const changed = changedAny || Object.keys(incoming).length > 0
    await this.local.setMeta('last_pull_at', Date.now())
    if (fullCheck && failed.length === 0) await this.local.setMeta('full_check_at', Date.now())
    syncStatus.set({ lastSyncedAt: Date.now(), error: failed[0] ?? null })
    if (changed) notifyLocalDataChanged()
    return changed
  }

  /**
   * What has to change locally to match the server's copy of `table`, or null when nothing does.
   * Normally only rows changed since `mark` come down, plus a row count that catches deletes. The full
   * id comparison runs for a table without updated_at, a first or refreshed download, the daily check,
   * or when the counts don't match.
   */
  private async download(table: string, opts: { refresh: boolean; full: boolean; mark: string | null }): Promise<Downloaded> {
    const hasUpdatedAt = this.local.engine.catalog.tablesWithUpdatedAt.has(table)
    if (!hasUpdatedAt || opts.refresh || opts.full || !opts.mark) return this.compareAll(table, hasUpdatedAt, opts.refresh)

    const since = new Date(Date.parse(opts.mark) - OVERLAP_MS).toISOString()
    const rows: Record<string, unknown>[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.remote
        .from(table)
        .select('*')
        .gt('updated_at', since)
        .order('updated_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) throw remoteError(table, error)
      const page = (data as Record<string, unknown>[]) ?? []
      rows.push(...page)
      if (page.length < PAGE) break
    }
    const { count: remoteCount, error: countError } = await this.remote.from(table).select('id', { count: 'exact', head: true })
    if (countError) throw remoteError(table, countError)

    const ids = rows.map((r) => r.id as string)
    const localStamps = new Map(
      ids.length
        ? (
            await this.local.db.query<{ id: string; updated_at: Date | string }>(`select id, updated_at from public."${table}" where id = any($1::uuid[])`, [ids])
          ).rows.map((r) => [r.id, stampOf(r.updated_at)])
        : []
    )
    const upserts = rows.filter((r) => localStamps.get(r.id as string) !== stampOf(r.updated_at))
    const added = rows.filter((r) => !localStamps.has(r.id as string)).length
    const localCount = (await this.local.db.query<{ n: number }>(`select count(*)::int as n from public."${table}"`)).rows[0]?.n ?? 0
    // A different count after these rows land means something was deleted (or slipped past the mark).
    if (remoteCount !== null && remoteCount !== undefined && remoteCount !== localCount + added) return this.compareAll(table, true, false)

    const mark = rows.reduce<string | null>((m, r) => laterMark(m, r.updated_at as string), opts.mark)
    return { change: upserts.length ? { upserts, deletes: [] } : null, mark }
  }

  /** Compares every id (and change stamp) with the server's and fetches what differs. */
  private async compareAll(table: string, hasUpdatedAt: boolean, refresh: boolean): Promise<Downloaded> {
    const { index: remoteIndex, mark } = await this.remoteIndex(table, hasUpdatedAt)
    const localIndex = await this.localIndex(table, hasUpdatedAt)

    const wanted: string[] = []
    for (const [id, stamp] of remoteIndex) if (refresh || localIndex.get(id) !== stamp) wanted.push(id)
    const deletes = [...localIndex.keys()].filter((id) => !remoteIndex.has(id))
    if (wanted.length === 0 && deletes.length === 0) return { change: null, mark }

    const upserts: Record<string, unknown>[] = []
    for (let i = 0; i < wanted.length; i += FETCH_CHUNK) {
      const { data, error } = await this.remote.from(table).select('*').in('id', wanted.slice(i, i + FETCH_CHUNK))
      if (error) throw remoteError(table, error)
      upserts.push(...((data as Record<string, unknown>[]) ?? []))
    }
    return { change: { upserts, deletes }, mark }
  }

  /**
   * id -> change stamp, and the latest updated_at. Tables without updated_at (investment_value_snapshots)
   * are insert-only, so an id seen on both sides is treated as unchanged.
   */
  private async remoteIndex(table: string, hasUpdatedAt: boolean): Promise<{ index: Map<string, string>; mark: string | null }> {
    const index = new Map<string, string>()
    let mark: string | null = null
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.remote
        .from(table)
        .select(hasUpdatedAt ? 'id, updated_at' : 'id')
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) throw remoteError(table, error)
      const rows = (data as unknown as Array<{ id: string; updated_at?: string }>) ?? []
      for (const r of rows) {
        index.set(r.id, hasUpdatedAt ? stampOf(r.updated_at) : '')
        if (hasUpdatedAt) mark = laterMark(mark, r.updated_at ?? null)
      }
      // An empty table pulls from the start next time, which is still one small request.
      if (rows.length < PAGE) return { index, mark: hasUpdatedAt ? mark ?? EPOCH : null }
    }
  }

  private async localIndex(table: string, hasUpdatedAt: boolean): Promise<Map<string, string>> {
    const res = await this.local.db.query<{ id: string; updated_at?: Date | string }>(
      `select id${hasUpdatedAt ? ', updated_at' : ''} from public."${table}"`
    )
    return new Map(res.rows.map((r) => [r.id, hasUpdatedAt ? stampOf(r.updated_at) : '']))
  }
  /** Applies downloaded rows in one transaction. Returns false (and applies nothing) if changes were queued meanwhile. */
  private async applyIncoming(incoming: Record<string, Incoming>): Promise<boolean> {
    return this.local.db.transaction(async (tx) => {
      // Changes held for a table the server lacks don't count: that table isn't being downloaded.
      const pending = await tx.query<{ n: number }>(
        `select count(*)::int as n from public._sync_outbox
          where status = 'pending' and not (kind = 'table' and payload->>'table' = any($1::text[]))`,
        [[...this.missing]]
      )
      if ((pending.rows[0]?.n ?? 0) > 0) return false

      // Rows arrive in any order and the server already enforced integrity: skip local triggers and foreign keys.
      await tx.query(`set local session_replication_role = replica`)
      for (const [table, { upserts, deletes }] of Object.entries(incoming)) {
        if (deletes.length) await tx.query(`delete from public."${table}" where id = any($1::uuid[])`, [deletes])
        await upsertRows(tx, table, upserts)
      }
      return true
    })
  }
}
