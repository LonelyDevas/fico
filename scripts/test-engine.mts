// Exercises the local engine against the real schema in PGlite (Node). Run: npx tsx scripts/test-engine.mts
import { PGlite } from '@electric-sql/pglite'
import { LOCAL_EXTRAS_STATEMENTS, LOCAL_PRELUDE_STATEMENTS, LOCAL_SCHEMA_STATEMENTS } from '../lib/local/schema.generated'
import { loadCatalog, LocalEngine, type Db } from '../lib/local/engine'
import { recordingBuilder } from '../lib/local/builder'

const UID = '11111111-1111-1111-1111-111111111111'
const db = new PGlite()
for (const s of [...LOCAL_PRELUDE_STATEMENTS, ...LOCAL_SCHEMA_STATEMENTS, ...LOCAL_EXTRAS_STATEMENTS]) await db.exec(s)
await db.exec(`set session_replication_role = replica; insert into auth.users (id, email) values ('${UID}', 'a@b.c'); insert into public.profiles (id, username) values ('${UID}', 'tester'); set session_replication_role = origin`)
await db.exec(`select set_config('app.user_id', '${UID}', false)`)

let queued = 0
const engine = new LocalEngine(db as unknown as Db, await loadCatalog(db as unknown as Db), () => queued++)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const from = (t: string) => recordingBuilder([], (c) => engine.execute('table', t, c)) as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (n: string, args: object = {}) => recordingBuilder([['rpc-args', [args]]], (c) => engine.execute('rpc', n, c)) as any
let failures = 0
const check = (label: string, ok: boolean, extra?: unknown) => {
  if (!ok) failures++
  console.log(ok ? 'ok  ' : 'FAIL', label, ok ? '' : JSON.stringify(extra))
}

// wallets: insert + select single
const w = await from('wallets').insert({ name: 'Cash', type: 'cash', balance: 1000 }).select().single()
check('insert wallet returns row with id + numeric balance', !w.error && typeof w.data.id === 'string' && w.data.balance === 1000, w)
await from('wallets').insert({ name: 'Bank', type: 'bank', balance: 500 }).select().single()
check('wallet writes queued', queued === 2, queued)

// category (rpc) + transaction (rpc) with embeds
const cat = await rpc('categories_create', { p_name: 'Food', p_type: 'expense' })
check('categories_create', !cat.error && cat.data?.name === 'Food', cat)
const tx = await rpc('transactions_create', { p_wallet_id: w.data.id, p_amount: 150, p_type: 'expense', p_category_id: cat.data.id, p_description: 'coffee', p_date: new Date().toISOString(), p_tags: ['x'], p_attachments: [] })
check('transactions_create', !tx.error && tx.data?.amount === 150, tx)
const list = await from('transactions')
  .select('*, wallet:wallets!transactions_wallet_id_fkey(name,type,currency), category:categories(name,type), to_wallet:wallets!transactions_to_wallet_id_fkey(name)', { count: 'exact' })
  .eq('status', 'completed')
  .overlaps('tags', ['x'])
  .order('date', { ascending: false })
  .range(0, 9)
check('list with embeds + count', !list.error && list.count === 1 && list.data[0].wallet.name === 'Cash' && list.data[0].category.name === 'Food' && list.data[0].to_wallet === null, list)
const after = await from('wallets').select('balance').eq('id', w.data.id).single()
check('wallet balance debited by RPC', after.data?.balance === 850, after)

// filters
const ilike = await from('transactions').select('id').ilike('description', '%COF%')
check('ilike', ilike.data?.length === 1, ilike)
const orr = await from('transactions').select('id').or(`wallet_id.eq.${w.data.id},to_wallet_id.eq.${w.data.id}`).limit(1)
check('or()', orr.data?.length === 1, orr)
const inn = await from('wallets').select('id,name').in('name', ['Cash', 'Bank']).order('name')
check('in()', inn.data?.length === 2 && inn.data[0].name === 'Bank', inn)
const head = await from('categories').select('*', { count: 'exact', head: true }).not('owner_id', 'is', null)
check('head count', head.data === null && head.count === 1, head)

// bills: recurring income, mark paid, summary, embeds
const bill = await rpc('bills_create', { p_name: 'Salary', p_amount: 5000, p_due_date: new Date().toISOString(), p_is_recurring: true, p_type: 'income', p_recurring_frequency: 'biweekly', p_wallet_id: w.data.id })
check('bills_create biweekly', !bill.error && bill.data.recurring_frequency === 'biweekly', bill)
const before = queued
const summary = await rpc('bills_summary')
check('read-only rpc not queued', queued === before && summary.data?.totalBills === 1, { queued, before })
const paid = await rpc('bills_mark_paid', { p_id: bill.data.id })
check('bills_mark_paid', !paid.error, paid)
const sum2 = await rpc('bills_summary')
check('summary amounts present', sum2.data.paidAmount === 5000, sum2.data)
const bl = await from('bills')
  .select('*, category:categories(name), wallet:wallets!bills_wallet_id_fkey(name,type)', { count: 'exact' })
  .eq('status', 'active')
  .order('due_date', { ascending: true })
  .range(0, 19)
check('bills list', !bl.error && bl.count === 2 && bl.data[0].wallet.name === 'Cash', bl)

// update / delete / errors
const up = await from('categories').update({ status: 'archived' }).eq('id', cat.data.id)
check('update without select -> data null', up.error === null && up.data === null, up)
const q0 = queued
await from('categories').update({ status: 'archived' }).eq('id', '99999999-9999-9999-9999-999999999999')
check('update matching nothing is not queued', queued === q0, { queued, q0 })
const err = await from('transactions').insert({ wallet_id: 'nope' })
check('error shape', err.error && typeof err.error.message === 'string', err)
const sav = await from('wallets').insert({ name: 'Sav', type: 'savings', balance: 100 }).select().single()
const blocked = await rpc('transactions_create', { p_wallet_id: sav.data.id, p_amount: 5, p_type: 'expense', p_date: new Date().toISOString() })
check('savings expense blocked with message', blocked.error?.message?.includes("can't pay directly"), blocked)
const none = await from('wallets').select('*').eq('id', '99999999-9999-9999-9999-999999999999').maybeSingle()
check('maybeSingle none -> null', none.error === null && none.data === null, none)
const sErr = await from('wallets').select('*').eq('id', '99999999-9999-9999-9999-999999999999').single()
check('single none -> PGRST116', sErr.error?.code === 'PGRST116', sErr)

// reports and other RPCs used by the app
for (const [name, args] of [
  ['reports_monthly', { p_year: 2026 }],
  ['reports_quick_stats', { p_period: 'month' }],
  ['budgets_summary', {}],
  ['transactions_all_tags', {}],
  ['obligations_summary', {}],
  ['investments_summary', {}],
  ['budgets_list', {}],
] as const) {
  const r = await rpc(name, args as object)
  check(`rpc ${name}`, !r.error, r.error)
}
const outbox = await db.query<{ kind: string }>('select kind from public._sync_outbox order by seq')
console.log('outbox entries:', outbox.rows.length)
console.log(failures ? `${failures} FAILURES` : 'ALL PASSED')
process.exit(failures ? 1 : 0)
