const TOKEN_KEY = "gotion_token";
const API_URL = import.meta.env.VITE_API_URL || "";

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  requireAuth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, requireAuth = true } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (requireAuth) {
    const token = getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let message = `Request failed: ${response.status}`;
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed.error) message = parsed.error;
    } catch {
      if (errorBody) message = errorBody;
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

// --- Types ---

export interface User {
  id: string;
  email: string;
  username: string;
  is_admin: boolean;
  disabled?: boolean;
  created_at?: string;
  subscription?: {
    plan: string;
    expires_at: string | null;
    is_pro: boolean;
  };
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Stats {
  total_users: number;
  total_tasks: number;
  total_categories: number;
  pro_users: number;
  monthly_revenue: number;
}

export interface Subscription {
  user_id: string;
  username?: string;
  email?: string;
  plan: string;
  period?: string;
  expires_at: string | null;
  created_at?: string;
}

export interface Payment {
  id?: string;
  order_no: string;
  user_id: string;
  username?: string;
  amount: number;
  channel: string;
  status: string;
  plan: string;
  period?: string;
  paid_at: string | null;
  created_at?: string;
}

// --- Auth API ---

export async function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: { email, password },
    requireAuth: false,
  });
}

export async function register(email: string, password: string, username: string): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: { email, password, username },
    requireAuth: false,
  });
}

export async function getMe(): Promise<User> {
  return request<User>("/api/auth/me");
}

// --- Admin API ---

export async function getStats(): Promise<Stats> {
  return request<Stats>("/api/admin/stats");
}

export async function getUsers(): Promise<User[]> {
  return request<User[]>("/api/admin/users");
}

export async function updateUser(
  id: string,
  data: { disabled?: boolean; is_admin?: boolean }
): Promise<User> {
  return request<User>(`/api/admin/users/${id}`, {
    method: "PUT",
    body: data,
  });
}

export async function deleteUser(id: string): Promise<void> {
  await request<unknown>(`/api/admin/users/${id}`, { method: "DELETE" });
}

export async function getSubscriptions(): Promise<Subscription[]> {
  return request<Subscription[]>("/api/admin/subscriptions");
}

export async function giftPro(
  userId: string,
  days: number,
  period?: string
): Promise<unknown> {
  return request<unknown>(`/api/admin/subscriptions/${userId}`, {
    method: "PUT",
    body: { days, period },
  });
}

export async function getPayments(): Promise<Payment[]> {
  return request<Payment[]>("/api/admin/payments");
}
