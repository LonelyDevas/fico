// store/auth-store.ts
import { AccessToken } from '@/types/auth';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { supabase } from '@/utils/supabase-client';
import { readCachedSession } from '@/lib/local/session';


const isSupabaseBackend = process.env.NEXT_PUBLIC_BACKEND === 'supabase';

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
      // With Supabase the real session decides who is signed in. Restoring a saved
      // "isAuthenticated: true / isLoading: false" on a hard refresh made the app show
      // pages before the session was checked, and left them empty if it had expired.
      partialize: (state) => (isSupabaseBackend ? { user: state.user } : state),
      merge: (persisted, current) => ({
        ...current,
        ...(isSupabaseBackend
          ? { user: (persisted as Partial<AuthState> | undefined)?.user ?? null }
          : (persisted as Partial<AuthState> | undefined)),
      }),
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

    // Never leave the app waiting forever if the session check stalls (slow network,
    // a token refresh that hangs). Once loading ends, unauthenticated pages go to sign-in.
    const loadingTimeout = setTimeout(() => {
      if (useAuthStore.getState().isLoading) setLoading(false);
    }, 8000);

    const syncFromSession = async (session: import('@supabase/supabase-js').Session | null) => {
      if (!session) {
        // supabase-js comes back empty when the saved token has expired and cannot be renewed
        // because there is no connection. That is not a sign-out: keep going with the saved
        // session. (A real sign-out or a revoked session removes it from storage.)
        const cached = await readCachedSession();
        if (cached) {
          session = { user: cached.user, expires_at: cached.expiresAt } as unknown as import('@supabase/supabase-js').Session;
        } else {
          if (!cancelled) clearAuth();
          return;
        }
      }

      // Sign the user in from the session alone, right away. The profile and name below are read
      // through the on-device database, which can take a while to open (and much longer to download
      // everything on a first sign-in); waiting on it here left pages on the loading spinner until the
      // loading timeout sent the user back to sign-in, and signing in again started the wait over.
      const user = session.user;
      const meta = user.user_metadata ?? {};
      const googlePhoto: string | undefined = meta.avatar_url || meta.picture || undefined;
      const previous = useAuthStore.getState().user;
      const known = previous?._id === user.id ? previous : null;
      const base: AccessToken = {
        _id: user.id,
        username: known?.username ?? meta.username ?? user.email ?? '',
        email: user.email ?? '',
        status: known?.status ?? 'active',
        provider: user.app_metadata?.provider ?? 'local',
        firstName: known?.firstName,
        lastName: known?.lastName,
        googleAvatarUrl: googlePhoto,
        avatarUrl: known ? known.avatarUrl : googlePhoto,
        exp: session.expires_at ?? 0,
        iat: 0,
      };
      if (cancelled) return;
      setAuth(base);

      try {
        const [profileRes, detailsRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
          // Name fields live in user_details; a missing row just means no name yet.
          supabase.from('user_details').select('firstname, lastname').eq('owner_id', user.id).maybeSingle(),
        ]);

        // Signed out or switched accounts while these were loading.
        const latest = useAuthStore.getState().user;
        if (cancelled || latest?._id !== user.id) return;

        // A failed read keeps what is already known instead of blanking it.
        const next = { ...latest };
        if (!profileRes.error) {
          const profile = profileRes.data;
          next.username = profile?.username ?? base.username;
          next.status = profile?.status ?? 'active';
          // An explicit choice (including '' = none) wins; otherwise use the Google photo.
          next.avatarUrl = profile?.avatar_url ?? googlePhoto;
        }
        if (!detailsRes.error) {
          next.firstName = detailsRes.data?.firstname ?? undefined;
          next.lastName = detailsRes.data?.lastname ?? undefined;
        }
        setAuth(next);
      } catch {
        // Keep the session-only details; the next auth event fills them in.
      }
    };

    supabase.auth
      .getSession()
      .then(({ data }) => syncFromSession(data.session))
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        // No forced reload here: the page guards in AppShell send signed-out users to
        // /signin on their own. A reload on top of the logout navigation showed sign-in twice.
        clearAuth();
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
      clearTimeout(loadingTimeout);
      listener.subscription.unsubscribe();
      removeAppStateListener?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
