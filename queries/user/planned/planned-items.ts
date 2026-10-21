// Planned items: one-off income and expenses you expect (13th month pay, gifts, a trip), each with a
// low and a high estimate. Plain table reads and writes (no RPC), so they also work offline.
// Supabase only: there is no legacy API route for them.

import { supabase } from "@/utils/supabase-client";
import { toCamelCase } from "@/utils/case-transform";
import { handleApiError } from "@/utils/error-handler";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PlannedItem, SavePlannedItemData, UpdatePlannedItemData } from "@/types/planned-item";

const assertSupabase = () => {
  if (process.env.NEXT_PUBLIC_BACKEND !== 'supabase') {
    throw new Error('Planned items need the Supabase backend.');
  }
};

const toRow = (data: SavePlannedItemData) => ({
  name: data.name,
  type: data.type,
  amount_low: data.amountLow,
  amount_high: data.amountHigh,
  date: data.date,
  status: data.status,
  category_id: data.categoryId || null,
  notes: data.notes || null,
});

export const useListPlannedItems = () =>
  useQuery({
    queryKey: ["planned-items"],
    queryFn: async () => {
      assertSupabase();
      const { data, error } = await supabase
        .from('planned_items')
        .select('*, category:categories(name,icon,color)')
        .order('date', { ascending: true });
      if (error) throw error;
      return toCamelCase<PlannedItem[]>(data ?? []).map((item) => ({
        ...item,
        date: String(item.date).slice(0, 10),
        amountLow: Number(item.amountLow) || 0,
        amountHigh: Number(item.amountHigh) || 0,
      }));
    },
  });

const useInvalidate = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["planned-items"] });
};

export const useCreatePlannedItem = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (data: SavePlannedItemData) => {
      assertSupabase();
      const { error } = await supabase.from('planned_items').insert(toRow(data));
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error) => handleApiError(error),
  });
};

export const useUpdatePlannedItem = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdatePlannedItemData) => {
      assertSupabase();
      const { error } = await supabase.from('planned_items').update(toRow(data)).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error) => handleApiError(error),
  });
};

export const useDeletePlannedItem = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      assertSupabase();
      const { error } = await supabase.from('planned_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error) => handleApiError(error),
  });
};
