// Keeps the on-device database and Supabase in step.
//
//  1. Push: every queued change (an RPC call or a table write) is replayed against Supabase in the
//     order it was made, through sync_replay() (migration 0047) so rows keep the ids the device chose.
//  2. Pull: once nothing is waiting, the server's rows replace the local ones. The server wins, so a
//     change that was rejected, or touched by another device, ends up matching the server.
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
  'budgets',
  'obligations',
  'investments',
  'investment_value_snapshots',
  'planned_items',
  'goals',
]

const PAGE = 1000
const FETCH_CHUNK = 150

interface OutboxEntry {
  seq: number
  op_id: string
  kind: 'rpc' | 'table'
  payload: { name?: string; args?: Record<string, unknown>; table?: string; calls?: Call[] }
  ids: string[]
}

interface RemoteError {
  message?: string
  code?: string
}

type Outcome = 'ok' | 'retry' | 'failed' | 'held'

interface Incoming {
  upserts: Record<string, unknown>[]
  deletes: string[]
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
      `select column_name from information_schema.columns where table_schema = 'public' and table_name = $1 order by ordinal_position`,
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

/** Errors that mean "try again later", not "this change is wrong". */
function isRetryable(error: RemoteError | null | undefined, status?: number): boolean {
  if (!error) return false
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  if (looksOffline(error)) return true
  if (error.code === 'PGRST301' || /jwt expired|invalid jwt/i.test(error.message ?? '')) return true
  // sync_replay missing: the server is not migrated yet, so keep the queue instead of dropping it.
  if (error.code === 'PGRST202') return true
  return status !== undefined && (status >= 500 || status === 429 || status === 408)
}

export class SyncEngine {
  private running = false
  private again = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private interval: ReturnType<typeof setInterval> | null = null
  private cleanups: Array<() => void> = []
  private stopped = false
  /** Tables the server doesn't have yet: not downloaded, and their changes wait on the device. */
  private missing = new Set<string>()

  constructor(
    private readonly local: LocalDatabase,
    /** The real Supabase client (never the offline wrapper). */
    private readonly remote: SupabaseClient
  ) {}

  start() {
    const online = () => {
      syncStatus.set({ online: true })
      this.request()
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
    this.interval = setInterval(() => document.visibilityState === 'visible' && this.request(), 60_000)
    syncStatus.set({ online: navigator.onLine, active: true })
    void this.refreshPending()
  }

  stop() {
    this.stopped = true
    this.cleanups.forEach((fn) => fn())
    this.cleanups = []
    if (this.timer) clearTimeout(this.timer)
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

  /** Starts a sync unless one is running (then runs again right after it). */
  request(): Promise<void> {
    if (this.stopped) return Promise.resolve()
    if (this.running) {
      this.again = true
      return Promise.resolve()
    }
    return this.run()
  }

  private async run() {
    this.running = true
    try {
      do {
        this.again = false
        if (typeof navigator !== 'undefined' && navigator.onLine === false) break
        syncStatus.set({ syncing: true })
        const pushed = await this.push()
        // Changes held for a table the server lacks don't stop the other tables from coming down.
        if (pushed !== 'stopped') await this.pull()
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

  private async refreshPending() {
    try {
      syncStatus.set({ pending: await this.local.pendingCount() })
    } catch {
      // database closing
    }
  }

  // --- push ---------------------------------------------------------------------------------------

  /** 'held' means everything went up except changes to tables the server doesn't have yet. */
  private async push(): Promise<'done' | 'held' | 'stopped'> {
    let after = 0
    let held = false
    for (;;) {
      if (this.stopped) return 'stopped'
      const res = await this.local.db.query<OutboxEntry>(
        `select seq, op_id, kind, payload, ids from public._sync_outbox where status = 'pending' and seq > $1 order by seq limit 1`,
        [after]
      )
      const entry = res.rows[0]
      if (!entry) return held ? 'held' : 'done'

      const outcome = await this.replay(entry)
      if (outcome === 'retry') return 'stopped'
      if (outcome === 'held') {
        // Stays queued, in order, behind any earlier change to the same table.
        held = true
        after = entry.seq
        continue
      }
      // Applied, or refused for good (already reported to the user): either way it leaves the queue.
      await this.local.db.query(`delete from public._sync_outbox where seq = $1`, [entry.seq])
      await this.refreshPending()
    }
  }

  private async replay(entry: OutboxEntry): Promise<Outcome> {
    try {
      if (entry.kind === 'rpc') {
        const { name = '', args = {} } = entry.payload
        const res0 = await this.remote.rpc('sync_replay', {
          p_op_id: entry.op_id,
          p_name: name,
          p_args: args,
          p_ids: entry.ids,
        })
        const { error, status } = res0
        if (!error) return 'ok'
        if (isRetryable(error, status)) {
          if (error.code === 'PGRST301' || /jwt expired|invalid jwt/i.test(error.message ?? '')) await this.remote.auth.refreshSession().catch(() => {})
          return 'retry'
        }
        return this.fail(name, error)
      }

      const { table = '', calls = [] } = entry.payload
      if (this.missing.has(table)) return 'held'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = this.remote.from(table)
      for (const [method, args] of calls) query = query[method](...args)
      const { error, status } = await query
      if (!error) return 'ok'
      if (isMissingTable(error)) {
        this.missing.add(table)
        return 'held'
      }
      // Already there (a retry after the reply was lost): same as success.
      if (error.code === '23505' && calls.some(([m]) => m === 'insert')) return 'ok'
      if (isRetryable(error, status)) return 'retry'
      return this.fail(`${calls[0]?.[0] ?? 'write'} ${table}`, error)
    } catch (e) {
      // supabase-js throws on network failure when throwOnError is on; treat any throw as transient.
      if (looksOffline(e as RemoteError) || !navigator.onLine) return 'retry'
      return this.fail(entry.payload.name ?? entry.payload.table ?? 'change', e as RemoteError)
    }
  }

  /** The server refused this change for good: drop it and tell the user. */
  private async fail(what: string, error: RemoteError): Promise<'failed'> {
    const failure: SyncFailure = { what, message: error.message ?? 'The server rejected this change.', at: Date.now() }
    syncStatus.set({ failures: [...syncStatus.get().failures, failure].slice(-5) })
    return 'failed'
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
    // Set after an app update moved the device copy to a new schema: its rows came across from the old
    // copy, which may be missing columns the update added, so every row is fetched again once.
    const refreshAll = (await this.local.meta('refresh_all')) === true

    // A failed table is skipped, unless the device went offline: then nothing else gets through either.
    const settle = (table: string, e: unknown) => {
      const err = e as RemoteError
      // An error the server sent back (it has a code, e.g. a statement timeout) means it was reachable.
      if ((!err?.code && looksOffline(err)) || (typeof navigator !== 'undefined' && navigator.onLine === false)) throw e
      if (isMissingTable(err)) this.missing.add(table)
      else failed.push(err.message ?? table)
    }
    const arrived = (table: string) => {
      // The server has it now: changes held for it can go up on the next round.
      if (this.missing.delete(table)) this.again = true
    }

    if (eachTable) {
      for (const table of tables) {
        let change: Incoming | null
        try {
          change = await this.download(table, refreshAll)
        } catch (e) {
          settle(table, e)
          continue
        }
        arrived(table)
        if (!change) continue
        let applied: boolean
        try {
          applied = await this.applyIncoming({ [table]: change })
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
    } else {
      // Tables download side by side, so a sync takes about as long as its slowest table.
      const results = await Promise.allSettled(tables.map((t) => this.download(t, refreshAll)))
      results.forEach((r, i) => {
        const table = tables[i]
        if (r.status === 'rejected') settle(table, r.reason)
        else {
          arrived(table)
          if (r.value) incoming[table] = r.value
        }
      })
    }

    const changed = changedAny || Object.keys(incoming).length > 0
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
          }
        }
      }
      if (!applied) {
        // Something was queued while downloading; the server copy is stale for it. Go round again.
        this.again = true
        return false
      }
    }
    await this.local.setMeta('last_pull_at', Date.now())
    if (refreshAll && failed.length === 0) await this.local.setMeta('refresh_all', false)
    syncStatus.set({ lastSyncedAt: Date.now(), error: failed[0] ?? null })
    if (changed) notifyLocalDataChanged()
    return changed
  }

  /** What has to change locally to match the server's copy of `table`, or null when nothing does. */
  private async download(table: string, refreshAll = false): Promise<Incoming | null> {
    const hasUpdatedAt = this.local.engine.catalog.tablesWithUpdatedAt.has(table)
    const remoteIndex = await this.remoteIndex(table, hasUpdatedAt)
    const localIndex = await this.localIndex(table, hasUpdatedAt)

    const wanted: string[] = []
    for (const [id, stamp] of remoteIndex) if (refreshAll || localIndex.get(id) !== stamp) wanted.push(id)
    const deletes = [...localIndex.keys()].filter((id) => !remoteIndex.has(id))
    if (wanted.length === 0 && deletes.length === 0) return null

    const upserts: Record<string, unknown>[] = []
    for (let i = 0; i < wanted.length; i += FETCH_CHUNK) {
      const { data, error } = await this.remote.from(table).select('*').in('id', wanted.slice(i, i + FETCH_CHUNK))
      if (error) throw remoteError(table, error)
      upserts.push(...((data as Record<string, unknown>[]) ?? []))
    }
    return { upserts, deletes }
  }

  /**
   * id -> change stamp. Tables without updated_at (investment_value_snapshots) are insert-only, so
   * an id seen on both sides is treated as unchanged.
   */
  private async remoteIndex(table: string, hasUpdatedAt: boolean): Promise<Map<string, string>> {
    const index = new Map<string, string>()
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.remote
        .from(table)
        .select(hasUpdatedAt ? 'id, updated_at' : 'id')
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) throw remoteError(table, error)
      const rows = (data as unknown as Array<{ id: string; updated_at?: string }>) ?? []
      for (const r of rows) index.set(r.id, hasUpdatedAt ? String(new Date(r.updated_at as string).getTime()) : '')
      if (rows.length < PAGE) return index
    }
  }

  private async localIndex(table: string, hasUpdatedAt: boolean): Promise<Map<string, string>> {
    const res = await this.local.db.query<{ id: string; updated_at?: Date | string }>(
      `select id${hasUpdatedAt ? ', updated_at' : ''} from public."${table}"`
    )
    return new Map(res.rows.map((r) => [r.id, hasUpdatedAt ? String(new Date(r.updated_at as string | Date).getTime()) : '']))
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
