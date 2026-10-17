// Device DB (A) does work offline; server DB (B) replays it through sync_replay. Ids and results must match.
import { bootLocalDb } from './test-local-schema.mjs'

const UID = '11111111-1111-1111-1111-111111111111'
const setup = async (db) => {
  await db.exec(`set session_replication_role = replica`)
  await db.exec(`insert into auth.users (id, email) values ('${UID}', 'a@b.c')`)
  await db.exec(`insert into public.profiles (id, username) values ('${UID}', 'tester')`)
  await db.exec(`set session_replication_role = origin`)
  await db.exec(`select set_config('app.user_id', '${UID}', false)`)
}
const A = await bootLocalDb(); const B = await bootLocalDb()
await setup(A); await setup(B)

const ops = []
const run = async (name, args, kind = 'rpc') => {
  const names = Object.keys(args)
  const sql = `select to_jsonb(public.${name}(${names.map((k, i) => `${k} => $${i + 1}`).join(', ')})) as r`
  const res = await A.transaction(async (tx) => {
    await tx.query('truncate public._sync_id_log')
    await tx.query(`select set_config('app.dirty','',true)`)
    const out = await tx.query(sql, Object.values(args))
    const ids = (await tx.query('select id from public._sync_id_log order by seq')).rows.map((r) => r.id)
    const dirty = (await tx.query(`select current_setting('app.dirty', true) as d`)).rows[0].d
    return { out: out.rows[0].r, ids, dirty }
  })
  ops.push({ name, args, ids: res.ids, dirty: res.dirty })
  return res
}

// Wallet via direct insert (client supplies the id).
const walletId = '22222222-2222-2222-2222-222222222222'
await A.query(`insert into public.wallets (id, name, type, balance) values ($1, 'Cash', 'cash', 1000)`, [walletId])
await B.query(`insert into public.wallets (id, name, type, balance) values ($1, 'Cash', 'cash', 1000)`, [walletId])

const t1 = await run('transactions_create', { p_wallet_id: walletId, p_amount: 150, p_type: 'expense', p_description: 'coffee', p_date: new Date().toISOString(), p_tags: ['a', 'b'], p_attachments: [] })
console.log('txn ids', t1.ids, 'dirty', t1.dirty, 'balance row', t1.out.id)
const b1 = await run('bills_create', { p_name: 'Salary', p_amount: 5000, p_due_date: new Date().toISOString(), p_is_recurring: true, p_type: 'income', p_recurring_frequency: 'biweekly', p_wallet_id: walletId })
console.log('bill', b1.out.id, 'ids', b1.ids)
const m = await run('bills_mark_paid', { p_id: b1.out.id })
console.log('mark paid ids', m.ids, 'dirty', m.dirty)
const ro = await run('bills_summary', {})
console.log('summary dirty?', JSON.stringify(ro.dirty), ro.out.totalBills, ro.out.paidAmount)

// Replay on B
for (const op of ops) {
  const r = await B.query(`select public.sync_replay($1::uuid, $2, $3::jsonb, $4::jsonb) as r`, [crypto.randomUUID(), op.name, JSON.stringify(op.args), JSON.stringify(op.ids)])
  console.log('replay', op.name, JSON.stringify(r.rows[0].r))
}
const dump = async (db) => ({
  wallets: (await db.query('select id, balance from public.wallets order by id')).rows,
  txns: (await db.query('select id, type, amount, wallet_id from public.transactions order by id')).rows,
  bills: (await db.query('select id, name, payment_status, due_date from public.bills order by id')).rows,
})
const a = JSON.stringify(await dump(A)); const b = JSON.stringify(await dump(B))
console.log(a === b ? 'MATCH: device and server converge, same ids' : 'MISMATCH\nA ' + a + '\nB ' + b)
// duplicate replay is ignored
const opId = crypto.randomUUID()
await B.query(`select public.sync_replay($1::uuid, 'bills_summary', '{}'::jsonb, '[]'::jsonb)`, [opId])
console.log('dup', JSON.stringify((await B.query(`select public.sync_replay($1::uuid, 'bills_summary', '{}'::jsonb, '[]'::jsonb) as r`, [opId])).rows[0].r))
