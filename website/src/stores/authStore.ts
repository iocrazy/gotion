import {
  login as apiLogin,
  register as apiRegister,
  getMe,
  setToken,
  getToken,
  type User,
} from "../lib/api";

let token: string | null = null;
let user: User | null = null;
let listeners: Array<() => void> = [];
let snapshot: { token: string | null; user: User | null } = { token, user };

function notify(): void {
  snapshot = { token, user };
  listeners.forEach((fn) => fn());
}

export function subscribe(listener: () => void): () => void {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function getAuthState(): { token: string | null; user: User | null } {
  return snapshot;
}

export async function login(email: string, password: string): Promise<User> {
  const result = await apiLogin(email, password);
  token = result.token;
  user = result.user;
  setToken(result.token);
  notify();
  return result.user;
}

export async function register(email: string, password: string, username: string): Promise<User> {
  const result = await apiRegister(email, password, username);
  token = result.token;
  user = result.user;
  setToken(result.token);
  notify();
  return result.user;
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
    user = me;
    notify();
    return true;
  } catch {
    logout();
    return false;
  }
}
