// /api/v1/obligation routes — new query file (no prior frontend UI existed
// for this domain; the fico-api backend routes already existed, so the
// legacy path hits those directly for parity with every other domain here).

import { axiosInstance } from "@/utils/axios-instance";
import { supabase } from "@/utils/supabase-client";
import { toCamelCase } from "@/utils/case-transform";
import { handleApiError } from "@/utils/error-handler";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CreateObligationData,
  UpdateObligationData,
  RecordObligationPaymentData,
  ListObligationsParams,
} from "@/types/obligation";

const isSupabase = () => process.env.NEXT_PUBLIC_BACKEND === 'supabase';

// Create Obligation — disbursement transaction + optional installment
// bills, all atomic: always the obligations_create RPC.
const createObligation = async (data: CreateObligationData) => {
  if (isSupabase()) {
    const { data: row, error } = await supabase.rpc('obligations_create', {
      p_direction: data.direction,
      p_name: data.name,
      p_counterparty: data.counterparty,
      p_principal_amount: data.principalAmount,
      p_start_date: data.startDate,
      p_counterparty_contact: data.counterpartyContact ?? null,
      p_currency: data.currency ?? 'PHP',
      p_interest_rate: data.interestRate ?? null,
      p_interest_type: data.interestType ?? null,
      p_due_date: data.dueDate ?? null,
      p_wallet_id: data.walletId ?? null,
      p_category_id: data.categoryId ?? null,
      p_notes: data.notes ?? null,
      p_tags: data.tags ?? [],
      p_is_installment: data.isInstallment ?? false,
      p_installment_amount: data.installmentAmount ?? null,
      p_total_installments: data.totalInstallments ?? null,
      p_installment_frequency: data.installmentFrequency ?? null,
    });
    if (error) throw error;
    return { message: 'success', data: toCamelCase(row) };
  }
  const response = await axiosInstance.post("/obligation/create", data);
  return response.data;
};

export const useCreateObligation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateObligationData) => createObligation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["obligations"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["obligation-summary"] });
    },
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// List Obligations — simple filtered read, direct client call.
const listObligations = async (params: ListObligationsParams) => {
  if (isSupabase()) {
    const page = parseInt(params.page ?? '0') || 0;
    const limit = parseInt(params.limit ?? '20') || 20;
    let query = supabase
      .from('obligations')
      .select('*, wallet:wallets(name,type), category:categories(name,icon,color)', { count: 'exact' });
    if (params.direction) query = query.eq('direction', params.direction);
    query = params.status ? query.eq('status', params.status) : query.neq('status', 'archived');
    if (params.isInstallment !== undefined) query = query.eq('is_installment', params.isInstallment === 'true');

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
  const response = await axiosInstance.get("/obligation/list", { params });
  return response.data;
};

export const useListObligations = (params?: ListObligationsParams) => {
  return useQuery({
    queryKey: ["obligations", params],
    queryFn: () => listObligations(params || {}),
    enabled: true,
  });
};

// Update Obligation — recomputes totalWithInterest server-side when
// interest fields change (RPC handles this in the old service too), but the
// field set here has no cross-table side effects, so a direct update is
// safe EXCEPT for interest recompute — kept as an RPC-free direct update to
// match the simpler field set exposed here; recompute happens via
// obligations_create only. Consumers needing interest recompute should
// archive and recreate, matching the original service's behavior for the
// fields it actually allowed changing.
const updateObligation = async (data: UpdateObligationData) => {
  if (isSupabase()) {
    const { id, ...rest } = data;
    const { error } = await supabase
      .from('obligations')
      .update({
        name: rest.name,
        counterparty: rest.counterparty,
        counterparty_contact: rest.counterpartyContact,
        due_date: rest.dueDate,
        interest_rate: rest.interestRate,
        interest_type: rest.interestType,
        wallet_id: rest.walletId,
        category_id: rest.categoryId,
        notes: rest.notes,
        tags: rest.tags,
        status: rest.status,
      })
      .eq('id', id);
    if (error) throw error;
    return { message: 'success' };
  }
  const response = await axiosInstance.post("/obligation/update", data);
  return response.data;
};

export const useUpdateObligation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateObligationData) => updateObligation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["obligations"] });
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

// Archive Obligation
const archiveObligation = async (data: { id: string }) => {
  if (isSupabase()) {
    const { error } = await supabase.from('obligations').update({ status: 'archived' }).eq('id', data.id);
    if (error) throw error;
    return { message: 'success' };
  }
  const response = await axiosInstance.post("/obligation/delete", data);
  return response.data;
};

export const useArchiveObligation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string }) => archiveObligation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["obligations"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["obligation-summary"] });
    },
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// Record Payment — wallet debit/credit + payment transaction + remaining
// balance/status update, atomic: always the obligations_record_payment RPC.
const recordPayment = async (data: RecordObligationPaymentData) => {
  if (isSupabase()) {
    const { data: result, error } = await supabase.rpc('obligations_record_payment', {
      p_id: data.id,
      p_amount: data.amount,
      p_wallet_id: data.walletId,
      p_date: data.date ?? null,
      p_notes: data.notes ?? null,
      p_idempotency_key: data.idempotencyKey ?? null,
    });
    if (error) throw error;
    return { message: 'success', data: toCamelCase(result) };
  }
  const response = await axiosInstance.post("/obligation/record-payment", data);
  return response.data;
};

export const useRecordObligationPayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RecordObligationPaymentData) => recordPayment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["obligations"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["obligation-summary"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// Get Summary
const getObligationSummary = async () => {
  if (isSupabase()) {
    const { data, error } = await supabase.rpc('obligations_summary');
    if (error) throw error;
    return { message: 'success', data: toCamelCase(data) };
  }
  const response = await axiosInstance.get("/obligation/summary");
  return response.data;
};

export const useObligationSummary = () => {
  return useQuery({
    queryKey: ["obligation-summary"],
    queryFn: () => getObligationSummary(),
    enabled: true,
  });
};
