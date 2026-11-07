'use client'

import { useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { ManageHeader } from '@/components/page/manage-header'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { isSameMonth } from '@/utils/budget-month'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface BudgetsHeaderProps {
  onAddBudget: () => void
  /** Label of the main button. */
  addLabel?: string
  /** One short line of totals under the title. */
  summary?: string
  loading?: boolean
  month: Date
  onMonthChange: (month: Date) => void
}

export function BudgetsHeader({ onAddBudget, addLabel = 'New budget', summary, loading, month, onMonthChange }: BudgetsHeaderProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(month.getFullYear())
  const today = new Date()
  const step = (by: number) => onMonthChange(new Date(month.getFullYear(), month.getMonth() + by, 1))

  return (
    <div className="mb-6 space-y-4">
      <ManageHeader statsHref="/statistics#budgets" eyebrow="Spending limits" title="Budgets" summary={summary} loading={loading} onAdd={onAddBudget} addLabel={addLabel} />

      <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card px-2 py-1.5">
        <button type="button" onClick={() => step(-1)} aria-label="Previous month" className="rounded-full p-2 text-foreground transition-colors hover:bg-secondary">
          <ChevronLeft className="h-5 w-5" />
        </button>
          <Popover
            open={pickerOpen}
            onOpenChange={(open) => {
              setPickerOpen(open)
              if (open) setPickerYear(month.getFullYear())
            }}
          >
            <PopoverTrigger asChild>
              <button type="button" className="flex min-w-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-secondary">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </button>
            </PopoverTrigger>
            <PopoverContent align="center" className="w-72 rounded-2xl p-4">
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setPickerYear((y) => y - 1)}
                  aria-label="Previous year"
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-semibold text-foreground">{pickerYear}</span>
                <button
                  type="button"
                  onClick={() => setPickerYear((y) => y + 1)}
                  aria-label="Next year"
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {MONTHS.map((label, index) => {
                  const option = new Date(pickerYear, index, 1)
                  const selected = isSameMonth(option, month)
                  const current = isSameMonth(option, today)
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        onMonthChange(option)
                        setPickerOpen(false)
                      }}
                      className={`rounded-xl py-2 text-sm font-medium transition-colors ${
                        selected
                          ? 'bg-primary text-primary-foreground'
                          : current
                            ? 'bg-primary/10 text-primary hover:bg-primary/20'
                            : 'text-foreground hover:bg-secondary'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              {!isSameMonth(month, today) && (
                <button
                  type="button"
                  onClick={() => {
                    onMonthChange(new Date(today.getFullYear(), today.getMonth(), 1))
                    setPickerOpen(false)
                  }}
                  className="mt-3 w-full rounded-full bg-primary/10 py-2 text-sm font-semibold text-primary hover:bg-primary/20"
                >
                  Back to this month
                </button>
              )}
            </PopoverContent>
          </Popover>
        <button type="button" onClick={() => step(1)} aria-label="Next month" className="rounded-full p-2 text-foreground transition-colors hover:bg-secondary">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
