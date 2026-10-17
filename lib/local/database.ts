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

export interface OpenParams {
  userId: string
  email?: string
  username?: string
  /** Called whenever a change is queued for sync. */
  onQueued?: () => void
  /** Overrides how PGlite is created (tests use an in-memory instance). */
  factory?: (dataDir: string) => Promise<PGlite>
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
      // A newer schema replaces any older copy, but changes still waiting to sync move across.
      const carried: OutboxRow[] = []
      for (const old of await legacyDataDirs(params.userId, dataDir)) {
        try {
          const oldDb = await create(old)
          const rows = await oldDb.query<OutboxRow>(
            `select op_id, kind, payload, ids, created_at from public._sync_outbox where status = 'pending' order by seq`
          )
          carried.push(...rows.rows)
          await oldDb.close()
        } catch {
          // An unreadable old copy has nothing recoverable.
        }
        await deleteIdb(old)
      }
      await install(db, params)
      for (const row of carried) {
        await db.query(`insert into public._sync_outbox (op_id, kind, payload, ids, created_at) values ($1, $2, $3::jsonb, $4::jsonb, $5)`, [
          row.op_id,
          row.kind,
          JSON.stringify(row.payload),
          JSON.stringify(row.ids),
          row.created_at,
        ])
      }
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

  /** Closes and removes this user's local data (used on sign-out). */
  async destroy(): Promise<void> {
    await this.db.close().catch(() => {})
    await deleteIdb(this.dataDir)
  }
}
