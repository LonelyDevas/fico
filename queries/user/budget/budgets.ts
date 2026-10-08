// /api/v1/budget routes

import { axiosInstance } from "@/utils/axios-instance";
import { supabase } from "@/utils/supabase-client";
import { toCamelCase } from "@/utils/case-transform";
import { handleApiError } from "@/utils/error-handler";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CreateBudgetData,
  UpdateBudgetData,
  ListBudgetsParams,
  CurrentBudgetsParams,
  BudgetStatusParams,
} from "@/types/budget";

const isSupabase = () => process.env.NEXT_PUBLIC_BACKEND === 'supabase';

// Every budget screen reads one of these. Matching by prefix means a list loaded with any
// parameters is refreshed, not just one with the exact same ones.
const BUDGET_KEYS = ['budgets', 'current-budgets', 'budget-status', 'budget-summary', 'budget-performance', 'budget-suggestions'];
const useRefreshBudgets = () => {
  const queryClient = useQueryClient();
  return () => Promise.all(BUDGET_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
};

// Create Budget — end_date default-calculation lives server-side (RPC) to
// keep it consistent regardless of caller.
const createBudget = async (data: CreateBudgetData) => {
  if (isSupabase()) {
    const { data: row, error } = await supabase.rpc('budgets_create', {
      p_name: data.name,
      p_amount: data.amount,
      p_period: data.period,
      p_start_date: data.startDate,
      p_category_ids: data.categoryIds ?? (data.categoryId ? [data.categoryId] : []),
      p_end_date: data.endDate ?? null,
      p_alert_threshold: data.alertThreshold ?? 80,
    });
    if (error) throw error;
    return { message: 'success', data: toCamelCase(row) };
  }
  const response = await axiosInstance.post("/budget/create", data);
  return response.data;
};

export const useCreateBudget = () => {
  const refreshBudgets = useRefreshBudgets();
  return useMutation({
    onSuccess: refreshBudgets,
    mutationFn: (data: CreateBudgetData) => createBudget(data),
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// List Budgets — recomputes `spent` from transactions on every read (and
// flips status to 'exceeded'), so this is an RPC, not a direct select.
const listBudgets = async (params: ListBudgetsParams) => {
  if (isSupabase()) {
    const { data, error } = await supabase.rpc('budgets_list', {
      p_page: params.page ? parseInt(params.page) : 0,
      p_limit: params.limit ? parseInt(params.limit) : 20,
      p_category_id: params.categoryId ?? null,
      p_period: params.period ?? null,
      p_status: params.status ?? 'active',
    });
    if (error) throw error;
    return { message: 'success', data: toCamelCase(data) };
  }
  const response = await axiosInstance.get("/budget/list", { params });
  return response.data;
};

export const useListBudgets = (params?: ListBudgetsParams) => {
  return useQuery({
    queryKey: ["budgets", params],
    queryFn: () => listBudgets(params || {}),
    enabled: true,
  });
};

// Update Budget — plain field edit, no recompute, direct client call.
const updateBudget = async (data: UpdateBudgetData) => {
  if (isSupabase()) {
    const { id, ...rest } = data;
    const { error } = await supabase
      .from('budgets')
      .update({
        ...(rest.categoryIds ? { category_ids: rest.categoryIds, category_id: rest.categoryIds[0] ?? null } : {}),
        name: rest.name,
        amount: rest.amount,
        period: rest.period,
        start_date: rest.startDate,
        end_date: rest.endDate,
        alert_threshold: rest.alertThreshold,
        status: rest.status,
      })
      .eq('id', id);
    if (error) throw error;
    return { message: 'success' };
  }
  const response = await axiosInstance.post("/budget/update", data);
  return response.data;
};

export const useUpdateBudget = () => {
  const refreshBudgets = useRefreshBudgets();
  return useMutation({
    onSuccess: refreshBudgets,
    mutationFn: (data: UpdateBudgetData) => updateBudget(data),
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// Get Current Budgets
const getCurrentBudgets = async (params: CurrentBudgetsParams) => {
  if (isSupabase()) {
    const { data, error } = await supabase.rpc('budgets_get_current', { p_period: params.period ?? null });
    if (error) throw error;
    return { message: 'success', data: toCamelCase(data) };
  }
  const response = await axiosInstance.get("/budget/current", { params });
  return response.data;
};

export const useCurrentBudgets = (params?: CurrentBudgetsParams) => {
  return useQuery({
    queryKey: ["current-budgets", params],
    queryFn: () => getCurrentBudgets(params || {}),
    enabled: true,
  });
};

// Check Budget Status
const checkBudgetStatus = async (params: BudgetStatusParams) => {
  if (isSupabase()) {
    const { data, error } = await supabase.rpc('budgets_check_status', { p_id: params.id });
    if (error) throw error;
    return { message: 'success', data: toCamelCase(data) };
  }
  const response = await axiosInstance.get("/budget/status", { params });
  return response.data;
};

export const useBudgetStatus = (params?: BudgetStatusParams) => {
  return useQuery({
    queryKey: ["budget-status", params],
    queryFn: () => checkBudgetStatus(params || { id: "" }),
    enabled: !!params?.id,
  });
};

// Get Budget Summary
const getBudgetSummary = async () => {
  if (isSupabase()) {
    const { data, error } = await supabase.rpc('budgets_summary');
    if (error) throw error;
    return { message: 'success', data: toCamelCase(data) };
  }
  const response = await axiosInstance.get("/budget/summary");
  return response.data;
};

export const useBudgetSummary = () => {
  return useQuery({
    queryKey: ["budget-summary"],
    queryFn: () => getBudgetSummary(),
    enabled: true,
  });
};

const getPerformance = async () => {
  if (isSupabase()) {
    const { data, error } = await supabase.rpc('budgets_performance');
    if (error) throw error;
    return { message: 'success', data: toCamelCase(data) };
  }
  const response = await axiosInstance.get("/budget/performance");
  return response.data;
}

export const useBudgetPerformance = () => {
  return useQuery({
    queryKey: ["budget-performance"],
    queryFn: () => getPerformance(),
    enabled: true,
  });
}

const getSuggestions = async () => {
  if (isSupabase()) {
    const { data, error } = await supabase.rpc('budgets_suggestions');
    if (error) throw error;
    return { message: 'success', data: toCamelCase(data) };
  }
  const response = await axiosInstance.get("/budget/suggestions");
  return response.data;
}

export const useBudgetSuggestions = () => {
  return useQuery({
    queryKey: ["budget-suggestions"],
    queryFn: () => getSuggestions(),
    enabled: true,
  });
}

export const rolloverBudget = async (id: string) => {
  if (isSupabase()) {
    const { data, error } = await supabase.rpc('budgets_rollover', { p_budget_id: id });
    if (error) throw error;
    return { message: 'success', data: toCamelCase(data) };
  }
  const response = await axiosInstance.post("/budget/rollover", { id });
  return response.data;
}

export const useRolloverBudget = () => {
  const refreshBudgets = useRefreshBudgets();
  return useMutation({
    onSuccess: refreshBudgets,
    mutationFn: (id: string) => rolloverBudget(id),
    onError: (error) => {
      handleApiError(error);
    },
  });
}
