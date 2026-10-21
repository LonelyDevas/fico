'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { chipClass, Field, FormSheet, fieldClass, MoneyField, scrollRowClass } from '@/components/ui/form-sheet'
import { useListCategories } from '@/queries/user/category/categories'
import { useCreatePlannedItem, useUpdatePlannedItem } from '@/queries/user/planned/planned-items'
import type { PlannedItem, PlannedItemStatus, PlannedItemType } from '@/types/planned-item'

interface PlannedItemSheetProps {
  open: boolean
  onClose: () => void
  /** When set, edits this item instead of creating one. */
  item?: PlannedItem | null
  initialType?: PlannedItemType
}

const today = () => new Date().toISOString().slice(0, 10)

const STATUSES: { value: PlannedItemStatus; label: string }[] = [
  { value: 'expected', label: 'Expected' },
  { value: 'confirmed', label: 'Confirmed' },
]

export function PlannedItemSheet({ open, onClose, item, initialType = 'income' }: PlannedItemSheetProps) {
  const { mutate: create, isPending: creating } = useCreatePlannedItem()
  const { mutate: update, isPending: updating } = useUpdatePlannedItem()
  const isEdit = !!item

  const [type, setType] = useState<PlannedItemType>('income')
  const [name, setName] = useState('')
  const [low, setLow] = useState('')
  const [high, setHigh] = useState('')
  const [date, setDate] = useState(today())
  const [status, setStatus] = useState<PlannedItemStatus>('expected')
  const [categoryId, setCategoryId] = useState('')
  const [notes, setNotes] = useState('')

  const { data: categoriesResponse } = useListCategories({ type, limit: '100' })
  const categories = useMemo(() => {
    const data = categoriesResponse?.data as any
    const list: any[] = Array.isArray(data) ? data : data?.items ?? []
    return list.map((c) => ({ id: String(c._id ?? c.id), name: String(c.name) }))
  }, [categoriesResponse])

  useEffect(() => {
    if (!open) return
    setType(item?.type ?? initialType)
    setName(item?.name ?? '')
    setLow(item ? String(item.amountLow) : '')
    setHigh(item && item.amountHigh !== item.amountLow ? String(item.amountHigh) : '')
    setDate(item?.date ?? today())
    setStatus(item?.status ?? 'expected')
    setCategoryId(item?.categoryId ?? '')
    setNotes(item?.notes ?? '')
  }, [open, item, initialType])

  const isIncome = type === 'income'

  const finish = (message: string) => {
    toast.success(message)
    onClose()
  }

  const submit = () => {
    if (!name.trim()) return void toast.error('Give it a name')
    const lowNum = Number(low) || 0
    // No highest amount means the amount is known exactly.
    const highNum = high.trim() ? Number(high) || 0 : lowNum
    if (lowNum <= 0) return void toast.error('Enter the amount')
    if (highNum < lowNum) return void toast.error('The highest amount must be at least the lowest')
    if (!date) return void toast.error('Pick a date')

    const data = {
      name: name.trim(),
      type,
      amountLow: lowNum,
      amountHigh: highNum,
      date,
      status,
      categoryId: categoryId || null,
      notes: notes.trim() || null,
    }
    if (isEdit && item) update({ id: item.id, ...data }, { onSuccess: () => finish('Saved') })
    else create(data, { onSuccess: () => finish('Added to your plan') })
  }

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit' : isIncome ? 'Money coming in' : 'Money going out'}
      description="Plan a one-off income or expense with a low and a high estimate."
      submitLabel={isEdit ? 'Save changes' : 'Add to plan'}
      onSubmit={submit}
      busy={creating || updating}
    >
      <div role="group" aria-label="Type" className="grid grid-cols-2 gap-1 rounded-full bg-secondary p-1">
        {([
          ['income', 'Coming in'],
          ['expense', 'Going out'],
        ] as const).map(([value, text]) => (
          <button
            key={value}
            type="button"
            aria-pressed={type === value}
            onClick={() => {
              if (value !== type) setCategoryId('')
              setType(value)
            }}
            className={`rounded-full py-2 text-sm font-semibold transition-colors ${type === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
          >
            {text}
          </button>
        ))}
      </div>

      <Field label="What is it">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={isIncome ? '13th month pay' : 'Trip home'} aria-label="Name" className={fieldClass} />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="At least">
          <MoneyField value={low} onChange={setLow} ariaLabel="Lowest amount" />
        </Field>
        <Field label="At most (optional)" hint="Leave empty if you know the exact amount.">
          <MoneyField value={high} onChange={setHigh} ariaLabel="Highest amount" />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="When">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" className={fieldClass} />
        </Field>
        <Field label="How sure">
          <div className={scrollRowClass} role="group" aria-label="Status">
            {STATUSES.map((s) => (
              <button key={s.value} type="button" aria-pressed={status === s.value} onClick={() => setStatus(s.value)} className={chipClass(status === s.value)}>
                {s.label}
              </button>
            ))}
          </div>
        </Field>
      </div>

      {categories.length > 0 && (
        <Field label="Category (optional)">
          <div className={scrollRowClass} role="group" aria-label="Category">
            {categories.map((c) => (
              <button key={c.id} type="button" aria-pressed={categoryId === c.id} onClick={() => setCategoryId(categoryId === c.id ? '' : c.id)} className={chipClass(categoryId === c.id)}>
                {c.name}
              </button>
            ))}
          </div>
        </Field>
      )}

      <Field label="Note (optional)">
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to remember" aria-label="Note" className={fieldClass} />
      </Field>
    </FormSheet>
  )
}
