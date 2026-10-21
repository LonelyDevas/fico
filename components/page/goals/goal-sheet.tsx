'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Check } from 'lucide-react'
import { chipClass, Field, FormSheet, fieldClass, MoneyField } from '@/components/ui/form-sheet'
import { useCreateGoal, useUpdateGoal } from '@/queries/user/goal/goals'
import { useListWallets } from '@/queries/user/wallet/wallets'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import type { Goal } from '@/types/goal'
import { asGoalWallets } from './goal-progress'

interface GoalSheetProps {
  open: boolean
  onClose: () => void
  /** When set, edits this goal instead of creating one. */
  goal?: Goal | null
}

export function GoalSheet({ open, onClose, goal }: GoalSheetProps) {
  const { currency, hideAmountsOnOpen } = useSettingsStore()
  const { mutate: create, isPending: creating } = useCreateGoal()
  const { mutate: update, isPending: updating } = useUpdateGoal()
  const { data: walletsResponse } = useListWallets({ limit: '100' })
  const wallets = useMemo(() => asGoalWallets(walletsResponse?.data), [walletsResponse])
  const isEdit = !!goal

  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [deadline, setDeadline] = useState('')
  const [walletIds, setWalletIds] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    setName(goal?.name ?? '')
    setTarget(goal ? String(goal.targetAmount) : '')
    setDeadline(goal?.deadline ?? '')
    setWalletIds(goal?.linkedWalletIds ?? [])
  }, [open, goal])

  const toggleWallet = (id: string) =>
    setWalletIds((ids) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]))

  const finish = (message: string) => {
    toast.success(message)
    onClose()
  }

  const submit = () => {
    if (!name.trim()) return void toast.error('Give it a name')
    const targetAmount = Number(target) || 0
    if (targetAmount <= 0) return void toast.error('Enter the amount you want to save')

    const payload = { name: name.trim(), targetAmount, deadline: deadline || null, linkedWalletIds: walletIds }
    if (isEdit && goal) {
      update({ id: goal.id, ...payload }, { onSuccess: () => finish('Saved') })
      return
    }
    create(payload, { onSuccess: () => finish('Goal added') })
  }

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit goal' : 'New goal'}
      description="Set an amount to save, a deadline, and the wallets that hold the money."
      submitLabel={isEdit ? 'Save changes' : 'Add goal'}
      onSubmit={submit}
      busy={creating || updating}
    >
      <Field label="Amount to save">
        <MoneyField value={target} onChange={setTarget} ariaLabel="Amount to save" />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="What is it for">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Emergency fund" aria-label="Name" className={fieldClass} />
        </Field>
        <Field label="Deadline (optional)">
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} aria-label="Deadline" className={fieldClass} />
        </Field>
      </div>

      <Field
        label="Counts toward it"
        hint={walletIds.length === 0 ? 'None picked, so every savings wallet counts.' : 'The balance of these wallets is what you have saved so far.'}
      >
        <div className="flex flex-wrap gap-2" role="group" aria-label="Wallets">
          {wallets.map((w) => {
            const selected = walletIds.includes(w.id)
            return (
              <button key={w.id} type="button" aria-pressed={selected} onClick={() => toggleWallet(w.id)} className={`${chipClass(selected)} flex items-center gap-1.5`}>
                {w.name}
                <span className="text-xs tabular-nums text-muted-foreground">{formatMoney(w.balance, currency, hideAmountsOnOpen)}</span>
                {selected && <Check className="h-3.5 w-3.5" />}
              </button>
            )
          })}
        </div>
      </Field>
    </FormSheet>
  )
}
