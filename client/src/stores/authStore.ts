import { create } from "zustand";
import { api } from "../lib/api";
import { isTauri, tauriInvoke } from "../lib/tauri";

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  is_admin: boolean;
  subscription?: {
    plan: string;
    expires_at: string | null;
    is_pro: boolean;
  };
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    username: string,
    password: string,
  ) => Promise<string>;
  isPro: () => boolean;
  logout: () => void;
  loadToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  loading: true,

  isPro: () => {
    const state = useAuthStore.getState();
    return state.user?.subscription?.is_pro ?? false;
  },

  loadToken: async () => {
    let token: string | null = null;
    let cachedUser: AuthUser | null = null;

    if (isTauri()) {
      try {
        token = await tauriInvoke<string>("get_auth_token");
      } catch {
        /* no token stored */
      }
    } else {
      token = localStorage.getItem("gotion_token");
      try {
        const raw = localStorage.getItem("gotion_user");
        if (raw) cachedUser = JSON.parse(raw);
      } catch {
        /* invalid cached user */
      }
    }

    if (!token) {
      set({ loading: false });
      return;
    }

    // Restore cached user immediately (no loading flash)
    if (cachedUser) {
      set({ token, user: cachedUser, loading: false });
    }

    // Validate token with server in background
    try {
      const user = await api.getMe(token);
      set({ token, user });
      if (!isTauri()) {
        localStorage.setItem("gotion_user", JSON.stringify(user));
      }
    } catch (err) {
      const isAuthError =
        err instanceof Error && /\b(401|403)\b/.test(err.message);
      if (isAuthError) {
        set({ token: null, user: null });
        if (isTauri()) {
          tauriInvoke("clear_auth_token").catch(() => {});
        } else {
          localStorage.removeItem("gotion_token");
          localStorage.removeItem("gotion_user");
        }
      }
      // Network error: keep cached token + user, no action needed
    }

    // If no cached user and we reach here without setting loading=false
    if (!cachedUser) {
      const state = useAuthStore.getState();
      if (state.loading) set({ loading: false });
    }
  },

  login: async (email: string, password: string) => {
    const res = await api.login(email, password);
    set({ token: res.token, user: res.user });
    if (isTauri()) {
      await tauriInvoke("save_auth_token", { token: res.token }).catch(
        () => {},
      );
    } else {
      localStorage.setItem("gotion_token", res.token);
      localStorage.setItem("gotion_user", JSON.stringify(res.user));
    }
  },

  register: async (email: string, username: string, password: string) => {
    const res = await api.register(email, username, password);
    return res.message;
  },

  logout: () => {
    set({ user: null, token: null });
    if (isTauri()) {
      tauriInvoke("clear_auth_token").catch(() => {});
    } else {
      localStorage.removeItem("gotion_token");
      localStorage.removeItem("gotion_user");
    }
  },
}));
