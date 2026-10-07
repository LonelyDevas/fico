import { wallet } from "ionicons/icons";

export type TransactionType = 'income' | 'expense' | 'transfer';

export type TransactionStatus = 'completed' | 'pending' | 'cancelled';

export type CreateTransactionData = {
  walletId: string;
  categoryId?: string;
  amount: number;
  type: TransactionType;
  description?: string;
  date?: string;
  attachments?: string[];
  tags?: string[];
  toWalletId?: string;
  billId?: string;
  serviceFee?: number;
};

export type ListTransactionsParams = {
  page?: string;
  limit?: string;
  walletId?: string;
  categoryId?: string;
  type?: TransactionType;
  startDate?: string;
  endDate?: string;
  minAmount?: string;
  maxAmount?: string;
  search?: string;
  status?: TransactionStatus;
  tags?: string[];
};

export type UpdateTransactionData = {
  id: string;
  walletId?: string;
  categoryId?: string;
  amount?: number;
  type?: TransactionType;
  description?: string;
  date?: string;
  attachments?: string[];
  tags?: string[];
  status?: TransactionStatus;
};

export type DeleteTransactionData = {
  id: string;
};

export type GetMonthlyReportParams = {
  month?: string;
  year?: string;
  walletId?: string;
  categoryId?: string;
};

export type GetCategoryBreakdownParams = {
  type: TransactionType;
  startDate?: string;
  endDate?: string;
  walletId?: string;
};

export type ImportTransactionsData = {
  file: File;
  walletId: string;
  categoryId?: string;
  preview?: string | boolean;
}

export type transactionsSummaryParams = {
  month?: string;
  year?: string;
  walletId?: string;
}

export type quickStatsTransactionParams = {
  period: string; // today, week, month, year, all
  /** Steps back (negative) from the current period; Supabase backend only. */
  offset?: number;
  walletId?: string;
  type?: TransactionType;
}