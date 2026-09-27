// store/auth-store.ts
import { AccessToken } from '@/types/auth';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { supabase } from '@/utils/supabase-client';


interface AuthState {
  user: AccessToken | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (authData: AccessToken) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,

      setAuth: (authData) => {
        set({
          user: authData,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      clearAuth: () => {
        // Clear the JWT token from localStorage
        localStorage.removeItem('auth');
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);

export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useAuthLoading = () => useAuthStore((state) => state.isLoading);

/**
 * Mirrors Supabase's own session into this store so every existing
 * consumer of useUser/useIsAuthenticated/useAuthLoading keeps working
 * unchanged. Register once at the app root (see queries/query-provider.tsx).
 * No-op when NEXT_PUBLIC_BACKEND !== 'supabase' (legacy axios path manages
 * the store directly via setAuth/clearAuth in queries/auth/auth.ts).
 */
export function useSupabaseAuthSync() {
  const { setAuth, clearAuth, setLoading } = useAuthStore();

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_BACKEND !== 'supabase') {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const syncFromSession = async (session: import('@supabase/supabase-js').Session | null) => {
      if (!session) {
        if (!cancelled) clearAuth();
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, status')
        .eq('id', session.user.id)
        .maybeSingle();

      if (cancelled) return;

      setAuth({
        _id: session.user.id,
        username: profile?.username ?? session.user.email ?? '',
        email: session.user.email ?? '',
        status: profile?.status ?? 'active',
        provider: session.user.app_metadata?.provider ?? 'local',
        exp: session.expires_at ?? 0,
        iat: 0,
      });
    };

    supabase.auth.getSession().then(({ data }) => syncFromSession(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        clearAuth();
        if (typeof window !== 'undefined') window.location.href = '/signin';
        return;
      }
      syncFromSession(session);
    });

    // supabase-js's built-in auto-refresh timer relies on browser tab
    // visibility events, which don't fire reliably inside a Capacitor
    // WebView. Per Supabase's own native-app guidance, drive refresh off
    // the app's own foreground/background lifecycle instead, or the access
    // token silently expires while backgrounded with nothing to renew it.
    let removeAppStateListener: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          supabase.auth.startAutoRefresh();
        } else {
          supabase.auth.stopAutoRefresh();
        }
      }).then((handle) => {
        removeAppStateListener = () => handle.remove();
      });
    }

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
      removeAppStateListener?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
