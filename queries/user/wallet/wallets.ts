// /api/v1/wallet routes

import { axiosInstance } from "@/utils/axios-instance";
import { supabase } from "@/utils/supabase-client";
import { toCamelCase } from "@/utils/case-transform";
import { handleApiError } from "@/utils/error-handler";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CreateWalletData,
  UpdateWalletData,
  AdjustBalanceData,
  SetBalanceData,
  ArchiveWalletData,
  ListWalletsParams,
  GetWalletParams,
} from "@/types/wallet";

const isSupabase = () => process.env.NEXT_PUBLIC_BACKEND === 'supabase';

const invalidateWalletQueries = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: ["wallets"] });
  queryClient.invalidateQueries({ queryKey: ["wallet"] });
  queryClient.invalidateQueries({ queryKey: ["wallet-total-balance"] });
};

// Create Wallet — simple single-table insert, direct client call (layer (a)).
const createWallet = async (data: CreateWalletData) => {
  if (isSupabase()) {
    const { data: row, error } = await supabase
      .from('wallets')
      .insert({
        name: data.name,
        type: data.type,
        balance: data.balance ?? 0,
        currency: data.currency ?? 'PHP',
        icon: data.icon,
        color: data.color,
        description: data.description,
        account_number: data.accountNumber,
        institution: data.institution,
        credit_limit: data.creditLimit,
        statement_day: data.statementDay,
        due_day: data.dueDay,
        interest_rate: data.interestRate,
        interest_payout: data.interestPayout,
        interest_tax_rate: data.interestTaxRate,
        maturity_date: data.maturityDate || null,
      })
      .select()
      .single();
    if (error) throw error;
    return { message: 'success', data: toCamelCase(row) };
  }
  const response = await axiosInstance.post("/wallet/create", data);
  return response.data;
};

export const useCreateWallet = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWalletData) => createWallet(data),
    onSuccess: () => {
      invalidateWalletQueries(queryClient);
    },
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// List Wallets
const listWallets = async (params: ListWalletsParams) => {
  if (isSupabase()) {
    const page = parseInt(params.page ?? '0') || 0;
    const limit = parseInt(params.limit ?? '20') || 20;
    let query = supabase.from('wallets').select('*', { count: 'exact' });
    query = query.eq('status', params.status ?? 'active');
    if (params.type) query = query.eq('type', params.type);
    if (params.currency) query = query.eq('currency', params.currency);
    const { data, count, error } = await query
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
  const response = await axiosInstance.get("/wallet/list", { params });
  return response.data;
};

export const useListWallets = (params?: ListWalletsParams) => {
  return useQuery({
    queryKey: ["wallets", params],
    queryFn: () => listWallets(params || {}),
    enabled: true,
  });
};

// Get Wallet by ID
const getWallet = async (params: GetWalletParams) => {
  if (isSupabase()) {
    const { data, error } = await supabase.from('wallets').select('*').eq('id', params.id).single();
    if (error) throw error;
    return { message: 'success', data: toCamelCase(data) };
  }
  const response = await axiosInstance.get("/wallet/get", { params });
  return response.data;
};

export const useGetWallet = (params?: GetWalletParams) => {
  return useQuery({
    queryKey: ["wallet", params],
    queryFn: () => getWallet(params || { id: "" }),
    enabled: !!params?.id,
  });
};

// Update Wallet
const updateWallet = async (data: UpdateWalletData) => {
  if (isSupabase()) {
    const { id, ...rest } = data;
    const { error } = await supabase
      .from('wallets')
      .update({
        name: rest.name,
        type: rest.type,
        icon: rest.icon,
        color: rest.color,
        description: rest.description,
        account_number: rest.accountNumber,
        institution: rest.institution,
        credit_limit: rest.creditLimit,
        statement_day: rest.statementDay,
        due_day: rest.dueDay,
        interest_rate: rest.interestRate,
        interest_payout: rest.interestPayout,
        interest_tax_rate: rest.interestTaxRate,
        maturity_date: rest.maturityDate || null,
        status: rest.status,
      })
      .eq('id', id);
    if (error) throw error;
    return { message: 'success' };
  }
  const response = await axiosInstance.post("/wallet/update", data);
  return response.data;
};

export const useUpdateWallet = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateWalletData) => updateWallet(data),
    onSuccess: () => {
      invalidateWalletQueries(queryClient);
    },
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// Adjust Balance — mutates a running total, goes through the
// wallets_adjust_balance RPC so the update stays atomic (layer (b)).
const adjustBalance = async (data: AdjustBalanceData) => {
  if (isSupabase()) {
    const { data: row, error } = await supabase.rpc('wallets_adjust_balance', {
      p_wallet_id: data.id,
      p_amount: data.amount,
    });
    if (error) throw error;
    return { message: 'success', data: { newBalance: row.balance } };
  }
  const response = await axiosInstance.post("/wallet/adjust-balance", data);
  return response.data;
};

export const useAdjustBalance = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AdjustBalanceData) => adjustBalance(data),
    onSuccess: () => {
      invalidateWalletQueries(queryClient);
    },
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// Set (override) Balance — directly overwrites the running total, unlike
// adjustBalance which applies a delta. Used to reconcile a wallet after an
// import, since imports no longer move the balance themselves.
const setBalance = async (data: SetBalanceData) => {
  if (isSupabase()) {
    const { data: row, error } = await supabase.rpc('wallets_set_balance', {
      p_wallet_id: data.id,
      p_balance: data.balance,
    });
    if (error) throw error;
    return { message: 'success', data: { newBalance: row.balance } };
  }
  const response = await axiosInstance.post("/wallet/set-balance", data);
  return response.data;
};

export const useSetBalance = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SetBalanceData) => setBalance(data),
    onSuccess: () => {
      invalidateWalletQueries(queryClient);
    },
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// Archive Wallet
const archiveWallet = async (data: ArchiveWalletData) => {
  if (isSupabase()) {
    const { error } = await supabase.from('wallets').update({ status: 'archived' }).eq('id', data.id);
    if (error) throw error;
    return { message: 'success' };
  }
  const response = await axiosInstance.post("/wallet/archive", data);
  return response.data;
};

export const useArchiveWallet = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ArchiveWalletData) => archiveWallet(data),
    onSuccess: () => {
      invalidateWalletQueries(queryClient);
    },
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// Get Total Balance
const getTotalBalance = async (params: ListWalletsParams) => {
  if (isSupabase()) {
    let query = supabase.from('wallets').select('balance, currency').eq('status', 'active');
    if (params.currency) query = query.eq('currency', params.currency);
    const { data, error } = await query;
    if (error) throw error;
    const balancesByCurrency: Record<string, number> = {};
    for (const w of data ?? []) {
      balancesByCurrency[w.currency] = (balancesByCurrency[w.currency] ?? 0) + Number(w.balance);
    }
    return { message: 'success', data: { balancesByCurrency, walletCount: data?.length ?? 0 } };
  }
  const response = await axiosInstance.get("/wallet/total-balance", { params });
  return response.data;
};

export const useTotalBalance = (params?: ListWalletsParams) => {
  return useQuery({
    queryKey: ["wallet-total-balance", params],
    queryFn: () => getTotalBalance(params || {}),
    enabled: true,
  });
};

// Opens (or updates) the "<card> payment" bill for every credit card that has a
// due day. Safe to call repeatedly; it only changes bills tied to a card.
export const useSyncCardBills = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!isSupabase()) return 0;
      const { data, error } = await supabase.rpc('cards_sync_bills');
      if (error) throw error;
      return Number(data ?? 0);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["bill-summary"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-bills"] });
      queryClient.invalidateQueries({ queryKey: ["overdue-bills"] });
      queryClient.invalidateQueries({ queryKey: ["bill-calendar"] });
    },
  });
};
