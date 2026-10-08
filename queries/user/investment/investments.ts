// /api/v1/investment routes — new query file (no prior frontend UI existed
// for this domain; the fico-api backend routes already existed, so the
// legacy path hits those directly for parity with every other domain here).

import { axiosInstance } from "@/utils/axios-instance";
import { supabase } from "@/utils/supabase-client";
import { toCamelCase } from "@/utils/case-transform";
import { handleApiError } from "@/utils/error-handler";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CreateInvestmentData,
  UpdateInvestmentData,
  UpdateInvestmentValueData,
  RecordInvestmentReturnData,
  SellInvestmentData,
  ListInvestmentsParams,
} from "@/types/investment";

const isSupabase = () => process.env.NEXT_PUBLIC_BACKEND === 'supabase';

// Create Investment — initial value snapshot + optional funding
// transaction/wallet debit, atomic: always the investments_create RPC.
const createInvestment = async (data: CreateInvestmentData) => {
  if (isSupabase()) {
    const { data: row, error } = await supabase.rpc('investments_create', {
      p_name: data.name,
      p_type: data.type,
      p_principal_amount: data.principalAmount,
      p_start_date: data.startDate,
      p_currency: data.currency ?? 'PHP',
      p_platform: data.platform ?? null,
      p_wallet_id: data.walletId ?? null,
      p_category_id: data.categoryId ?? null,
      p_maturity_date: data.maturityDate ?? null,
      p_expected_return_rate: data.expectedReturnRate ?? null,
      p_notes: data.notes ?? null,
      p_tags: data.tags ?? [],
    });
    if (error) throw error;
    if (data.coinId && row?.id) {
      const { error: coinError } = await supabase
        .from('investments')
        .update({ coin_id: data.coinId, coin_symbol: data.coinSymbol ?? null, quantity: data.quantity ?? null })
        .eq('id', row.id);
      if (coinError) throw coinError;
    }
    return { message: 'success', data: toCamelCase(row) };
  }
  const response = await axiosInstance.post("/investment/create", data);
  return response.data;
};

export const useCreateInvestment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInvestmentData) => createInvestment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["investment-summary"] });
    },
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// List Investments — simple filtered read, direct client call.
const listInvestments = async (params: ListInvestmentsParams) => {
  if (isSupabase()) {
    const page = parseInt(params.page ?? '0') || 0;
    const limit = parseInt(params.limit ?? '20') || 20;
    let query = supabase
      .from('investments')
      .select('*, wallet:wallets(name,type), category:categories(name,icon,color)', { count: 'exact' });
    if (params.type) query = query.eq('type', params.type);
    query = params.status ? query.eq('status', params.status) : query.neq('status', 'archived');

    const { data, count, error } = await query
      .order('start_date', { ascending: false })
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
  const response = await axiosInstance.get("/investment/list", { params });
  return response.data;
};

export const useListInvestments = (params?: ListInvestmentsParams) => {
  return useQuery({
    queryKey: ["investments", params],
    queryFn: () => listInvestments(params || {}),
    enabled: true,
  });
};

// Update Investment — single-table, no side effects.
const updateInvestment = async (data: UpdateInvestmentData) => {
  if (isSupabase()) {
    const { id, ...rest } = data;
    const { error } = await supabase
      .from('investments')
      .update({
        name: rest.name,
        platform: rest.platform,
        maturity_date: rest.maturityDate,
        expected_return_rate: rest.expectedReturnRate,
        wallet_id: rest.walletId,
        category_id: rest.categoryId,
        notes: rest.notes,
        tags: rest.tags,
        status: rest.status,
        ...(rest.coinId !== undefined ? { coin_id: rest.coinId, coin_symbol: rest.coinSymbol ?? null, quantity: rest.quantity ?? null } : {}),
      })
      .eq('id', id);
    if (error) throw error;
    return { message: 'success' };
  }
  const response = await axiosInstance.post("/investment/update", data);
  return response.data;
};

export const useUpdateInvestment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateInvestmentData) => updateInvestment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["bills"] });
    },
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// Archive Investment
const archiveInvestment = async (data: { id: string }) => {
  if (isSupabase()) {
    const { error } = await supabase.from('investments').update({ status: 'archived' }).eq('id', data.id);
    if (error) throw error;
    return { message: 'success' };
  }
  const response = await axiosInstance.post("/investment/delete", data);
  return response.data;
};

export const useArchiveInvestment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string }) => archiveInvestment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["investment-summary"] });
    },
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// Update Value — appends a value_history snapshot; RPC keeps the append +
// current_value update atomic.
const updateValue = async (data: UpdateInvestmentValueData) => {
  if (isSupabase()) {
    const { data: result, error } = await supabase.rpc('investments_update_value', {
      p_id: data.id,
      p_value: data.value,
      p_date: data.date ?? null,
      p_notes: data.notes ?? null,
    });
    if (error) throw error;
    return { message: 'success', data: toCamelCase(result) };
  }
  const response = await axiosInstance.post("/investment/update-value", data);
  return response.data;
};

export const useUpdateInvestmentValue = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateInvestmentValueData) => updateValue(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["investment-summary"] });
    },
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// Record Return — wallet credit + income transaction + dividends running
// total, atomic RPC.
const recordReturn = async (data: RecordInvestmentReturnData) => {
  if (isSupabase()) {
    const { data: result, error } = await supabase.rpc('investments_record_return', {
      p_id: data.id,
      p_amount: data.amount,
      p_wallet_id: data.walletId,
      p_date: data.date ?? null,
      p_notes: data.notes ?? null,
    });
    if (error) throw error;
    return { message: 'success', data: toCamelCase(result) };
  }
  const response = await axiosInstance.post("/investment/record-return", data);
  return response.data;
};

export const useRecordInvestmentReturn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RecordInvestmentReturnData) => recordReturn(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// Sell — wallet credit + income transaction + status/current_value update +
// closing snapshot, atomic RPC.
const sellInvestment = async (data: SellInvestmentData) => {
  if (isSupabase()) {
    const { data: result, error } = await supabase.rpc('investments_sell', {
      p_id: data.id,
      p_sale_amount: data.saleAmount,
      p_wallet_id: data.walletId,
      p_date: data.date ?? null,
      p_notes: data.notes ?? null,
    });
    if (error) throw error;
    return { message: 'success', data: toCamelCase(result) };
  }
  const response = await axiosInstance.post("/investment/sell", data);
  return response.data;
};

export const useSellInvestment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SellInvestmentData) => sellInvestment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["investment-summary"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// Get Summary
const getInvestmentSummary = async () => {
  if (isSupabase()) {
    const { data, error } = await supabase.rpc('investments_summary');
    if (error) throw error;
    return { message: 'success', data: toCamelCase(data) };
  }
  const response = await axiosInstance.get("/investment/summary");
  return response.data;
};

export const useInvestmentSummary = () => {
  return useQuery({
    queryKey: ["investment-summary"],
    queryFn: () => getInvestmentSummary(),
    enabled: true,
  });
};
