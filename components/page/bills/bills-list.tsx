import { Bill, PaymentStatus } from '@/types/bill'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  CalendarDays,
  RefreshCcw,
  Repeat,
  CircleCheck,
  CircleDashed,
  CircleAlert,
  Wallet,
  MoreVertical,
  Pencil,
  Trash2,
  TrendingUp,
  MinusCircle,
  CalendarCheck,
} from 'lucide-react'
import { formatDate, formatDueDateLabel, getDaysFromToday, formatMoney } from '@/utils/formatter'
import { useSettingsStore } from '@/store/settings-store'

interface BillsListProps {
  bills: Bill[]
  isLoading?: boolean
  hasMore?: boolean
  isLoadingMore?: boolean
  onLoadMore?: () => void
  onMarkPaid: (id: string) => void
  onMarkUnpaid: (id: string) => void
  onEdit: (bill: Bill) => void
  onDelete: (bill: Bill) => void
  processingBillId?: string | null
}

const paymentBadgeStyles: Record<PaymentStatus, string> = {
  paid: 'bg-success/15 text-success border border-success/30',
  unpaid: 'bg-secondary text-foreground border border-border',
  overdue: 'bg-destructive/15 text-destructive border border-destructive/30',
  partial: 'bg-warning/15 text-warning border border-warning/30',
  received: 'bg-success/15 text-success border border-success/30',
}

const paymentIcons: Record<PaymentStatus, React.ReactNode> = {
  paid: <CircleCheck className="w-3.5 h-3.5" />,
  unpaid: <CircleDashed className="w-3.5 h-3.5" />,
  overdue: <CircleAlert className="w-3.5 h-3.5" />,
  partial: <RefreshCcw className="w-3.5 h-3.5" />,
  received: <CircleCheck className="w-3.5 h-3.5" />,
}

const sortByDueDate = (items: Bill[]): Bill[] => {
  return [...items].sort((left, right) => {
    const leftTime = new Date(left.dueDate).getTime()
    const rightTime = new Date(right.dueDate).getTime()

    if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0
    if (Number.isNaN(leftTime)) return 1
    if (Number.isNaN(rightTime)) return -1

    return leftTime - rightTime
  })
}

export function BillsList({
  bills,
  isLoading,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onMarkPaid,
  onMarkUnpaid,
  onEdit,
  onDelete,
  processingBillId,
}: BillsListProps) {
  const { currency, hideAmountsOnOpen } = useSettingsStore()

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(6)].map((_, index) => (
          <div key={index} className="h-24 bg-card border border-border rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (!bills.length) {
    return (
      <Card className="py-0">
        <CardContent className="p-12 text-center">
          <p className="text-lg font-semibold text-foreground">No entries found</p>
          <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or create a new bill or income entry to get started.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {sortByDueDate(bills).map((bill) => {
        const dueDays = getDaysFromToday(bill.dueDate)
        const isIncome = bill.type === 'income'
        const isSettled = bill.paymentStatus === 'paid' || bill.paymentStatus === 'received'
        const isOverdue = !isSettled && typeof dueDays === 'number' && dueDays < 0
        const showMarkPaid = !isSettled
        const markActionLabel = isIncome ? (showMarkPaid ? 'Mark Received' : 'Mark Unreceived') : (showMarkPaid ? 'Mark Paid' : 'Mark Unpaid')
        const cardTone = isOverdue
          ? 'border-warning/40 bg-gradient-to-br from-warning/15 via-warning/6 to-transparent shadow-sm shadow-warning/10'
          : isIncome
            ? 'border-success/30 bg-gradient-to-br from-success/12 via-success/5 to-transparent'
            : 'border-destructive/20 bg-gradient-to-br from-destructive/8 via-destructive/4 to-transparent'
        const statusTone = isOverdue ? 'text-warning' : isIncome ? 'text-success' : 'text-destructive'
        const walletName = bill.wallet?.name || bill.walletId
        const categoryName = bill.category?.name || bill.categoryId

        return (
          <Card
            key={bill.id}
            className={`py-0 border transition-all duration-200 hover:shadow-ios ${cardTone}`}
          >
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="space-y-3 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-base font-semibold text-foreground truncate">{bill.name}</p>
                    {isIncome && (
                      <Badge variant="outline" className="gap-1 border-success/40 text-success">
                        <TrendingUp className="w-3.5 h-3.5" />
                        Income
                      </Badge>
                    )}
                    <Badge className={paymentBadgeStyles[bill.paymentStatus]}>
                      {paymentIcons[bill.paymentStatus]}
                      <span className="capitalize">{bill.paymentStatus}</span>
                    </Badge>
                    {bill.isRecurring && (
                      <Badge variant="outline" className="gap-1">
                        <Repeat className="w-3.5 h-3.5" />
                        {bill.recurringFrequency === 'biweekly' ? 'Every 2 weeks' : bill.recurringFrequency || 'Recurring'}
                      </Badge>
                    )}
                    {bill.status === 'archived' && <Badge variant="secondary">Archived</Badge>}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarDays className="w-4 h-4" />
                      <span>{bill.dueDate ? formatDate(bill.dueDate) : 'No due date'}</span>
                    </div>
                    <div className={`text-sm font-medium ${statusTone}`}>
                      {!bill.dueDate
                        ? 'No due date'
                        : isSettled
                          ? (isIncome ? 'Received' : 'Paid')
                          : formatDueDateLabel(bill.dueDate)}
                    </div>
                    {categoryName && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="inline-flex h-2 w-2 rounded-full bg-muted-foreground/60" />
                        <span>{categoryName}</span>
                      </div>
                    )}
                    {walletName && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Wallet className="w-4 h-4" />
                        <span>{walletName}</span>
                      </div>
                    )}
                    {bill.absenceDeduction != null && bill.absenceDeduction > 0 && (
                      <div className="flex items-center gap-1.5 text-warning">
                        <MinusCircle className="w-4 h-4" />
                        <span className="font-medium">{formatMoney(bill.absenceDeduction, currency, hideAmountsOnOpen)} absence deduction</span>
                      </div>
                    )}
                    {bill.paidDate && (
                      <div className="flex items-center gap-1.5 text-success">
                        <CalendarCheck className="w-4 h-4" />
                        <span className="font-medium">{isIncome ? 'Received' : 'Paid'} {formatDate(bill.paidDate)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
                  <p className={`text-xl font-bold ${statusTone}`}>
                    {formatMoney(bill.amount, currency, hideAmountsOnOpen)}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={showMarkPaid ? 'default' : 'outline'}
                      onClick={() => (showMarkPaid ? onMarkPaid(bill.id) : onMarkUnpaid(bill.id))}
                      disabled={processingBillId === bill.id}
                      className="flex-1 sm:min-w-28"
                    >
                      {processingBillId === bill.id ? 'Saving...' : markActionLabel}
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9">
                          <MoreVertical className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => requestAnimationFrame(() => onEdit(bill))} className="gap-2">
                          <Pencil className="w-4 h-4" />
                          <span>Edit Details</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => requestAnimationFrame(() => onDelete(bill))}
                          className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Archive Bill</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={onLoadMore} disabled={isLoadingMore}>
            {isLoadingMore ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  )
}
