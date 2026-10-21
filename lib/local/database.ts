// The on-device database: Postgres (PGlite) persisted in IndexedDB, one per signed-in user.
// It carries the same schema as the server, built from the migrations (see schema.generated.ts).
import type { PGlite } from '@electric-sql/pglite'
import { loadCatalog, LocalEngine, type Db } from './engine'
import {
  LOCAL_EXTRAS_STATEMENTS,
  LOCAL_PRELUDE_STATEMENTS,
  LOCAL_SCHEMA_STATEMENTS,
  LOCAL_SCHEMA_VERSION,
} from './schema.generated'
import { SYNCED_TABLES, upsertRows } from './sync'

export interface OpenParams {
  userId: string
  email?: string
  username?: string
  /** Called whenever a change is queued for sync. */
  onQueued?: () => void
  /** Overrides how PGlite is created (tests use an in-memory instance). */
  factory?: (dataDir: string) => Promise<PGlite>
  /** Overrides how copies from older schema versions are found and removed (tests). */
  legacy?: { list: (current: string) => Promise<string[]>; remove: (dataDir: string) => Promise<void> }
}

/** The synced rows of an older copy, carried into a new schema so the app opens from them right away. */
interface CarriedData {
  lastPullAt: unknown
  rows: Record<string, Record<string, unknown>[]>
}

interface OutboxRow {
  op_id: string
  kind: string
  payload: unknown
  ids: unknown
  created_at: string
}

const dataDirFor = (userId: string, version = LOCAL_SCHEMA_VERSION) => `fico-${userId}-${version}`

async function createPglite(dataDir: string): Promise<PGlite> {
  const { PGlite } = await import('@electric-sql/pglite')
  // relaxedDurability lets the install's hundreds of statements skip a per-statement IndexedDB flush;
  // the engine flushes explicitly after each real change (see LocalEngine.mutating).
  return PGlite.create(`idb://${dataDir}`, { relaxedDurability: true })
}

async function isInstalled(db: PGlite): Promise<boolean> {
  const meta = await db.query<{ t: string | null }>(`select to_regclass('public._sync_meta')::text as t`)
  if (!meta.rows[0]?.t) return false
  const version = await db.query<{ value: string }>(`select value from public._sync_meta where key = 'schema_version'`)
  return version.rows[0]?.value === LOCAL_SCHEMA_VERSION
}

async function install(db: PGlite, params: OpenParams) {
  // Statement by statement (not one batch): enum values added by a migration can only be used once
  // the statement that adds them has committed.
  for (const stmt of [...LOCAL_PRELUDE_STATEMENTS, ...LOCAL_SCHEMA_STATEMENTS, ...LOCAL_EXTRAS_STATEMENTS]) {
    await db.exec(stmt)
  }
  await seedUser(db, params)
  await db.query(`insert into public._sync_meta (key, value) values ('schema_version', to_jsonb($1::text))`, [LOCAL_SCHEMA_VERSION])
}

/**
 * The local copy of auth.users plus a stand-in profile, so foreign keys hold before the first sync
 * brings the real profile down.
 */
async function seedUser(db: PGlite, { userId, email, username }: OpenParams) {
  await db.transaction(async (tx) => {
    await tx.query(`set local session_replication_role = replica`)
    await tx.query(`insert into auth.users (id, email) values ($1, $2) on conflict (id) do nothing`, [userId, email ?? null])
    await tx.query(`insert into public.profiles (id, username) values ($1, $2) on conflict (id) do nothing`, [
      userId,
      username || (email ? email.split('@')[0] : `user-${userId.slice(0, 8)}`),
    ])
  })
}

/** The synced tables of an older copy, or null when it never finished its first download. */
async function readCarried(db: PGlite): Promise<CarriedData | null> {
  const meta = await db.query<{ t: string | null }>(`select to_regclass('public._sync_meta')::text as t`)
  if (!meta.rows[0]?.t) return null
  const last = await db.query<{ value: unknown }>(`select value from public._sync_meta where key = 'last_pull_at'`)
  if (last.rows[0]?.value == null) return null
  const rows: CarriedData['rows'] = {}
  for (const table of SYNCED_TABLES) {
    const exists = await db.query<{ t: string | null }>(`select to_regclass($1)::text as t`, [`public."${table}"`])
    if (!exists.rows[0]?.t) continue
    const res = await db.query<{ rows: Record<string, unknown>[] }>(`select coalesce(json_agg(t), '[]'::json) as rows from public."${table}" t`)
    rows[table] = res.rows[0]?.rows ?? []
  }
  return { lastPullAt: last.rows[0].value, rows }
}

/**
 * Writes an older copy's rows into a freshly installed one and marks it as downloaded, so the app
 * opens from it instead of downloading everything again. The next sync fetches every row once to
 * fill in what the new schema added. All or nothing: on failure the first download runs as usual.
 */
async function writeCarried(db: PGlite, carried: CarriedData): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await tx.query(`set local session_replication_role = replica`)
      for (const [table, rows] of Object.entries(carried.rows)) {
        const exists = await tx.query<{ t: string | null }>(`select to_regclass($1)::text as t`, [`public."${table}"`])
        if (exists.rows[0]?.t) await upsertRows(tx, table, rows)
      }
      for (const [key, value] of [
        ['last_pull_at', carried.lastPullAt],
        ['refresh_all', true],
      ] as const) {
        await tx.query(
          `insert into public._sync_meta (key, value) values ($1, $2::jsonb) on conflict (key) do update set value = excluded.value`,
          [key, JSON.stringify(value)]
        )
      }
    })
  } catch (e) {
    console.warn('[offline] could not carry the device copy across the update, downloading it again:', e)
  }
}

/** IndexedDB copies of this user's database from older schema versions (names look like /pglite/fico-<user>-<version>). */
async function legacyDataDirs(userId: string, current: string): Promise<string[]> {
  try {
    const dbs = (await indexedDB.databases?.()) ?? []
    return dbs
      .map((d) => (d.name ?? '').replace(/^\/pglite\//, ''))
      .filter((name) => name.startsWith(`fico-${userId}-`) && name !== current)
  } catch {
    return []
  }
}

function deleteIdb(dataDir: string): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(`/pglite/${dataDir}`)
    req.onsuccess = req.onerror = req.onblocked = () => resolve()
  })
}

export class LocalDatabase {
  private constructor(
    readonly db: PGlite,
    readonly engine: LocalEngine,
    readonly userId: string,
    readonly dataDir: string
  ) {}

  static async open(params: OpenParams): Promise<LocalDatabase> {
    const create = params.factory ?? createPglite
    const dataDir = dataDirFor(params.userId)
    const db = await create(dataDir)

    if (!(await isInstalled(db))) {
      // A newer schema replaces any older copy. Changes still waiting to sync move across, and so does
      // the data itself, so an app update doesn't mean downloading everything again.
      const legacy = params.legacy ?? { list: (current: string) => legacyDataDirs(params.userId, current), remove: deleteIdb }
      const outbox: OutboxRow[] = []
      let carried: CarriedData | null = null
      const olds = await legacy.list(dataDir)
      for (const old of olds) {
        try {
          const oldDb = await create(old)
          try {
            const rows = await oldDb.query<OutboxRow>(
              `select op_id, kind, payload, ids, created_at from public._sync_outbox where status = 'pending' order by seq`
            )
            outbox.push(...rows.rows)
            const data = await readCarried(oldDb).catch(() => null)
            if (data && (!carried || Number(data.lastPullAt) > Number(carried.lastPullAt))) carried = data
          } finally {
            await oldDb.close().catch(() => {})
          }
        } catch {
          // An unreadable old copy has nothing recoverable.
        }
      }
      await install(db, params)
      if (carried) await writeCarried(db, carried)
      for (const row of outbox) {
        await db.query(`insert into public._sync_outbox (op_id, kind, payload, ids, created_at) values ($1, $2, $3::jsonb, $4::jsonb, $5)`, [
          row.op_id,
          row.kind,
          JSON.stringify(row.payload),
          JSON.stringify(row.ids),
          row.created_at,
        ])
      }
      // Only now that everything is in the new copy: the app closing before this point loses nothing.
      for (const old of olds) await legacy.remove(old)
    }

    await db.query(`select set_config('app.user_id', $1, false)`, [params.userId])
    const catalog = await loadCatalog(db as unknown as Db)
    const engine = new LocalEngine(db as unknown as Db, catalog, params.onQueued)
    return new LocalDatabase(db, engine, params.userId, dataDir)
  }

  get sql(): Db {
    return this.db as unknown as Db
  }

  async meta<T = unknown>(key: string): Promise<T | null> {
    const res = await this.db.query<{ value: T }>(`select value from public._sync_meta where key = $1`, [key])
    return res.rows[0]?.value ?? null
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    await this.db.query(
      `insert into public._sync_meta (key, value) values ($1, $2::jsonb) on conflict (key) do update set value = excluded.value`,
      [key, JSON.stringify(value)]
    )
  }

  async pendingCount(): Promise<number> {
    const res = await this.db.query<{ n: number }>(`select count(*)::int as n from public._sync_outbox where status = 'pending'`)
    return res.rows[0]?.n ?? 0
  }

  async close(): Promise<void> {
    await this.db.close()
  }

  /**
   * Removes a user's local data that no runtime has open (sign-out after a first download that never
   * finished), unless it holds changes waiting to sync.
   */
  static async discard(userId: string): Promise<void> {
    const dataDir = dataDirFor(userId)
    const dbs = (await indexedDB.databases?.().catch(() => [])) ?? []
    if (!dbs.some((d) => d.name === `/pglite/${dataDir}`)) return
    const db = await createPglite(dataDir)
    let pending = 0
    try {
      const res = await db.query<{ n: number }>(
        `select case when to_regclass('public._sync_outbox') is null then 0 else (select count(*)::int from public._sync_outbox where status = 'pending') end as n`
      )
      pending = res.rows[0]?.n ?? 0
    } finally {
      await db.close().catch(() => {})
    }
    if (pending === 0) await deleteIdb(dataDir)
  }

  /** Closes and removes this user's local data (used on sign-out). */
  async destroy(): Promise<void> {
    await this.db.close().catch(() => {})
    await deleteIdb(this.dataDir)
  }
}
