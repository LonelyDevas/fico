'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { create } from 'zustand'
import { Trash2 } from 'lucide-react'
import { Field, FormSheet, chipClass, fieldClass, scrollBleedClass } from '@/components/ui/form-sheet'
import { useListCategories } from '@/queries/user/category/categories'
import { useListWallets } from '@/queries/user/wallet/wallets'
import { useCreateRule, useDeleteRule, useUpdateRule } from '@/queries/user/rule/rules'
import { RULE_OPS, type Rule, type RuleField, type RuleOp } from '@/utils/rules'

export type RuleDraft = Partial<Omit<Rule, 'id' | 'position'>> & { id?: string }

/** Opens the rule sheet from anywhere, e.g. "Create a rule" after fixing a category. */
export const useRuleSheet = create<{ draft: RuleDraft | null; open: (draft: RuleDraft) => void; close: () => void }>((set) => ({
  draft: null,
  open: (draft) => set({ draft }),
  close: () => set({ draft: null }),
}))

/* eslint-disable @typescript-eslint/no-explicit-any */
const asList = (data: any): any[] => (Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : Array.isArray(data?.wallets) ? data.wallets : [])
/* eslint-enable @typescript-eslint/no-explicit-any */

const TYPES: { value: 'expense' | 'income' | null; label: string }[] = [
  { value: null, label: 'Both' },
  { value: 'expense', label: 'Expenses' },
  { value: 'income', label: 'Income' },
]

function RuleForm({ draft, onClose }: { draft: RuleDraft; onClose: () => void }) {
  const [matchField, setMatchField] = useState<RuleField>(draft.matchField ?? 'description')
  const [matchOp, setMatchOp] = useState<RuleOp>(draft.matchOp ?? 'contains')
  const [matchValue, setMatchValue] = useState(draft.matchValue ?? '')
  const [matchType, setMatchType] = useState<'expense' | 'income' | null>(draft.matchType ?? null)
  const [categoryId, setCategoryId] = useState<string | null>(draft.setCategoryId ?? null)
  const [walletId, setWalletId] = useState<string | null>(draft.setWalletId ?? null)
  const [tags, setTags] = useState((draft.setTags ?? []).join(', '))

  const { data: categoriesResponse } = useListCategories()
  const { data: walletsResponse } = useListWallets()
  const categories = useMemo(
    () => asList(categoriesResponse?.data).filter((c) => c.status !== 'archived' && (!matchType || !c.type || c.type === matchType)),
    [categoriesResponse, matchType]
  )
  const wallets = useMemo(() => asList(walletsResponse?.data).filter((w) => w.status !== 'archived'), [walletsResponse])

  const create = useCreateRule()
  const update = useUpdateRule()
  const remove = useDeleteRule()
  const busy = create.isPending || update.isPending || remove.isPending

  const tagList = tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  const valid = matchValue.trim().length > 0 && (!!categoryId || !!walletId || tagList.length > 0)

  const submit = () => {
    if (!valid) return
    const data = { matchField, matchOp, matchValue, matchType, setCategoryId: categoryId, setWalletId: walletId, setTags: tagList, enabled: draft.enabled ?? true }
    const done = () => {
      toast.success(draft.id ? 'Rule saved' : 'Rule added. It applies to new transactions from now on.')
      onClose()
    }
    if (draft.id) update.mutate({ id: draft.id, ...data }, { onSuccess: done })
    else create.mutate(data, { onSuccess: done })
  }

  return (
    <FormSheet
      open
      onClose={onClose}
      title={draft.id ? 'Edit rule' : 'New rule'}
      description="When a transaction's note matches, fill in its category, wallet or tags."
      submitLabel={draft.id ? 'Save rule' : 'Add rule'}
      onSubmit={submit}
      busy={busy}
      submitDisabled={!valid}
    >
      <Field label="When the">
        <div className="flex gap-2">
          {(['description', 'notes'] as RuleField[]).map((f) => (
            <button key={f} type="button" className={chipClass(matchField === f)} onClick={() => setMatchField(f)}>
              {f === 'description' ? 'Description' : 'Notes'}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Text">
        <div className={scrollBleedClass}>
          {RULE_OPS.map((o) => (
            <button key={o.value} type="button" className={chipClass(matchOp === o.value)} onClick={() => setMatchOp(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
        <input
          value={matchValue}
          onChange={(e) => setMatchValue(e.target.value)}
          placeholder="jollibee"
          aria-label="Text to match"
          autoCapitalize="none"
          className={`${fieldClass} mt-2`}
        />
      </Field>

      <Field label="For">
        <div className="flex gap-2">
          {TYPES.map((t) => (
            <button key={t.label} type="button" className={chipClass(matchType === t.value)} onClick={() => setMatchType(t.value)}>
              {t.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Set category">
        <div className={scrollBleedClass}>
          {categories.map((c) => {
            const id = String(c._id ?? c.id)
            return (
              <button key={id} type="button" className={chipClass(categoryId === id)} onClick={() => setCategoryId(categoryId === id ? null : id)}>
                {c.name}
              </button>
            )
          })}
        </div>
      </Field>

      <Field label="Set wallet" hint="Optional. Leave empty to keep the wallet you pick.">
        <div className={scrollBleedClass}>
          {wallets.map((w) => {
            const id = String(w._id ?? w.id)
            return (
              <button key={id} type="button" className={chipClass(walletId === id)} onClick={() => setWalletId(walletId === id ? null : id)}>
                {w.name}
              </button>
            )
          })}
        </div>
      </Field>

      <Field label="Add tags" hint="Optional. Separate with commas.">
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="eating out, weekend" aria-label="Tags" className={fieldClass} />
      </Field>

      {draft.id && (
        <button
          type="button"
          disabled={busy}
          onClick={() => remove.mutate({ id: draft.id as string }, { onSuccess: () => { toast.success('Rule deleted'); onClose() } })}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
          Delete rule
        </button>
      )}
    </FormSheet>
  )
}

/** Mounted once at the app root, so any screen can open the rule sheet. */
export function RuleSheetHost() {
  const { draft, close } = useRuleSheet()
  if (!draft) return null
  // Keyed so each opening starts from its own draft.
  return <RuleForm key={draft.id ?? JSON.stringify(draft)} draft={draft} onClose={close} />
}
