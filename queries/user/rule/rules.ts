// Categorization rules (utils/rules.ts runs them). Plain table reads and writes, so they work
// offline and sync like other tables. Supabase only; with another backend there are no rules.

import { supabase } from '@/utils/supabase-client'
import { handleApiError } from '@/utils/error-handler'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Rule } from '@/utils/rules'

const enabledBackend = () => process.env.NEXT_PUBLIC_BACKEND === 'supabase'

export type SaveRuleData = Omit<Rule, 'id' | 'position'> & { position?: number }

/* eslint-disable @typescript-eslint/no-explicit-any */
export const ruleFromRow = (r: any): Rule => ({
  id: String(r.id),
  position: Number(r.position) || 0,
  matchField: r.match_field ?? 'description',
  matchOp: r.match_op ?? 'contains',
  matchValue: r.match_value ?? '',
  matchType: r.match_type ?? null,
  setCategoryId: r.set_category_id ?? null,
  setTags: Array.isArray(r.set_tags) ? r.set_tags : [],
  setWalletId: r.set_wallet_id ?? null,
  enabled: r.enabled !== false,
})
/* eslint-enable @typescript-eslint/no-explicit-any */

const toRow = (d: Partial<SaveRuleData>) => {
  const row: Record<string, unknown> = {}
  if (d.matchField !== undefined) row.match_field = d.matchField
  if (d.matchOp !== undefined) row.match_op = d.matchOp
  if (d.matchValue !== undefined) row.match_value = d.matchValue.trim()
  if (d.matchType !== undefined) row.match_type = d.matchType
  if (d.setCategoryId !== undefined) row.set_category_id = d.setCategoryId
  if (d.setTags !== undefined) row.set_tags = d.setTags
  if (d.setWalletId !== undefined) row.set_wallet_id = d.setWalletId
  if (d.enabled !== undefined) row.enabled = d.enabled
  if (d.position !== undefined) row.position = d.position
  return row
}

export const RULES_KEY = ['rules']

export const useListRules = () =>
  useQuery({
    queryKey: RULES_KEY,
    queryFn: async (): Promise<Rule[]> => {
      if (!enabledBackend()) return []
      const { data, error } = await supabase.from('rules').select('*').order('position', { ascending: true }).order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []).map(ruleFromRow)
    },
  })

/** The rules to run, or none while they load or when the table isn't there yet. Never throws. */
export const useActiveRules = (): Rule[] => {
  const { data } = useListRules()
  return data ?? []
}

const useInvalidate = () => {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: RULES_KEY })
}

export const useCreateRule = () => {
  const invalidate = useInvalidate()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: SaveRuleData) => {
      const existing = queryClient.getQueryData<Rule[]>(RULES_KEY) ?? []
      // New rules go last unless a position is given.
      const position = data.position ?? (existing.reduce((m, r) => Math.max(m, r.position), 0) + 1)
      const { error } = await supabase.from('rules').insert(toRow({ ...data, position }))
      if (error) throw error
    },
    onSuccess: invalidate,
    onError: (error) => handleApiError(error),
  })
}

export const useUpdateRule = () => {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<SaveRuleData> & { id: string }) => {
      const { error } = await supabase.from('rules').update(toRow(data)).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
    onError: (error) => handleApiError(error),
  })
}

/** Saves a new order: ids first to last. Only rows whose position changes are written. */
export const useReorderRules = () => {
  const invalidate = useInvalidate()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const current = new Map((queryClient.getQueryData<Rule[]>(RULES_KEY) ?? []).map((r) => [r.id, r.position]))
      // Show the new order at once.
      queryClient.setQueryData<Rule[]>(RULES_KEY, (old) =>
        old ? ids.map((id, i) => ({ ...(old.find((r) => r.id === id) as Rule), position: i + 1 })).filter((r) => r.id) : old
      )
      for (const [i, id] of ids.entries()) {
        if (current.get(id) === i + 1) continue
        const { error } = await supabase.from('rules').update({ position: i + 1 }).eq('id', id)
        if (error) throw error
      }
    },
    onSettled: invalidate,
    onError: (error) => handleApiError(error),
  })
}

export const useDeleteRule = () => {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase.from('rules').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
    onError: (error) => handleApiError(error),
  })
}
