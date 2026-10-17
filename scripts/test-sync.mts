// End-to-end sync test: a "server" Postgres, a "device" local database, and the real SyncEngine between them.
// Run: npx tsx scripts/test-sync.mts
import { PGlite } from '@electric-sql/pglite'
import type { SupabaseClient } from '@supabase/supabase-js'
import { LOCAL_EXTRAS_STATEMENTS, LOCAL_PRELUDE_STATEMENTS, LOCAL_SCHEMA_STATEMENTS } from '../lib/local/schema.generated'
import { loadCatalog, LocalEngine, type Db } from '../lib/local/engine'
import { recordingBuilder } from '../lib/local/builder'
import { LocalDatabase } from '../lib/local/database'
import { SyncEngine, syncStatus } from '../lib/local/sync'

// sync.ts reads navigator.onLine to decide whether to try the network.
const setOnline = (on: boolean) => Object.defineProperty(globalThis.navigator, 'onLine', { value: on, configurable: true })
setOnline(true)

const UID = '11111111-1111-1111-1111-111111111111'

// --- the server ---------------------------------------------------------------------------------
const serverDb = new PGlite()
for (const s of [...LOCAL_PRELUDE_STATEMENTS, ...LOCAL_SCHEMA_STATEMENTS, ...LOCAL_EXTRAS_STATEMENTS]) await serverDb.exec(s)
await serverDb.exec(`set session_replication_role = replica; insert into auth.users (id, email) values ('${UID}', 'a@b.c'); insert into public.profiles (id, username) values ('${UID}', 'tester'); set session_replication_role = origin`)
await serverDb.exec(`select set_config('app.user_id', '${UID}', false)`)
const server = new LocalEngine(serverDb as unknown as Db, await loadCatalog(serverDb as unknown as Db))
let offline = false
const remote = {
  from: (t: string) => recordingBuilder([], (c) => (offline ? Promise.reject(new Error('Failed to fetch')) : server.execute('table', t, c))),
  rpc: (n: string, args: object = {}) => recordingBuilder([['rpc-args', [args]]], (c) => (offline ? Promise.reject(new Error('Failed to fetch')) : server.execute('rpc', n, c))),
  auth: { refreshSession: async () => ({}) },
} as unknown as SupabaseClient
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const S = (t: string): any => remote.from(t)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SR = (n: string, a: object = {}): any => remote.rpc(n, a)

let failures = 0
const check = (label: string, ok: boolean, extra?: unknown) => {
  if (!ok) failures++
  console.log(ok ? 'ok  ' : 'FAIL', label, ok ? '' : JSON.stringify(extra))
}
const snapshot = async (db: PGlite) =>
  JSON.stringify({
    wallets: (await db.query('select id, name, balance from public.wallets order by id')).rows,
    transactions: (await db.query('select id, type, amount, wallet_id, status from public.transactions order by id')).rows,
    bills: (await db.query('select id, name, payment_status, paid_amount from public.bills order by id')).rows,
    categories: (await db.query('select id, name from public.categories where owner_id is not null order by id')).rows,
  })

// Data that exists before the device ever syncs.
const w = await S('wallets').insert({ name: 'Cash', type: 'cash', balance: 1000 }).select().single()
await SR('transactions_create', { p_wallet_id: w.data.id, p_amount: 100, p_type: 'expense', p_description: 'before', p_date: new Date().toISOString() })

// --- the device ---------------------------------------------------------------------------------
let queuedSignals = 0
const local = await LocalDatabase.open({ userId: UID, email: 'a@b.c', username: 'tester', factory: async () => new PGlite(), onQueued: () => queuedSignals++ })
const sync = new SyncEngine(local, remote)
await sync.hydrate()
check('hydrate copies server data', (await snapshot(local.db)) === (await snapshot(serverDb)), { local: await snapshot(local.db), server: await snapshot(serverDb) })

// Offline work.
offline = true
setOnline(false)
const L = (t: string) => recordingBuilder([], (c) => local.engine.execute('table', t, c)) as any // eslint-disable-line @typescript-eslint/no-explicit-any
const LR = (n: string, a: object = {}) => recordingBuilder([['rpc-args', [a]]], (c) => local.engine.execute('rpc', n, c)) as any // eslint-disable-line @typescript-eslint/no-explicit-any
const wal2 = await L('wallets').insert({ name: 'Bank', type: 'bank', balance: 200 }).select().single()
const cat = await LR('categories_create', { p_name: 'Food', p_type: 'expense' })
await LR('transactions_create', { p_wallet_id: wal2.data.id, p_amount: 30, p_type: 'expense', p_category_id: cat.data.id, p_description: 'lunch', p_date: new Date().toISOString() })
const bill = await LR('bills_create', { p_name: 'Salary', p_amount: 5000, p_due_date: new Date().toISOString(), p_is_recurring: true, p_type: 'income', p_recurring_frequency: 'biweekly', p_wallet_id: wal2.data.id })
await LR('bills_mark_paid', { p_id: bill.data.id })
check('changes queued while offline', (await local.pendingCount()) === 5 && queuedSignals === 5, { pending: await local.pendingCount(), queuedSignals })
await sync.request()
check('offline: nothing pushed, queue kept', (await local.pendingCount()) === 5)

// Back online.
offline = false
setOnline(true)
await sync.request()
check('queue drained', (await local.pendingCount()) === 0, await local.pendingCount())
const a = await snapshot(local.db)
const b = await snapshot(serverDb)
check('device and server converge with identical ids', a === b, { a, b })
const balance = (await serverDb.query<{ balance: number }>(`select balance::float as balance from public.wallets where id = $1`, [wal2.data.id])).rows[0].balance
check('server applied the same rules (200 - 30 + 5000 = 5170)', balance === 5170, balance)

// Another device changes things.
await S('wallets').update({ name: 'Cash (renamed)' }).eq('id', w.data.id)
await SR('transactions_create', { p_wallet_id: w.data.id, p_amount: 10, p_type: 'expense', p_description: 'from phone', p_date: new Date().toISOString() })
await sync.request()
check('pull brings other-device changes', (await snapshot(local.db)) === (await snapshot(serverDb)))

// Deleted on the server.
const victim = (await serverDb.query<{ id: string }>(`select id from public.transactions where description = 'from phone'`)).rows[0].id
await SR('transactions_delete', { p_id: victim })
await sync.request()
check('pull removes rows deleted elsewhere', (await snapshot(local.db)) === (await snapshot(serverDb)))

// A change the server rejects: the wallet was archived on another device while this one was offline.
offline = true
setOnline(false)
await LR('transactions_create', { p_wallet_id: wal2.data.id, p_amount: 100, p_type: 'expense', p_description: 'will be rejected', p_date: new Date().toISOString() })
offline = false
setOnline(true)
await serverDb.query(`update public.wallets set status = 'archived' where id = $1`, [wal2.data.id])
await sync.request()
const st = syncStatus.get()
check('rejected change is reported', st.failures.length === 1 && /wallet|inactive|not found/i.test(st.failures[0].message), st.failures)
check('after a rejection the device matches the server again', (await snapshot(local.db)) === (await snapshot(serverDb)))
check('queue empty after failure', (await local.pendingCount()) === 0)

// Replaying the same op twice is harmless.
const opId = crypto.randomUUID()
await SR('sync_replay', { p_op_id: opId, p_name: 'bills_summary', p_args: {}, p_ids: [] })
const again = await SR('sync_replay', { p_op_id: opId, p_name: 'bills_summary', p_args: {}, p_ids: [] })
check('duplicate replay ignored', again.data?.duplicate === true, again)

sync.stop()
console.log(failures ? `${failures} FAILURES` : 'ALL PASSED')
process.exit(failures ? 1 : 0)
