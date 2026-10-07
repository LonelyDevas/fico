// /api/v1/bill routes

import { axiosInstance } from "@/utils/axios-instance";
import { supabase } from "@/utils/supabase-client";
import { toCamelCase } from "@/utils/case-transform";
import { handleApiError } from "@/utils/error-handler";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CreateBillData,
  UpdateBillData,
  MarkPaidData,
  MarkUnpaidData,
  ListBillsParams,
  UpcomingBillsParams,
  BillCalendarParams,
} from "@/types/bill";

const isSupabase = () => process.env.NEXT_PUBLIC_BACKEND === 'supabase';

// Create Bill — auto-creates a linked pending transaction when a wallet is
// given, so this goes through the bills_create RPC (layer (b)).
const createBill = async (data: CreateBillData) => {
  if (isSupabase()) {
    const { data: row, error } = await supabase.rpc('bills_create', {
      p_name: data.name,
      p_amount: data.amount,
      p_due_date: data.dueDate,
      p_is_recurring: data.isRecurring,
      p_type: data.type ?? 'bill',
      p_category_id: data.categoryId ?? null,
      p_recurring_frequency: data.recurringFrequency ?? null,
      p_wallet_id: data.walletId ?? null,
      p_reminder: data.reminder ?? true,
      p_reminder_days: data.reminderDays ?? 3,
      p_notes: data.notes ?? null,
    });
    if (error) throw error;
    return { message: 'success', data: toCamelCase(row) };
  }
  const response = await axiosInstance.post("/bill/create", data);
  return response.data;
};

export const useCreateBill = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBillData) => createBill(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["bill-summary"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-bills"] });
      queryClient.invalidateQueries({ queryKey: ["overdue-bills"] });
    },
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// List Bills — simple filtered read, direct client call.
const listBills = async (params: ListBillsParams) => {
  if (isSupabase()) {
    const page = parseInt(params.page ?? '0') || 0;
    const limit = parseInt(params.limit ?? '20') || 20;
    let query = supabase
      .from('bills')
      .select('*, category:categories(name,type,icon,color), wallet:wallets!bills_wallet_id_fkey(name,type)', { count: 'exact' })
      .eq('status', params.status ?? 'active');
    if (params.type) query = query.eq('type', params.type);
    if (params.paymentStatus) query = query.eq('payment_status', params.paymentStatus);
    if (params.isRecurring) query = query.eq('is_recurring', params.isRecurring === 'true');
    if (params.startDate) query = query.gte('due_date', params.startDate);
    if (params.endDate) query = query.lte('due_date', params.endDate);

    const { data, count, error } = await query
      .order('due_date', { ascending: true })
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
  const response = await axiosInstance.get("/bill/list", { params });
  return response.data;
};

export const useListBills = (params?: ListBillsParams) => {
  return useQuery({
    queryKey: ["bills", params],
    queryFn: () => listBills(params || {}),
    enabled: true,
  });
};

// Update Bill — single-table, no side effects.
const updateBill = async (data: UpdateBillData) => {
  if (isSupabase()) {
    const { id, ...rest } = data;
    const { error } = await supabase
      .from('bills')
      .update({
        name: rest.name,
        amount: rest.amount,
        type: rest.type,
        category_id: rest.categoryId,
        wallet_id: rest.walletId,
        due_date: rest.dueDate,
        is_recurring: rest.isRecurring,
        recurring_frequency: rest.recurringFrequency,
        reminder: rest.reminder,
        reminder_days: rest.reminderDays,
        notes: rest.notes,
        status: rest.status,
      })
      .eq('id', id);
    if (error) throw error;
    return { message: 'success' };
  }
  const response = await axiosInstance.post("/bill/update", data);
  return response.data;
};

export const useUpdateBill = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateBillData) => updateBill(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["bill-summary"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-bills"] });
      queryClient.invalidateQueries({ queryKey: ["overdue-bills"] });
    },
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// Mark Bill as Paid — the most involved bill operation (wallet debit,
// linked-transaction completion, obligation back-update, recurrence);
// always the bills_mark_paid RPC.
const markPaid = async (data: MarkPaidData) => {
  if (isSupabase()) {
    const { data: result, error } = await supabase.rpc('bills_mark_paid', {
      p_id: data.id,
      p_paid_amount: data.paidAmount ?? null,
      p_paid_date: data.paidDate ?? null,
      p_idempotency_key: data.idempotencyKey ?? null,
    });
    if (error) throw error;
    return { message: 'success', data: toCamelCase(result) };
  }
  const response = await axiosInstance.post("/bill/mark-paid", data);
  return response.data;
};

export const useMarkBillPaid = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: MarkPaidData) => markPaid(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["bill-calendar"] });
      queryClient.invalidateQueries({ queryKey: ["bill-summary"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-bills"] });
      queryClient.invalidateQueries({ queryKey: ["overdue-bills"] });
    },
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// Mark Bill as Unpaid — single-table reset, direct client call.
const markUnpaid = async (data: MarkUnpaidData) => {
  if (isSupabase()) {
    const { error } = await supabase
      .from('bills')
      .update({ payment_status: 'unpaid', paid_amount: 0, last_paid_date: null })
      .eq('id', data.id);
    if (error) throw error;
    return { message: 'success' };
  }
  const response = await axiosInstance.post("/bill/mark-unpaid", data);
  return response.data;
};

export const useMarkBillUnpaid = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: MarkUnpaidData) => markUnpaid(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["bill-summary"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-bills"] });
      queryClient.invalidateQueries({ queryKey: ["overdue-bills"] });
    },
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// Archive Bill
const archiveBill = async (data: { id: string }) => {
  if (isSupabase()) {
    const { error } = await supabase.from('bills').update({ status: 'archived' }).eq('id', data.id);
    if (error) throw error;
    return { message: 'success' };
  }
  const response = await axiosInstance.post("/bill/delete", data);
  return response.data;
};

export const useArchiveBill = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { id: string }) => archiveBill(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["bill-summary"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-bills"] });
      queryClient.invalidateQueries({ queryKey: ["overdue-bills"] });
    },
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// Get Upcoming Bills — simple filtered read.
const getUpcomingBills = async (params: UpcomingBillsParams) => {
  if (isSupabase()) {
    const daysAhead = params.days ? parseInt(params.days) : 7;
    const today = new Date();
    const future = new Date();
    future.setDate(today.getDate() + daysAhead);

    const { data, error } = await supabase
      .from('bills')
      .select('*, category:categories(name,type,icon,color), wallet:wallets!bills_wallet_id_fkey(name,type)')
      .eq('status', 'active')
      .in('payment_status', ['unpaid', 'partial'])
      .gte('due_date', today.toISOString())
      .lte('due_date', future.toISOString())
      .order('due_date', { ascending: true });
    if (error) throw error;
    return {
      message: 'success',
      data: { items: toCamelCase(data ?? []), totalUpcoming: data?.length ?? 0, daysAhead },
    };
  }
  const response = await axiosInstance.get("/bill/upcoming", { params });
  return response.data;
};

export const useUpcomingBills = (params?: UpcomingBillsParams) => {
  return useQuery({
    queryKey: ["upcoming-bills", params],
    queryFn: () => getUpcomingBills(params || {}),
    enabled: true,
  });
};

// Get Overdue Bills — also flips matching rows to 'overdue' (RPC side effect).
const getOverdueBills = async () => {
  if (isSupabase()) {
    const { data, error } = await supabase.rpc('bills_get_overdue');
    if (error) throw error;
    return { message: 'success', data: { items: toCamelCase(data ?? []), totalOverdue: data?.length ?? 0 } };
  }
  const response = await axiosInstance.get("/bill/overdue");
  return response.data;
};

export const useOverdueBills = () => {
  return useQuery({
    queryKey: ["overdue-bills"],
    queryFn: () => getOverdueBills(),
    enabled: true,
  });
};

// Get Bill Summary
const getBillSummary = async () => {
  if (isSupabase()) {
    const { data, error } = await supabase.rpc('bills_summary');
    if (error) throw error;
    return { message: 'success', data: toCamelCase(data) };
  }
  const response = await axiosInstance.get("/bill/summary");
  return response.data;
};

export const useBillSummary = () => {
  return useQuery({
    queryKey: ["bill-summary"],
    queryFn: () => getBillSummary(),
    enabled: true,
  });
};

// Get Bill Calendar — kept as a direct client read + in-app grouping
// (no cross-table side effects, unlike bills_get_overdue), mirroring the
// date-bucketing/color logic from bills.service.ts#getCalendar in TS.
const STATUS_COLORS: Record<string, string> = {
  unpaid: '#FF6B6B',
  paid: '#4ECDC4',
  overdue: '#FF5252',
  partial: '#95E1D3',
};

const getBillCalendar = async (params: BillCalendarParams) => {
  if (isSupabase()) {
    let start: Date, end: Date;
    if (params.startDate && params.endDate) {
      start = new Date(params.startDate);
      end = new Date(params.endDate);
      end.setHours(23, 59, 59, 999);
    } else if (params.month && params.year) {
      const monthNum = parseInt(params.month) - 1;
      const yearNum = parseInt(params.year);
      start = new Date(yearNum, monthNum, 1);
      end = new Date(yearNum, monthNum + 1, 0, 23, 59, 59, 999);
    } else {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    const { data, error } = await supabase
      .from('bills')
      .select('*, category:categories(name,color,type)')
      .eq('status', 'active')
      .gte('due_date', start.toISOString())
      .lte('due_date', end.toISOString());
    if (error) throw error;

    const calendarEvents: Record<string, any[]> = {};
    const datesWithBills = new Set<string>();
    const stats = {
      totalBillsInRange: 0, unpaidCount: 0, paidCount: 0, overdueCount: 0,
      totalAmountDue: 0, totalAmountPaid: 0,
    };

    for (const bill of data ?? []) {
      const dateKey = bill.due_date.slice(0, 10);
      datesWithBills.add(dateKey);

      let statusColor = STATUS_COLORS.unpaid;
      let statusLabel = bill.payment_status.charAt(0).toUpperCase() + bill.payment_status.slice(1);

      if (bill.payment_status === 'unpaid') {
        statusColor = STATUS_COLORS.unpaid;
        stats.unpaidCount++;
        stats.totalAmountDue += bill.amount ?? 0;
      } else if (bill.payment_status === 'paid') {
        statusColor = STATUS_COLORS.paid;
        stats.paidCount++;
        stats.totalAmountPaid += bill.amount ?? 0;
      } else if (bill.payment_status === 'overdue') {
        statusColor = STATUS_COLORS.overdue;
        stats.overdueCount++;
        stats.totalAmountDue += bill.amount ?? 0;
        statusLabel = 'Overdue';
      } else if (bill.payment_status === 'partial') {
        statusColor = STATUS_COLORS.partial;
        stats.unpaidCount++;
        stats.totalAmountDue += (bill.amount ?? 0) - (bill.paid_amount ?? 0);
      }
      stats.totalBillsInRange++;

      const event = toCamelCase({
        id: bill.id, name: bill.name, amount: bill.amount, dueDate: dateKey,
        paymentStatus: bill.payment_status, isRecurring: bill.is_recurring,
        recurringFrequency: bill.recurring_frequency,
        categoryName: bill.category?.name, categoryColor: bill.category?.color,
        reminder: bill.reminder, reminderDays: bill.reminder_days, notes: bill.notes,
        statusColor, statusLabel,
      });

      (calendarEvents[dateKey] ??= []).push(event);
    }

    Object.values(calendarEvents).forEach((events) => events.sort((a, b) => a.name.localeCompare(b.name)));

    return {
      message: 'success',
      data: {
        month: params.month, year: params.year,
        startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0],
        calendarEvents, statistics: stats,
        datesWithBills: Array.from(datesWithBills).sort(),
      },
    };
  }
  const response = await axiosInstance.get("/bill/calendar", { params });
  return response.data;
};

export const useBillCalendar = (params?: BillCalendarParams) => {
  return useQuery({
    queryKey: ["bill-calendar", params],
    queryFn: () => getBillCalendar(params || {}),
    enabled: true,
  });
}
