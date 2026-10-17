export type BillType = 'bill' | 'income';
export type BillStatus = 'active' | 'archived';
export type RecurringFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';
export type PaymentStatus = 'paid' | 'unpaid' | 'overdue' | 'partial' | 'received';

export type Bill = {
  id: string;
  type: BillType;
  name: string;
  amount: number;
  categoryId?: string;
  category?: {
    _id: string;
    name: string;
    type: string;
    icon?: string;
    color?: string;
  };
  dueDate: string;
  isRecurring: boolean;
  recurringFrequency?: RecurringFrequency;
  walletId?: string;
  wallet?: {
    _id: string;
    name: string;
    type: string;
  };
  reminder?: boolean;
  reminderDays?: number;
  notes?: string;
  status: BillStatus;
  paymentStatus: PaymentStatus;
  paidAmount?: number;
  paidDate?: string;
  absenceDeduction?: number;
};

export type BillSummary = {
  totalBills: number;
  totalAmount: number;
  paidBills: number;
  unpaidBills: number;
  overdueBills: number;
  dueSoonBills: number;
  paidAmount: number;
  unpaidAmount: number;
};

export type CreateBillData = {
  name: string;
  amount: number;
  type?: BillType;
  categoryId?: string;
  dueDate: string;
  isRecurring: boolean;
  recurringFrequency?: RecurringFrequency;
  walletId?: string;
  reminder?: boolean;
  reminderDays?: number;
  notes?: string;
  absenceDeduction?: number;
};

export type UpdateBillData = {
  id: string;
  name?: string;
  amount?: number;
  type?: BillType;
  categoryId?: string;
  walletId?: string;
  dueDate?: string;
  isRecurring?: boolean;
  recurringFrequency?: RecurringFrequency;
  reminder?: boolean;
  reminderDays?: number;
  notes?: string;
  status?: BillStatus;
  absenceDeduction?: number;
};

export type MarkPaidData = {
  id: string;
  paidAmount?: number;
  paidDate?: string;
  walletId?: string;
  createTransaction?: boolean;
  idempotencyKey?: string;
};

export type MarkUnpaidData = {
  id: string;
};

export type ListBillsParams = {
  page?: string;
  limit?: string;
  type?: BillType;
  paymentStatus?: PaymentStatus;
  isRecurring?: string;
  startDate?: string;
  endDate?: string;
  status?: BillStatus;
};

export type UpcomingBillsParams = {
  days?: string;
};

export type BillCalendarParams = {
  month?: string; // Format: YYYY-MM
  year?: string; // Format: YYYY
  startDate?: string; // Format: YYYY-MM-DD
  endDate?: string; // Format: YYYY-MM-DD
};
