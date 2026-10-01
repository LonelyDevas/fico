
import { axiosInstance } from "@/utils/axios-instance";
import { supabase } from "@/utils/supabase-client";
import { handleApiError } from "@/utils/error-handler";
import { resizeToSquareJpeg } from "@/utils/image";
import { RegisterFormData } from "@/validation/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const isSupabase = () => process.env.NEXT_PUBLIC_BACKEND === 'supabase';

// ─── Legacy (fico-api / axios) ───────────────────────────────────────────

const loginUserLegacy = async (ipAddress: string, username: string, password: string) => {
  const response = await axiosInstance.post("/auth/login", { ipAddress, username, password });
  return response.data;
};

const passportLoginLegacy = async (username: string, password: string) => {
  const response = await axiosInstance.post("/auth/passport-login", { username, password });
  return response.data;
};

const logoutUserLegacy = async () => {
  const response = await axiosInstance.post("/auth/logout");
  return response.data;
};

const registerUserLegacy = async (data: RegisterFormData) => {
  const response = await axiosInstance.post("/auth/register", data);
  return response.data;
};

// ─── Supabase ─────────────────────────────────────────────────────────────
// Login stays username-based: resolve username -> email via the
// auth-resolve-username Edge Function first (Supabase's own
// signInWithPassword only accepts email), then sign in directly.
// useSupabaseAuthSync (registered at the app root) picks up the resulting
// session automatically — these functions just need to succeed or throw.

const resolveUsernameToEmail = async (username: string): Promise<string> => {
  const { data, error } = await supabase.functions.invoke('auth-resolve-username', {
    body: { username },
  });
  if (error || !data?.email) {
    throw new Error(data?.error ?? 'Incorrect username or email.');
  }
  return data.email as string;
};

const loginUserSupabase = async (username: string, password: string) => {
  const email = await resolveUsernameToEmail(username);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { message: 'success', data: { auth: { auth: 'player', username, userid: data.user?.id } } };
};

const logoutUserSupabase = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  return { message: 'success' };
};

const registerUserSupabase = async (data: RegisterFormData) => {
  if (!data.email) {
    throw new Error('An email address is required to create an account.');
  }
  const { error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: { username: data.username },
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;

  // user_details / profile fields beyond username are filled in once the
  // session exists (profiles row is created by the handle_new_user trigger).
  return { message: 'success' };
};

const globalpassLoginSupabase = async (username: string, passcode: string, ipAddress: string) => {
  const { data, error } = await supabase.functions.invoke('auth-globalpass-login', {
    body: { username, passcode, ipAddress },
  });
  if (error || !data?.access_token) {
    throw new Error(data?.error ?? 'Authentication failed.');
  }
  const { error: setSessionError } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  if (setSessionError) throw setSessionError;
  return { message: 'success' };
};

// ─── Public hooks (branch on NEXT_PUBLIC_BACKEND, same names/shape as before) ──

export const useLogin = () => {
  return useMutation({
    mutationFn: ({ ipAddress, username, password }: { ipAddress: string; username: string; password: string }) =>
      isSupabase() ? loginUserSupabase(username, password) : loginUserLegacy(ipAddress, username, password),
    onError: (error) => {
      handleApiError(error);
    },
  });
};

export const usePassportLogin = () => {
  return useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      isSupabase() ? loginUserSupabase(username, password) : passportLoginLegacy(username, password),
    onError: (error) => {
      handleApiError(error);
    },
  });
};

export const useGlobalpassLogin = () => {
  return useMutation({
    mutationFn: ({ username, passcode, ipAddress }: { username: string; passcode: string; ipAddress: string }) =>
      globalpassLoginSupabase(username, passcode, ipAddress),
    onError: (error) => {
      handleApiError(error);
    },
  });
};

export const useLogout = () => {
  return useMutation({
    mutationFn: () => (isSupabase() ? logoutUserSupabase() : logoutUserLegacy()),
    onError: (error) => {
      handleApiError(error);
    },
  });
};

export const useRegisterUser = () => {
  return useMutation({
    mutationFn: (data: RegisterFormData) => (isSupabase() ? registerUserSupabase(data) : registerUserLegacy(data)),
    onError: (error) => {
      handleApiError(error);
    },
  });
};

export const useOAuthLogin = () => {
  return useMutation({
    mutationFn: async ({ provider }: { provider: 'google' | 'facebook' }) => {
      if (!isSupabase()) {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
        window.location.href = `${apiUrl}/auth/${provider}`;
        return;
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    },
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// ─── Profile ────────────────────────────────────────────────────────────

const updateUsernameSupabase = async (userId: string, username: string) => {
  const { error } = await supabase.from('profiles').update({ username }).eq('id', userId);
  if (error) throw error;
  return { message: 'success' };
};

export const useUpdateUsername = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, username }: { userId: string; username: string }) =>
      updateUsernameSupabase(userId, username),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// Profile picture. `file` uploads a new picture; `url` sets one directly (the
// Google photo); neither clears it. Returns the URL now stored ('' = none).
const updateAvatarSupabase = async ({ userId, file, url }: { userId: string; file?: File; url?: string }) => {
  let next = url ?? '';
  const path = `${userId}/avatar.jpg`;

  if (file) {
    if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
    if (file.size > 10 * 1024 * 1024) throw new Error('That image is too large. Choose one under 10 MB.');
    const blob = await resizeToSquareJpeg(file);
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, blob, {
      upsert: true,
      contentType: 'image/jpeg',
    });
    if (uploadError) throw uploadError;
    // The path never changes, so add a version to bypass browser and CDN caches.
    next = `${supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
  } else if (!url) {
    // Clearing: delete the stored file, best effort.
    await supabase.storage.from('avatars').remove([path]);
  }

  const { error } = await supabase.from('profiles').update({ avatar_url: next }).eq('id', userId);
  if (error) throw error;
  return next;
};

export const useUpdateAvatar = () => {
  return useMutation({
    mutationFn: (args: { userId: string; file?: File; url?: string }) => updateAvatarSupabase(args),
    onError: (error) => {
      handleApiError(error);
    },
  });
};

const updateNameSupabase = async ({ userId, firstName, lastName }: { userId: string; firstName: string; lastName: string }) => {
  const { error } = await supabase
    .from('user_details')
    .upsert({ owner_id: userId, firstname: firstName, lastname: lastName }, { onConflict: 'owner_id' });
  if (error) throw error;
  return { message: 'success' };
};

export const useUpdateName = () => {
  return useMutation({
    mutationFn: (args: { userId: string; firstName: string; lastName: string }) => updateNameSupabase(args),
    onError: (error) => {
      handleApiError(error);
    },
  });
};

const updatePasswordSupabase = async (password: string) => {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  return { message: 'success' };
};

export const useUpdatePassword = () => {
  return useMutation({
    mutationFn: (password: string) => updatePasswordSupabase(password),
    onError: (error) => {
      handleApiError(error);
    },
  });
};

export const checkReferral = async (id: string): Promise<any> => {
  const response = await axiosInstance.get("/auth/getreferralusername", { params: { id } });
  return response.data;
};

export const useCheckReferral = (id: string) => {
  return useQuery({
    queryKey: ["check-referral", id],
    queryFn: () => checkReferral(id),
    retry: false,
    enabled: !!id && !isSupabase(),
  });
};
