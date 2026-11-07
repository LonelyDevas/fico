// /api/v1/transaction routes

import { axiosInstance, axiosInstanceFormData } from "@/utils/axios-instance";
import { supabase } from "@/utils/supabase-client";
import { toCamelCase } from "@/utils/case-transform";
import { parseImportCsv } from "@/utils/import-csv";
import { ruleFromRow } from "@/queries/user/rule/rules";
import { handleApiError } from "@/utils/error-handler";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CreateTransactionData,
  ListTransactionsParams,
  UpdateTransactionData,
  DeleteTransactionData,
  GetMonthlyReportParams,
  GetCategoryBreakdownParams,
  ImportTransactionsData,
  SetAffectsBalanceRangeData,
  WalletReconcileRow,
  transactionsSummaryParams,
  quickStatsTransactionParams,
} from "@/types/transaction";
import { buildCategoryBreakdown, buildChartData, buildQuickStats, fetchRangeRows, isShiftablePeriod } from "./period-range";

const isSupabase = () => process.env.NEXT_PUBLIC_BACKEND === 'supabase';

// True when a report is for a past period (offset < 0), which the reports_* RPCs can't do.
const isPastPeriod = (params?: quickStatsTransactionParams) =>
  isSupabase() && !!params?.offset && params.offset < 0 && isShiftablePeriod(params.period);

// Charts and the category split are bucketed on the device for every day/week/month/year, the current
// one included: the RPCs bucket in the database's time zone (UTC) and number weekdays from Sunday, so a
// tapped bar or slice would not match the transactions listed for it in local time.
const isLocalBucketed = (params?: quickStatsTransactionParams) =>
  isSupabase() && !!params && isShiftablePeriod(params.period) && (params.offset ?? 0) <= 0;

// Shared by any mutation that can move a wallet balance (create/update/delete
// transaction) — without this, wallet balances and dashboard stats stay
// stale in every screen except the one that happens to call its own refetch.
export const invalidateTransactionAndWalletQueries = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: ["wallets"] });
  queryClient.invalidateQueries({ queryKey: ["wallet"] });
  queryClient.invalidateQueries({ queryKey: ["wallet-total-balance"] });
  queryClient.invalidateQueries({ queryKey: ["transactions"] });
  queryClient.invalidateQueries({ queryKey: ["transactions-summary"] });
  queryClient.invalidateQueries({ queryKey: ["transaction-monthly-report"] });
  queryClient.invalidateQueries({ queryKey: ["transaction-category-breakdown"] });
  queryClient.invalidateQueries({ queryKey: ["transactions-quick-stats"] });
  queryClient.invalidateQueries({ queryKey: ["transaction-chart-data"] });
  queryClient.invalidateQueries({ queryKey: ["transaction-top-categories"] });
  queryClient.invalidateQueries({ queryKey: ["transactions-spent-today"] });
  queryClient.invalidateQueries({ queryKey: ["transactions-top-category-today"] });
  // Budgets total up transactions, so any add, edit or delete changes them.
  for (const key of ["budgets", "current-budgets", "budget-summary", "budget-performance"]) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
};

// Create Transaction — balance mutation + optional bill linkage, so this
// goes through the transactions_create RPC (layer (b)), not a direct insert.
export const createTransaction = async (data: CreateTransactionData & { createBillForFee?: boolean }) => {
  if (isSupabase()) {
    const { data: row, error } = await supabase.rpc('transactions_create', {
      p_wallet_id: data.walletId,
      p_amount: data.amount,
      p_type: data.type,
      p_category_id: data.categoryId ?? null,
      p_description: data.description ?? null,
      p_date: data.date ?? new Date().toISOString(),
      p_attachments: data.attachments ?? [],
      p_tags: data.tags ?? [],
      p_to_wallet_id: data.toWalletId ?? null,
      p_bill_id: data.billId ?? null,
      p_service_fee: data.serviceFee ?? 0,
      p_create_bill_for_fee: data.createBillForFee ?? false,
      p_affects_balance: data.affectsBalance ?? true,
    });
    if (error) throw error;
    return { message: 'success', data: toCamelCase(row) };
  }
  const response = await axiosInstance.post("/transaction/create", data);
  return response.data;
};

export const useCreateTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createTransaction>[0]) => createTransaction(data),
    onSuccess: () => {
      invalidateTransactionAndWalletQueries(queryClient);
    },
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// List Transactions — simple filtered read, direct client call.
const listTransactions = async (params: ListTransactionsParams) => {
  if (isSupabase()) {
    const page = parseInt(params.page ?? '0') || 0;
    const limit = parseInt(params.limit ?? '20') || 20;
    let query = supabase
      .from('transactions')
      .select('*, wallet:wallets!transactions_wallet_id_fkey(name,type,currency), category:categories(name,type,icon,color), to_wallet:wallets!transactions_to_wallet_id_fkey(name,type,currency)', { count: 'exact' })
      .eq('status', params.status ?? 'completed');
    if (params.walletId) query = query.eq('wallet_id', params.walletId);
    // 'none' = uncategorized income and expenses (transfers never carry a category).
    if (params.categoryId === 'none') query = query.is('category_id', null).neq('type', 'transfer');
    else if (params.categoryId) query = query.eq('category_id', params.categoryId);
    if (params.type) query = query.eq('type', params.type);
    if (params.startDate) query = query.gte('date', params.startDate);
    if (params.endDate) query = query.lte('date', params.endDate);
    if (params.minAmount) query = query.gte('amount', parseFloat(params.minAmount));
    if (params.maxAmount) query = query.lte('amount', parseFloat(params.maxAmount));
    if (params.search) query = query.ilike('description', `%${params.search}%`);
    if (params.tags?.length) query = query.overlaps('tags', params.tags);

    const { data, count, error } = await query
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(page * limit, page * limit + limit - 1);
    if (error) throw error;
    return {
      message: 'success',
      data: {
        items: toCamelCase(data ?? []),
        totalPages: Math.ceil((count ?? 0) / limit),
        currentPage: page,
        totalItems: count ?? 0,
      },
    };
  }
  const response = await axiosInstance.get("/transaction/list", { params });
  return response.data;
};

export const useListTransactions = (params?: ListTransactionsParams, enabled = true) => {
  return useQuery({
    queryKey: ["transactions", params],
    queryFn: () => listTransactions(params || {}),
    enabled,
  });
};

// The Activity list, one page at a time. Kept as one infinite query so a new, edited or deleted
// transaction refetches every loaded page together: with each page as its own query, scrolling
// past the first page left it inactive, so a new transaction never showed until a reload.
export const useInfiniteTransactions = (params: Omit<ListTransactionsParams, 'page'>, enabled = true) => {
  return useInfiniteQuery({
    enabled,
    queryKey: ["transactions", "infinite", params],
    queryFn: ({ pageParam }) => listTransactions({ ...params, page: String(pageParam) }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      allPages.length < (lastPage?.data?.totalPages ?? 0) ? allPages.length : undefined,
  });
};

// Update Transaction — any field, including amount, type, wallets and the "don't change wallet
// balance" flag. transactions_update (fico-api 0061) moves wallets by the difference between the
// old and new row, and not at all while the flag is off.
export const updateTransaction = async (data: UpdateTransactionData) => {
  if (isSupabase()) {
    const { data: row, error } = await supabase.rpc('transactions_update', {
      p_id: data.id,
      p_category_id: data.categoryId ?? null,
      p_description: data.description ?? null,
      p_date: data.date ?? null,
      p_attachments: data.attachments ?? null,
      p_tags: data.tags ?? null,
      p_status: data.status ?? null,
      p_exclude_from_baseline: data.excludeFromBaseline ?? null,
      p_amount: data.amount ?? null,
      p_type: data.type ?? null,
      p_wallet_id: data.walletId ?? null,
      p_to_wallet_id: data.toWalletId ?? null,
      p_affects_balance: data.affectsBalance ?? null,
    });
    if (error) throw error;
    return { message: 'success', data: toCamelCase(row) };
  }
  const response = await axiosInstance.post("/transaction/update", data);
  return response.data;
};

export const useUpdateTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof updateTransaction>[0]) => updateTransaction(data),
    onSuccess: () => {
      invalidateTransactionAndWalletQueries(queryClient);
    },
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// Delete Transaction — reverses wallet balance math, must be atomic (RPC).
export const deleteTransaction = async (data: { id: string }) => {
  if (isSupabase()) {
    const { error } = await supabase.rpc('transactions_delete', { p_id: data.id });
    if (error) throw error;
    return { message: 'success' };
  }
  const response = await axiosInstance.post("/transaction/delete", data);
  return response.data;
};

export const useDeleteTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof deleteTransaction>[0]) => deleteTransaction(data),
    onSuccess: () => {
      invalidateTransactionAndWalletQueries(queryClient);
    },
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// Bulk "don't change wallet balance": sets the flag on every transaction in a date range.
const startOfDay = (day: string) => new Date(`${day}T00:00:00`).toISOString()
const endOfDay = (day: string) => new Date(`${day}T23:59:59.999`).toISOString()

/** How many transactions in the range would switch, for the confirmation line. */
const countAffectsBalanceRange = async (data: SetAffectsBalanceRangeData) => {
  let query = supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .gte('date', startOfDay(data.startDate))
    .lte('date', endOfDay(data.endDate))
    .eq('affects_balance', !data.affectsBalance)
  if (data.walletId) query = query.or(`wallet_id.eq.${data.walletId},to_wallet_id.eq.${data.walletId}`)
  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

export const useAffectsBalanceRangeCount = (data: SetAffectsBalanceRangeData | null) => {
  return useQuery({
    queryKey: ["transactions", "affects-balance-count", data],
    queryFn: () => countAffectsBalanceRange(data!),
    enabled: !!data && !!data.startDate && !!data.endDate && data.startDate <= data.endDate,
  })
}

const setAffectsBalanceRange = async (data: SetAffectsBalanceRangeData) => {
  const { data: result, error } = await supabase.rpc('transactions_set_affects_balance', {
    p_start: startOfDay(data.startDate),
    p_end: endOfDay(data.endDate),
    p_affects_balance: data.affectsBalance,
    p_wallet_id: data.walletId ?? null,
    p_adjust_balances: data.adjustBalances ?? false,
  })
  if (error) throw error
  return { message: 'success', data: toCamelCase(result) as { updated: number; balancesAdjusted: boolean } }
}

export const useSetAffectsBalanceRange = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: SetAffectsBalanceRangeData) => setAffectsBalanceRange(data),
    onSuccess: () => {
      invalidateTransactionAndWalletQueries(queryClient)
    },
    onError: (error) => {
      handleApiError(error)
    },
  })
}

// Reconcile: each wallet's stored balance next to the sum of its balance-affecting transactions.
// Keyed under "wallets" so every transaction or wallet change refreshes it.
const reconcileWallets = async (): Promise<WalletReconcileRow[]> => {
  const { data, error } = await supabase.rpc('wallets_reconcile')
  if (error) throw error
  return (toCamelCase(data ?? []) as WalletReconcileRow[]).map((row) => ({
    ...row,
    storedBalance: Number(row.storedBalance),
    transactionBalance: Number(row.transactionBalance),
    difference: Number(row.difference),
  }))
}

export const useReconcileWallets = (enabled = true) => {
  return useQuery({
    queryKey: ["wallets", "reconcile"],
    queryFn: reconcileWallets,
    enabled,
  })
}

// Get Monthly Report
const getMonthlyReport = async (params: GetMonthlyReportParams) => {
  if (isSupabase()) {
    const { data, error } = await supabase.rpc('reports_monthly', {
      p_month: params.month ? parseInt(params.month) : null,
      p_year: params.year ? parseInt(params.year) : null,
      p_wallet_id: params.walletId ?? null,
    });
    if (error) throw error;
    return { message: 'success', data: toCamelCase(data) };
  }
  const response = await axiosInstance.get("/transaction/report/monthly", { params });
  return response.data;
};

export const useMonthlyReport = (params?: GetMonthlyReportParams) => {
  return useQuery({
    queryKey: ["transaction-monthly-report", params],
    queryFn: () => getMonthlyReport(params || {}),
    enabled: true,
  });
};

// Get Category Breakdown
const getCategoryBreakdown = async (params: GetCategoryBreakdownParams & { period?: string }) => {
  if (isSupabase()) {
    const { data, error } = await supabase.rpc('reports_category_breakdown', {
      p_type: params.type,
      p_period: params.period ?? null,
      p_start: params.startDate ?? null,
      p_end: params.endDate ?? null,
      p_wallet_id: params.walletId ?? null,
    });
    if (error) throw error;
    return { message: 'success', data: toCamelCase(data) };
  }
  const response = await axiosInstance.get("/transaction/report/category", { params });
  return response.data;
};

export const useCategoryBreakdown = (params?: GetCategoryBreakdownParams) => {
  return useQuery({
    queryKey: ["transaction-category-breakdown", params],
    queryFn: () => getCategoryBreakdown(params || { type: 'expense' }),
    enabled: true,
  });
};

// Import Transactions — the CSV is parsed on the device (utils/import-csv.ts) and the rows go
// through the transactions_bulk_import RPC, so importing also works offline and syncs later.
const importTransactions = async (data: ImportTransactionsData) => {
  if (isSupabase()) {
    const preview = data.preview === true || data.preview === 'true';
    const { data: categories } = await supabase.from('categories').select('id, name');
    // The user's categorization rules fill rows the file leaves without a category (none if the table isn't there yet).
    const { data: ruleRows } = await supabase.from('rules').select('*');
    const rules = (ruleRows ?? []).map(ruleFromRow);
    const { totalRows, valid, skipped } = parseImportCsv(await data.file.text(), categories ?? [], data.categoryId, rules);

    if (preview) {
      return {
        message: 'success',
        data: { totalRows, willImport: valid.length, willSkip: skipped.length, skippedRows: skipped, preview: valid },
      };
    }
    if (valid.length === 0) {
      return {
        message: 'success',
        data: { message: 'No valid transactions found to import.', totalRows, imported: 0, skipped: skipped.length, skippedRows: skipped },
      };
    }

    const { data: result, error } = await supabase.rpc('transactions_bulk_import', {
      p_wallet_id: data.walletId,
      p_rows: valid,
    });
    if (error) throw error;
    return {
      message: 'success',
      data: {
        message: `Successfully imported ${valid.length} transaction${valid.length !== 1 ? 's' : ''}.`,
        totalRows,
        imported: result?.imported ?? valid.length,
        skipped: skipped.length,
        skippedRows: skipped,
      },
    };
  }
  const response = await axiosInstanceFormData.post("/transaction/import", data);
  return response.data;
};

export const useImportTransactions = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof importTransactions>[0]) => importTransactions(data),
    onSuccess: () => {
      invalidateTransactionAndWalletQueries(queryClient);
    },
    onError: (error) => {
      handleApiError(error);
    },
  });
};

const getSummary = async (params: transactionsSummaryParams) => {
  if (isSupabase()) {
    const { data, error } = await supabase.rpc('reports_dashboard_summary', {
      p_month: params.month ? parseInt(params.month) : null,
      p_year: params.year ? parseInt(params.year) : null,
      p_wallet_id: params.walletId ?? null,
    });
    if (error) throw error;
    return { message: 'success', data: toCamelCase(data) };
  }
  const response = await axiosInstance.get("/transaction/summary", { params });
  return response.data;
};

export const useTransactionsSummary = (params?: transactionsSummaryParams) => {
  return useQuery({
    queryKey: ["transactions-summary", params],
    queryFn: () => getSummary(params || {}),
    enabled: true,
  });
};

const getQuickStats = async (params: quickStatsTransactionParams) => {
  if (isPastPeriod(params)) {
    const rows = await fetchRangeRows(params.period as any, params.offset!, params.walletId);
    return { message: 'success', data: buildQuickStats(rows, params.period as any, params.offset!) };
  }
  if (isSupabase()) {
    const { data, error } = await supabase.rpc('reports_quick_stats', {
      p_period: params.period,
      p_wallet_id: params.walletId ?? null,
    });
    if (error) throw error;
    return { message: 'success', data: toCamelCase(data) };
  }
  const response = await axiosInstance.get("/transaction/quick-stats", { params });
  return response.data;
};

export const useQuickStats = (params?: quickStatsTransactionParams) => {
  return useQuery({
    queryKey: ["transactions-quick-stats", params],
    queryFn: () => getQuickStats(params || { period: 'month' }),
    enabled: true,
  });
};

const getTransactionTags = async () => {
  if (isSupabase()) {
    const { data, error } = await supabase.rpc('transactions_all_tags');
    if (error) throw error;
    return { message: 'success', data: toCamelCase(data) };
  }
  const response = await axiosInstance.get("/transaction/tags");
  return response.data;
};

export const useTransactionTags = () => {
  return useQuery({
    queryKey: ["transaction-tags"],
    queryFn: () => getTransactionTags(),
    enabled: true,
  });
};

const getChartData = async (params?: quickStatsTransactionParams) => {
  if (params && isLocalBucketed(params)) {
    const rows = await fetchRangeRows(params.period as any, params.offset ?? 0, params.walletId);
    return { message: 'success', data: buildChartData(rows, params.period as any, params.offset ?? 0) };
  }
  if (isSupabase()) {
    const { data, error } = await supabase.rpc('reports_chart_data', {
      p_period: params?.period ?? 'month',
      p_wallet_id: params?.walletId ?? null,
    });
    if (error) throw error;
    return { message: 'success', data: toCamelCase(data) };
  }
  const response = await axiosInstance.get("/transaction/chart-data", { params });
  return response.data;
};

export const useTransactionChartData = (params?: quickStatsTransactionParams) => {
  return useQuery({
    queryKey: ["transaction-chart-data", params],
    queryFn: () => getChartData(params || { period: 'month' }),
    enabled: true,
  });
};

export const getTopCategories = async (params?: quickStatsTransactionParams) => {
  if (params && isLocalBucketed(params)) {
    const rows = await fetchRangeRows(params.period as any, params.offset ?? 0, params.walletId);
    return { message: 'success', data: buildCategoryBreakdown(rows, params.type ?? 'expense') };
  }
  if (isSupabase()) {
    const { data, error } = await supabase.rpc('reports_category_breakdown', {
      p_type: params?.type ?? 'expense',
      p_period: params?.period ?? 'month',
      p_start: null,
      p_end: null,
      p_wallet_id: params?.walletId ?? null,
    });
    if (error) throw error;
    return { message: 'success', data: toCamelCase(data) };
  }
  const response = await axiosInstance.get("/transaction/report/category", { params });
  return response.data;
};

export const useTopCategories = (params?: quickStatsTransactionParams) => {
  return useQuery({
    queryKey: ["transaction-top-categories", params],
    queryFn: () => getTopCategories(params || { period: 'month', type: 'expense' }),
    enabled: true,
  });
};

// Spent Today + AI top-category insight — the latter calls the
// finance-insight Edge Function (Groq API call can't live in Postgres).
const getSpentToday = async (walletId?: string) => {
  if (isSupabase()) {
    const { data, error } = await supabase.rpc('transactions_spent_today', { p_wallet_id: walletId ?? null });
    if (error) throw error;
    return { message: 'success', data: toCamelCase(data) };
  }
  const response = await axiosInstance.get("/transaction/spent-today", { params: { walletId } });
  return response.data;
};

export const useSpentToday = (walletId?: string) => {
  return useQuery({
    queryKey: ["transactions-spent-today", walletId],
    queryFn: () => getSpentToday(walletId),
    enabled: true,
  });
};

const getTopCategoryToday = async (walletId?: string) => {
  if (isSupabase()) {
    const { data, error } = await supabase.functions.invoke('finance-insight', {
      body: { walletId: walletId ?? null },
    });
    if (error) throw error;
    return { message: 'success', data: toCamelCase(data) };
  }
  const response = await axiosInstance.get("/transaction/top-category-today", { params: { walletId } });
  return response.data;
};

export const useTopCategoryToday = (walletId?: string) => {
  return useQuery({
    queryKey: ["transactions-top-category-today", walletId],
    queryFn: () => getTopCategoryToday(walletId),
    enabled: true,
  });
};

// Sorting inbox: plain row updates that never move a wallet balance (no rebalance RPC), so they also
// work offline. Setting the category only labels the row; "already in my balance" only flags it.
const triageUpdate = async ({ id, patch }: { id: string; patch: { category_id?: string | null; affects_balance?: boolean } }) => {
  if (!isSupabase()) throw new Error('Sorting needs the Supabase backend.');
  const { error } = await supabase.from('transactions').update(patch).eq('id', id);
  if (error) throw error;
};

export const useTriageTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: triageUpdate,
    onSuccess: () => invalidateTransactionAndWalletQueries(queryClient),
    onError: (error) => handleApiError(error),
  });
};
