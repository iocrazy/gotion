import { create } from "zustand";
import { api } from "../lib/api";
import { isTauri, tauriInvoke } from "../lib/tauri";

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  is_admin: boolean;
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
  logout: () => void;
  loadToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  loading: true,

  loadToken: async () => {
    let token: string | null = null;
    if (isTauri()) {
      try {
        token = await tauriInvoke<string>("get_auth_token");
      } catch {
        /* no token stored */
      }
    } else {
      token = localStorage.getItem("gotion_token");
    }

    if (token) {
      try {
        const user = await api.getMe(token);
        set({ token, user, loading: false });
      } catch {
        // Token expired or invalid
        set({ token: null, user: null, loading: false });
        if (!isTauri()) localStorage.removeItem("gotion_token");
      }
    } else {
      set({ loading: false });
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
    }
  },
}));
