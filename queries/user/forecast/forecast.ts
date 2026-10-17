// Read-only data for the forecast and wallet look-back. Both need every row
// (not one page), so these walk the table in chunks.

import { supabase } from "@/utils/supabase-client";
import { toCamelCase } from "@/utils/case-transform";
import { useQuery } from "@tanstack/react-query";
import type { ForecastBill, ForecastBudget, LedgerTxn, LedgerWallet } from "@/utils/forecast";

const CHUNK = 1000;

const assertSupabase = () => {
  if (process.env.NEXT_PUBLIC_BACKEND !== 'supabase') {
    throw new Error('Forecast needs the Supabase backend.');
  }
};

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await build(from, from + CHUNK - 1);
    if (error) throw error;
    const batch = toCamelCase<T[]>(data ?? []);
    rows.push(...batch);
    if (batch.length < CHUNK) return rows;
  }
}

const TXN_COLUMNS = 'wallet_id,to_wallet_id,amount,type,service_fee,service_fee_deducted,bill_id,category_id,date';

// Active and archived wallets, so a look-back still shows one you have since archived.
export const useAllWallets = () =>
  useQuery({
    queryKey: ["wallets", "all-status"],
    queryFn: async () => {
      assertSupabase();
      const wallets = await fetchAll<LedgerWallet>((from, to) =>
        supabase
          .from('wallets')
          .select('id,name,type,balance,status,created_at')
          .order('created_at', { ascending: true })
          .range(from, to)
      );
      // Imported transactions can predate the wallet's own created_at, so the
      // look-back also needs the earliest date each wallet actually has activity.
      return Promise.all(
        wallets.map(async (wallet) => {
          const { data, error } = await supabase
            .from('transactions')
            .select('date')
            .eq('status', 'completed')
            .or(`wallet_id.eq.${wallet.id},to_wallet_id.eq.${wallet.id}`)
            .order('date', { ascending: true })
            .limit(1);
          if (error) throw error;
          return { ...wallet, firstActivityAt: (data?.[0]?.date as string | undefined) ?? undefined };
        })
      );
    },
  });

// Completed transactions dated after `afterIso`, used to undo them from today's balance.
export const useTransactionsAfter = (afterIso: string, enabled = true) =>
  useQuery({
    queryKey: ["transactions", "after", afterIso],
    enabled,
    queryFn: async () => {
      assertSupabase();
      return fetchAll<LedgerTxn>((from, to) =>
        supabase
          .from('transactions')
          .select(TXN_COLUMNS)
          .eq('status', 'completed')
          .gt('date', afterIso)
          .order('date', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to)
      );
    },
  });

// Bills and income still to come (anything not yet paid or received).
export const useOpenBills = () =>
  useQuery({
    queryKey: ["bills", "forecast-open"],
    queryFn: async () => {
      assertSupabase();
      return fetchAll<ForecastBill>((from, to) =>
        supabase
          .from('bills')
          .select('id,type,name,amount,paid_amount,due_date,is_recurring,recurring_frequency,wallet_id,payment_status')
          .eq('status', 'active')
          .in('payment_status', ['unpaid', 'partial', 'overdue'])
          .order('due_date', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to)
      );
    },
  });

// Budgets still running (or overdue for renewal), with what is already spent.
export const useActiveBudgets = () =>
  useQuery({
    queryKey: ["budgets", "forecast-active"],
    queryFn: async () => {
      assertSupabase();
      return fetchAll<ForecastBudget>((from, to) =>
        supabase
          .from('budgets')
          .select('id,name,amount,spent,start_date,end_date,category_ids')
          .in('status', ['active', 'exceeded'])
          .order('start_date', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to)
      );
    },
  });
