import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChevronDown, Search, X } from 'lucide-react'
import { BillStatus, BillType, PaymentStatus } from '@/types/bill'

export interface BillsFilterState {
  search: string
  paymentStatus: PaymentStatus | 'all'
  status: BillStatus | 'all'
  type: BillType | 'all'
  recurrence: 'all' | 'recurring' | 'one-time'
  dueWindow: 'all' | '7' | '30' | '90'
}

interface BillsFiltersProps {
  filters: BillsFilterState
  onChange: (next: BillsFilterState) => void
  onReset: () => void
}

export function BillsFilters({ filters, onChange, onReset }: BillsFiltersProps) {
  const [isOpen, setIsOpen] = useState(false)

  const updateFilter = <K extends keyof BillsFilterState>(key: K, value: BillsFilterState[K]) => {
    onChange({ ...filters, [key]: value })
  }

  const activeFilterCount = Number(Boolean(filters.search))
    + Number(filters.paymentStatus !== 'all')
    + Number(filters.status !== 'all')
    + Number(filters.type !== 'all')
    + Number(filters.recurrence !== 'all')
    + Number(filters.dueWindow !== 'all')

  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-ios sm:p-6 space-y-4">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground">Filter Bills</h2>
          {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount}</Badge>}
        </span>
        <span className="flex items-center gap-1">
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(event) => {
                event.stopPropagation()
                onReset()
              }}
              className="text-destructive hover:text-destructive"
            >
              Clear
            </Button>
          )}
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {isOpen && (
        <>
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              placeholder="Search by bill name..."
              className="pl-9 pr-9"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => updateFilter('search', '')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Select value={filters.type} onValueChange={(value) => updateFilter('type', value as BillsFilterState['type'])}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="bill">Bills</SelectItem>
            <SelectItem value="income">Income</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.paymentStatus} onValueChange={(value) => updateFilter('paymentStatus', value as BillsFilterState['paymentStatus'])}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Payment status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payments</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="received">Received</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.recurrence} onValueChange={(value) => updateFilter('recurrence', value as BillsFilterState['recurrence'])}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Recurrence" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="recurring">Recurring</SelectItem>
            <SelectItem value="one-time">One-time</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.dueWindow} onValueChange={(value) => updateFilter('dueWindow', value as BillsFilterState['dueWindow'])}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Due window" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any Due Date</SelectItem>
            <SelectItem value="7">Next 7 days</SelectItem>
            <SelectItem value="30">Next 30 days</SelectItem>
            <SelectItem value="90">Next 90 days</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.status} onValueChange={(value) => updateFilter('status', value as BillsFilterState['status'])}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Bill status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
          </div>
        </>
      )}
    </div>
  )
}
