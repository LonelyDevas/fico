// Undo and redo for transaction deletes and edits (transfers included). Every step goes through the
// same calls as the original change (the transactions_* RPCs), so wallet balances and the offline
// sync queue stay right. A delete waits a few seconds first (store/undo-store.ts): undoing it in that
// window means nothing reaches the server at all.

import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { actionToast } from '@/components/ui/action-toast'
import { useUndoStore, type UndoEntry } from '@/store/undo-store'
import { supabase } from '@/utils/supabase-client'
import { handleApiError } from '@/utils/error-handler'
import { createTransaction, deleteTransaction, invalidateTransactionAndWalletQueries, updateTransaction } from './transaction'
import type { UpdateTransactionData } from '@/types/transaction'

/** The fields undo needs from a transaction row (the list's TransactionItem has them all). */
export interface UndoableTransaction {
  id: string
  description?: string
  title?: string
  date?: string
  amount?: number
  type?: 'income' | 'expense' | 'transfer'
  status?: 'completed' | 'pending' | 'cancelled'
  walletId?: string
  categoryId?: string
  toWalletId?: string
  serviceFee?: number
  tags?: string[]
  attachments?: string[]
  excludeFromBaseline?: boolean
  affectsBalance?: boolean
}

const nameOf = (tx: UndoableTransaction) => tx.description || tx.title || 'transaction'

/** An update that puts every field back the way `tx` had it. */
const restoreOf = (tx: UndoableTransaction): UpdateTransactionData => ({
  id: tx.id,
  walletId: tx.walletId,
  categoryId: tx.categoryId || undefined,
  amount: tx.amount,
  type: tx.type,
  description: tx.description,
  date: tx.date,
  tags: tx.tags ?? [],
  attachments: tx.attachments ?? [],
  status: tx.status,
  excludeFromBaseline: tx.excludeFromBaseline ?? false,
  toWalletId: tx.type === 'transfer' ? tx.toWalletId : undefined,
  affectsBalance: tx.affectsBalance !== false,
})

/** The update RPC keeps a category when given none, so clearing one is a plain column write. */
async function clearCategory(id: string) {
  const { error } = await supabase.from('transactions').update({ category_id: null }).eq('id', id)
  if (error) throw error
}

export function useTransactionUndo() {
  const queryClient = useQueryClient()
  const refresh = () => invalidateTransactionAndWalletQueries(queryClient)
  const store = useUndoStore

  const offerRedo = (entry: UndoEntry) =>
    actionToast(
      'Undone',
      'Redo',
      () =>
        void store
          .getState()
          .redo(entry.id)
          .then(() => toast.success('Redone'))
          .catch(handleApiError),
      { id: `undo-${entry.id}` }
    )

  const offerUndo = (entry: UndoEntry, message: string) =>
    actionToast(
      message,
      'Undo',
      () =>
        void store
          .getState()
          .undo(entry.id)
          .then((done) => done && offerRedo(done))
          .catch(handleApiError),
      { id: `undo-${entry.id}` }
    )

  /** Deletes after a short wait, with Undo. Undo inside the wait sends nothing; later it re-creates the row. */
  const deleteWithUndo = (tx: UndoableTransaction, onDeleted?: () => void) => {
    let currentId = tx.id
    const schedule = () =>
      store.getState().deferDelete(currentId, async () => {
        try {
          await deleteTransaction({ id: currentId })
          onDeleted?.()
        } catch (error) {
          handleApiError(error)
        } finally {
          refresh()
        }
      })
    let pending = schedule()

    const entry = store.getState().push({
      label: `Deleted “${nameOf(tx)}”`,
      undo: async () => {
        if (pending.cancel()) return
        // Already deleted: put it back as it was (it gets a new id).
        const res = await createTransaction({
          walletId: tx.walletId as string,
          amount: tx.amount ?? 0,
          type: tx.type ?? 'expense',
          description: tx.description,
          categoryId: tx.categoryId || undefined,
          date: tx.date,
          tags: tx.tags ?? [],
          attachments: tx.attachments ?? [],
          toWalletId: tx.type === 'transfer' ? tx.toWalletId : undefined,
          serviceFee: tx.serviceFee || undefined,
          affectsBalance: tx.affectsBalance !== false,
        })
        currentId = String(res?.data?.id ?? currentId)
        if ((tx.status && tx.status !== 'completed') || tx.excludeFromBaseline) {
          await updateTransaction({ id: currentId, status: tx.status, excludeFromBaseline: tx.excludeFromBaseline })
        }
        refresh()
      },
      redo: async () => {
        pending = schedule()
      },
    })
    offerUndo(entry, `Deleted “${nameOf(tx)}”`)
    return entry
  }

  /** Saves an edit, with Undo back to `before` and Redo forward again. */
  const updateWithUndo = async (before: UndoableTransaction, data: UpdateTransactionData, message = 'Changes saved') => {
    try {
      await updateTransaction(data)
    } catch (error) {
      handleApiError(error)
      throw error
    }
    refresh()
    const apply = async (target: UpdateTransactionData, hadCategory: boolean) => {
      await updateTransaction(target)
      if (!hadCategory) await clearCategory(target.id)
      refresh()
    }
    const entry = store.getState().push({
      label: `Edited “${nameOf(before)}”`,
      undo: () => apply(restoreOf(before), !!before.categoryId),
      redo: () => apply(data, true),
    })
    offerUndo(entry, message)
    return entry
  }

  return { deleteWithUndo, updateWithUndo }
}

/** Rows waiting to be deleted (hidden from lists until the delete runs or is undone). */
export const usePendingDeletes = () => useUndoStore((s) => s.pendingDeletes)
