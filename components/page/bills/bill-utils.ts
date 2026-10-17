import { extractArrayFromApiResponse, extractNumberFromApiResponse, getApiDataNode, isRecord, resolveEntityId } from '@/lib/api-response'
import { Bill, BillSummary, BillStatus, BillType, PaymentStatus, RecurringFrequency } from '../../../types/bill'

const paymentStatuses: PaymentStatus[] = ['paid', 'unpaid', 'overdue', 'partial', 'received']
const billStatuses: BillStatus[] = ['active', 'archived']
const billTypes: BillType[] = ['bill', 'income']
const recurringFrequencies: RecurringFrequency[] = ['daily', 'weekly', 'biweekly', 'monthly', 'yearly']

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const toString = (value: unknown, fallback = ''): string => {
  return typeof value === 'string' ? value : fallback
}

const toEntityId = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value
  if (isRecord(value) && typeof value._id === 'string') return value._id
  if (isRecord(value) && typeof value.id === 'string') return value.id
  return undefined
}

const toEntityObject = <T extends { _id?: unknown; id?: unknown }>(value: unknown): T | undefined => {
  if (!isRecord(value)) return undefined

  const resolvedId = toEntityId(value)
  if (!resolvedId) return undefined

  return {
    ...(value as Record<string, unknown>),
    _id: resolvedId,
  } as T
}

const toBoolean = (value: unknown, fallback = false): boolean => {
  return typeof value === 'boolean' ? value : fallback
}

const toPaymentStatus = (value: unknown): PaymentStatus => {
  if (typeof value === 'string' && paymentStatuses.includes(value as PaymentStatus)) {
    return value as PaymentStatus
  }
  return 'unpaid'
}

const toBillStatus = (value: unknown): BillStatus => {
  if (typeof value === 'string' && billStatuses.includes(value as BillStatus)) {
    return value as BillStatus
  }
  return 'active'
}

const toBillType = (value: unknown): BillType => {
  if (typeof value === 'string' && billTypes.includes(value as BillType)) {
    return value as BillType
  }
  return 'bill'
}

const toRecurringFrequency = (value: unknown): RecurringFrequency | undefined => {
  if (typeof value === 'string' && recurringFrequencies.includes(value as RecurringFrequency)) {
    return value as RecurringFrequency
  }
  return undefined
}

export const normalizeBillsResponse = (response: unknown): Bill[] => {
  const items = extractArrayFromApiResponse<Record<string, unknown>>(response, ['items', 'bills'])

  return items.map((item, index) => ({
    id: resolveEntityId(item, `bill-${index}`),
    type: toBillType(item.type),
    name: toString(item.name, 'Untitled Bill'),
    amount: toNumber(item.amount),
    categoryId: toEntityId(item.category ?? item.categoryId),
    category: toEntityObject(item.category),
    dueDate: toString(item.dueDate),
    isRecurring: toBoolean(item.isRecurring),
    recurringFrequency: toRecurringFrequency(item.recurringFrequency),
    walletId: toEntityId(item.wallet ?? item.walletId),
    wallet: toEntityObject(item.wallet),
    reminder: typeof item.reminder === 'boolean' ? item.reminder : undefined,
    reminderDays: typeof item.reminderDays === 'number' ? item.reminderDays : undefined,
    notes: toString(item.notes) || undefined,
    status: toBillStatus(item.status),
    paymentStatus: toPaymentStatus(item.paymentStatus),
    paidAmount: typeof item.paidAmount === 'number' ? item.paidAmount : undefined,
    paidDate: toString(item.paidDate) || undefined,
    absenceDeduction: typeof item.absenceDeduction === 'number' ? item.absenceDeduction : undefined,
  }))
}

export const normalizeBillSummary = (response: unknown): BillSummary => {
  const totalBills = extractNumberFromApiResponse(response, ['totalBills', 'count', 'billsCount'], 0)
  const totalAmount = extractNumberFromApiResponse(response, ['totalAmount', 'amount', 'total'], 0)
  const paidBills = extractNumberFromApiResponse(response, ['paidBills'], 0)
  const unpaidBills = extractNumberFromApiResponse(response, ['unpaidBills'], 0)
  const overdueBills = extractNumberFromApiResponse(response, ['overdueBills'], 0)
  const dueSoonBills = extractNumberFromApiResponse(response, ['dueSoonBills', 'upcomingBills'], 0)
  const paidAmount = extractNumberFromApiResponse(response, ['paidAmount'], 0)
  const unpaidAmount = extractNumberFromApiResponse(response, ['unpaidAmount'], 0)

  return {
    totalBills,
    totalAmount,
    paidBills,
    unpaidBills,
    overdueBills,
    dueSoonBills,
    paidAmount,
    unpaidAmount,
  }
}

export const extractPaginationMeta = (response: unknown) => {
  const dataNode = getApiDataNode(response)
  if (!isRecord(dataNode)) {
    return {
      totalPages: 1,
      totalItems: 0,
    }
  }

  return {
    totalPages: toNumber(dataNode.totalPages, 1),
    totalItems: toNumber(dataNode.totalItems, 0),
  }
}

export const extractItemsCount = (response: unknown): number => {
  const dataNode = getApiDataNode(response)
  if (Array.isArray(dataNode)) return dataNode.length

  const fromKeys = extractNumberFromApiResponse(response, ['count', 'total', 'totalItems', 'overdueCount', 'upcomingCount'], -1)
  if (fromKeys >= 0) return fromKeys

  const items = extractArrayFromApiResponse<unknown>(response, ['items', 'bills'])
  return items.length
}
