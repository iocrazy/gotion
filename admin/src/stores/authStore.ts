import {
  login as apiLogin,
  getMe,
  setToken,
  getToken,
  type User,
} from "../lib/api";

let token: string | null = null;
let user: User | null = null;
let listeners: Array<() => void> = [];

function notify(): void {
  listeners.forEach((fn) => fn());
}

export function subscribe(listener: () => void): () => void {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function getAuthState(): { token: string | null; user: User | null } {
  return { token, user };
}

export async function login(email: string, password: string): Promise<void> {
  const result = await apiLogin(email, password);

  if (!result.user.is_admin) {
    throw new Error("Access denied: admin privileges required");
  }

  token = result.token;
  user = result.user;
  setToken(result.token);
  notify();
}

export function logout(): void {
  token = null;
  user = null;
  setToken(null);
  notify();
}

export async function loadToken(): Promise<boolean> {
  const stored = getToken();
  if (!stored) return false;

  try {
    token = stored;
    const me = await getMe();
    if (!me.is_admin) {
      logout();
      return false;
    }
    user = me;
    notify();
    return true;
  } catch {
    logout();
    return false;
  }
}
