'use client'

import { useState } from 'react'
import { Plus, Search, Filter, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { isSameMonth } from '@/utils/budget-month'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface BudgetsHeaderProps {
  onAddBudget: () => void
  searchQuery: string
  onSearchChange: (value: string) => void
  month: Date
  onMonthChange: (month: Date) => void
}

export function BudgetsHeader({
  onAddBudget,
  searchQuery,
  onSearchChange,
  month,
  onMonthChange,
}: BudgetsHeaderProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(month.getFullYear())
  const today = new Date()

  return (
    <div className="flex flex-col gap-4 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Budget Tracker
          </h1>
          <p className="text-muted-foreground mt-1">Plan, track, and stay within your financial goals.</p>
        </div>
        <Button onClick={onAddBudget} className="flex items-center gap-2 h-11 px-5 rounded-full shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
          <Plus className="w-5 h-5" />
          Create New Budget
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Find a budget..."
            className="pl-10 h-11 bg-card border-border/50 focus:border-primary/50 transition-all rounded-xl"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" className="flex-1 sm:flex-none h-11 gap-2 rounded-xl border-border/50 bg-card hover:bg-secondary/50">
            <Filter className="w-4 h-4 text-muted-foreground" />
            Category
          </Button>
          <Popover
            open={pickerOpen}
            onOpenChange={(open) => {
              setPickerOpen(open)
              if (open) setPickerYear(month.getFullYear())
            }}
          >
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex-1 sm:flex-none h-11 gap-2 rounded-xl border-border/50 bg-card hover:bg-secondary/50">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 rounded-2xl p-4">
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
        </div>
      </div>
    </div>
  )
}
