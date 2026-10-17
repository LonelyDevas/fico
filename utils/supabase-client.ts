import { createClient } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { withOfflineSupport } from "@/lib/local/client";

// supabase-js defaults to browser localStorage for session persistence,
// which isn't reliably persistent inside a Capacitor WebView on iOS/Android.
// This adapter backs session storage with @capacitor/preferences on native
// builds and falls back to localStorage on web, behind the same async
// Storage interface supabase-js expects.
const capacitorPreferencesStorage = {
  getItem: async (key: string) => (await Preferences.get({ key })).value,
  setItem: async (key: string, value: string) => {
    await Preferences.set({ key, value });
  },
  removeItem: async (key: string) => {
    await Preferences.remove({ key });
  },
};

const webStorage = {
  getItem: async (key: string) =>
    typeof window === "undefined" ? null : window.localStorage.getItem(key),
  setItem: async (key: string, value: string) => {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (typeof window !== "undefined") window.localStorage.removeItem(key);
  },
};

// withOfflineSupport answers from/rpc calls from the on-device database (synced to Supabase in the
// background) and passes auth, storage and edge functions straight through. See lib/local/.
export const supabase = withOfflineSupport(createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: Capacitor.isNativePlatform() ? capacitorPreferencesStorage : webStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: !Capacitor.isNativePlatform(),
    },
  },
));
