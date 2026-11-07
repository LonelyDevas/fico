// Undo/redo: deletes wait for Undo and send nothing when undone; undo after the delete restores the
// row and the wallet balance through the same RPCs. Run: npx tsx scripts/test-undo.mts
import { PGlite } from '@electric-sql/pglite'
import { LOCAL_EXTRAS_STATEMENTS, LOCAL_PRELUDE_STATEMENTS, LOCAL_SCHEMA_STATEMENTS } from '../lib/local/schema.generated'
import { recordingBuilder } from '../lib/local/builder'
import { LocalDatabase } from '../lib/local/database'
import { useUndoStore } from '../store/undo-store'

let failures = 0
const check = (label: string, ok: boolean, extra?: unknown) => {
  if (!ok) failures++
  console.log(ok ? 'ok  ' : 'FAIL', label, ok ? '' : JSON.stringify(extra))
}

// --- the store ---------------------------------------------------------------------------------
const store = useUndoStore.getState()
let commits = 0
const a = store.deferDelete('row-a', async () => void commits++)
check('a waiting delete hides the row', useUndoStore.getState().pendingDeletes.includes('row-a'))
check('undo inside the window cancels it', a.cancel() && !useUndoStore.getState().pendingDeletes.includes('row-a'))
await a.flush()
check('a cancelled delete never runs', commits === 0, commits)
const b = store.deferDelete('row-b', async () => void commits++)
await b.flush()
check('a delete runs once its time is up', commits === 1 && !b.cancel(), commits)
store.deferDelete('row-c', async () => void commits++)
await store.flushDeletes()
check('closing the app runs waiting deletes', commits === 2, commits)

const log: string[] = []
const e1 = store.push({ label: 'one', undo: async () => void log.push('undo one'), redo: async () => void log.push('redo one') })
store.push({ label: 'two', undo: async () => void log.push('undo two'), redo: async () => void log.push('redo two') })
await useUndoStore.getState().undo()
check('undo takes the newest change', log.join() === 'undo two' && useUndoStore.getState().future[0]?.label === 'two')
await useUndoStore.getState().redo()
check('redo puts it back', log.join() === 'undo two,redo two' && useUndoStore.getState().past[0]?.label === 'two')
await useUndoStore.getState().undo(e1.id)
check('an older change can be undone by id', log.at(-1) === 'undo one' && useUndoStore.getState().past.length === 1)
store.push({ label: 'three', undo: async () => {}, redo: async () => {} })
check('a new change clears redo', useUndoStore.getState().future.length === 0)

// --- balances and the sync queue, on the device database ------------------------------------------
const UID = '11111111-1111-1111-1111-111111111111'
const local = await LocalDatabase.open({ userId: UID, email: 'a@b.c', username: 'tester', factory: async () => new PGlite() })
const L = (t: string) => recordingBuilder([], (c) => local.engine.execute('table', t, c)) as any // eslint-disable-line @typescript-eslint/no-explicit-any
const LR = (n: string, args: object = {}) => recordingBuilder([['rpc-args', [args]]], (c) => local.engine.execute('rpc', n, c)) as any // eslint-disable-line @typescript-eslint/no-explicit-any
const wallet = await L('wallets').insert({ name: 'Cash', type: 'cash', balance: 1000 }).select().single()
const balance = async () => Number((await local.db.query<{ b: string }>(`select balance::text as b from public.wallets where id = $1`, [wallet.data.id])).rows[0].b)
const tx = await LR('transactions_create', { p_wallet_id: wallet.data.id, p_amount: 120, p_type: 'expense', p_description: 'Lunch', p_date: new Date().toISOString() })
const queued = await local.pendingCount()

// Undo inside the window: the delete never runs, so nothing new is queued and the balance never moved.
const waiting = store.deferDelete(tx.data.id, async () => void (await LR('transactions_delete', { p_id: tx.data.id })))
waiting.cancel()
check('undo in time: nothing queued, balance unchanged', (await local.pendingCount()) === queued && (await balance()) === 880, { pending: await local.pendingCount(), balance: await balance() })

// Undo after the delete ran: re-created through transactions_create, balance back to where it was.
await LR('transactions_delete', { p_id: tx.data.id })
check('the delete gives the money back', (await balance()) === 1000, await balance())
await LR('transactions_create', { p_wallet_id: wallet.data.id, p_amount: 120, p_type: 'expense', p_description: 'Lunch', p_date: new Date().toISOString() })
check('undo restores the transaction and the balance', (await balance()) === 880 && (await local.db.query(`select 1 from public.transactions where description = 'Lunch'`)).rows.length === 1, await balance())

// Undo of an edit restores the old amount through transactions_update.
const t2 = (await local.db.query<{ id: string }>(`select id from public.transactions where description = 'Lunch'`)).rows[0].id
await LR('transactions_update', { p_id: t2, p_amount: 200 })
check('edit moves the balance', (await balance()) === 800, await balance())
await LR('transactions_update', { p_id: t2, p_amount: 120 })
check('undoing the edit moves it back', (await balance()) === 880, await balance())

console.log(failures ? `${failures} FAILURES` : 'ALL PASSED')
process.exit(failures ? 1 : 0)
