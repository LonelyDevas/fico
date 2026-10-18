// admin_* RPCs (migration 0048). Only the app owner passes the server-side check.

import { supabase } from "@/utils/supabase-client";
import { toCamelCase } from "@/utils/case-transform";
import { useQuery } from "@tanstack/react-query";

export interface AdminUser {
  id: string;
  email: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  status: string | null;
  provider: string;
  createdAt: string;
  lastSignInAt: string | null;
  lastSeen: string | null;
  transactionCount: number;
}

export interface AdminTraffic {
  totalUsers: number;
  newUsers7d: number;
  activeToday: number;
  active7d: number;
  active30d: number;
  sessionsToday: number;
  sessionsInRange: number;
  daily: { day: string; activeUsers: number; sessions: number; signups: number }[];
  platforms: { platform: string; users: number; sessions: number }[];
}

export const useAdminUsers = (enabled: boolean) =>
  useQuery({
    queryKey: ["admin-users"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users");
      if (error) throw error;
      return toCamelCase(data ?? []) as AdminUser[];
    },
  });

export const useAdminTraffic = (enabled: boolean, days: number) =>
  useQuery({
    queryKey: ["admin-traffic", days],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_traffic", { p_days: days });
      if (error) throw error;
      return toCamelCase(data) as AdminTraffic;
    },
  });

/** Records that this user opened the app today. Best effort: offline or failed calls are ignored. */
export const logAppActivity = async (platform: string) => {
  try {
    await supabase.rpc("app_log_activity", { p_platform: platform });
  } catch {
    // traffic logging must never affect the app
  }
};
