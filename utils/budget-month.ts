// A budget row covers one period (start_date..end_date) and its `spent` is counted inside that
// range, so "the budgets for a month" are the rows whose range overlaps that calendar month.
export const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1)

export const isSameMonth = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()

export const budgetOverlapsMonth = (
  budget: { startDate?: string | null; endDate?: string | null },
  month: Date
) => {
  const monthStart = startOfMonth(month)
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 1)
  const start = budget.startDate ? new Date(budget.startDate) : null
  const end = budget.endDate ? new Date(budget.endDate) : null
  if (start && start >= monthEnd) return false
  if (end && end < monthStart) return false
  return true
}
