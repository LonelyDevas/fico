// Savings goals (migration 0052). Supabase only: there is no legacy API route for goals.
// Plain table reads and writes, so they work offline through the on-device database like wallets.

import { supabase } from "@/utils/supabase-client";
import { toCamelCase } from "@/utils/case-transform";
import { handleApiError } from "@/utils/error-handler";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreateGoalData, Goal, UpdateGoalData } from "@/types/goal";

const listGoals = async () => {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return { message: 'success', data: toCamelCase<Goal[]>(data ?? []) };
};

export const useListGoals = () => {
  return useQuery({
    queryKey: ["goals"],
    queryFn: listGoals,
  });
};

const createGoal = async (data: CreateGoalData) => {
  const { error } = await supabase.from('goals').insert({
    name: data.name,
    target_amount: data.targetAmount,
    deadline: data.deadline ?? null,
    linked_wallet_ids: data.linkedWalletIds ?? [],
  });
  if (error) throw error;
  return { message: 'success' };
};

export const useCreateGoal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateGoalData) => createGoal(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goals"] }),
    onError: (error) => {
      handleApiError(error);
    },
  });
};

const updateGoal = async (data: UpdateGoalData) => {
  const { id, ...rest } = data;
  const { error } = await supabase
    .from('goals')
    .update({
      name: rest.name,
      target_amount: rest.targetAmount,
      deadline: rest.deadline,
      linked_wallet_ids: rest.linkedWalletIds,
      status: rest.status,
    })
    .eq('id', id);
  if (error) throw error;
  return { message: 'success' };
};

export const useUpdateGoal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateGoalData) => updateGoal(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goals"] }),
    onError: (error) => {
      handleApiError(error);
    },
  });
};
