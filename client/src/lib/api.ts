import { useSettingsStore } from "../stores/settingsStore";

function getBaseUrl(): string {
  return useSettingsStore.getState().serverUrl;
}

let _getToken: () => string = () => "";

export function setTokenGetter(fn: () => string) {
  _getToken = fn;
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const token = _getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export interface Task {
  id: string;
  notion_id: string | null;
  title: string;
  status: "todo" | "done";
  due_date: string | null;
  created_at: string;
  updated_at: string;
  title_updated_at: string;
  status_updated_at: string;
  due_date_updated_at: string | null;
  category_id: string | null;
  parent_id: string | null;
  sort_order: number;
  starred: boolean;
  starred_updated_at: string | null;
  notion_status: string | null;
}

export interface Block {
  id: string;
  task_id: string;
  notion_block_id: string | null;
  type: string;
  content: unknown;
  sort_order: number;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
  created_at: string;
}

export interface Attachment {
  id: string;
  task_id: string;
  filename: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

export interface CreateTaskRequest {
  title: string;
  status?: "todo" | "done";
  due_date?: string | null;
  category_id?: string | null;
  parent_id?: string | null;
}

export interface UpdateTaskRequest {
  title?: string;
  status?: "todo" | "done";
  due_date?: string | null;
  category_id?: string | null;
  parent_id?: string | null;
  sort_order?: number;
  starred?: boolean;
}

export const api = {
  async listTasks(status?: "todo" | "done", search?: string): Promise<Task[]> {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    const qs = params.toString();
    const res = await fetch(`${getBaseUrl()}/api/tasks${qs ? `?${qs}` : ""}`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to list tasks: ${res.status}`);
    return res.json();
  },

  async createTask(data: CreateTaskRequest): Promise<Task> {
    const res = await fetch(`${getBaseUrl()}/api/tasks`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to create task: ${res.status}`);
    return res.json();
  },

  async updateTask(id: string, data: UpdateTaskRequest): Promise<Task> {
    const res = await fetch(`${getBaseUrl()}/api/tasks/${id}`, {
      method: "PATCH",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to update task: ${res.status}`);
    return res.json();
  },

  async deleteTask(id: string): Promise<void> {
    const res = await fetch(`${getBaseUrl()}/api/tasks/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok && res.status !== 204)
      throw new Error(`Failed to delete task: ${res.status}`);
  },

  async getBlocks(taskId: string): Promise<Block[]> {
    const res = await fetch(`${getBaseUrl()}/api/tasks/${taskId}/blocks`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to get blocks: ${res.status}`);
    return res.json();
  },

  async updateBlocks(taskId: string, blocks: Block[]): Promise<Block[]> {
    const res = await fetch(`${getBaseUrl()}/api/tasks/${taskId}/blocks`, {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(blocks),
    });
    if (!res.ok) throw new Error(`Failed to update blocks: ${res.status}`);
    return res.json();
  },

  async listCategories(): Promise<Category[]> {
    const res = await fetch(`${getBaseUrl()}/api/categories`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to list categories: ${res.status}`);
    return res.json();
  },

  async createCategory(data: { name: string; icon?: string; color?: string; sort_order?: number }): Promise<Category> {
    const res = await fetch(`${getBaseUrl()}/api/categories`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to create category: ${res.status}`);
    return res.json();
  },

  async updateCategory(id: string, data: { name?: string; icon?: string; color?: string; sort_order?: number }): Promise<Category> {
    const res = await fetch(`${getBaseUrl()}/api/categories/${id}`, {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to update category: ${res.status}`);
    return res.json();
  },

  async deleteCategory(id: string): Promise<void> {
    const res = await fetch(`${getBaseUrl()}/api/categories/${id}`, { method: "DELETE", headers: authHeaders() });
    if (!res.ok && res.status !== 204) throw new Error(`Failed to delete category: ${res.status}`);
  },

  async uploadImage(file: File): Promise<{ id: string; url: string }> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${getBaseUrl()}/api/images`, {
      method: "POST",
      headers: authHeaders(),
      body: formData,
    });
    if (!res.ok) throw new Error(`Failed to upload image: ${res.status}`);
    const data = await res.json();
    return { id: data.id, url: `${getBaseUrl()}${data.url}` };
  },

  // Notion config
  async getNotionConfig(): Promise<{
    token_configured: boolean;
    token_preview: string;
    database_id: string;
    field_map: { title: string; status: string; due_date: string; status_todo: string; status_done: string; category: string; starred: string; parent_item: string; status_type: string };
    webhook_secret: string;
  }> {
    const res = await fetch(`${getBaseUrl()}/api/notion/config`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to get notion config: ${res.status}`);
    return res.json();
  },

  async updateNotionConfig(data: {
    token?: string;
    database_id?: string;
    field_map?: { title: string; status: string; due_date: string; status_todo: string; status_done: string; category: string; starred: string };
    webhook_secret?: string;
  }): Promise<void> {
    const res = await fetch(`${getBaseUrl()}/api/notion/config`, {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to update notion config: ${res.status}`);
  },

  async testNotionConnection(data?: { token?: string; database_id?: string }): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${getBaseUrl()}/api/notion/test`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data ?? {}),
    });
    if (!res.ok) throw new Error(`Failed to test notion: ${res.status}`);
    return res.json();
  },

  async cleanupEmptyTasks(): Promise<{ deleted: number }> {
    const res = await fetch(`${getBaseUrl()}/api/notion/cleanup-empty`, { method: "DELETE", headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to cleanup: ${res.status}`);
    return res.json();
  },

  async syncNow(): Promise<{ success: boolean; synced: number; message: string }> {
    const res = await fetch(`${getBaseUrl()}/api/notion/sync-now`, { method: "POST", headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to sync: ${res.status}`);
    return res.json();
  },

  async getNotionSchema(): Promise<{
    success: boolean;
    properties: { name: string; property_type: string; options: string[] }[];
    message: string;
  }> {
    const res = await fetch(`${getBaseUrl()}/api/notion/schema`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to get notion schema: ${res.status}`);
    return res.json();
  },

  // Auth
  async login(
    email: string,
    password: string,
  ): Promise<{
    token: string;
    user: {
      id: string;
      email: string;
      username: string;
      is_admin: boolean;
    };
    subscription: {
      plan: string;
      expires_at: string | null;
      is_pro: boolean;
    };
  }> {
    const res = await fetch(`${getBaseUrl()}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res
        .json()
        .catch(() => ({ message: "Login failed" }));
      throw new Error(data.message || `Login failed: ${res.status}`);
    }
    return res.json();
  },

  async register(
    email: string,
    username: string,
    password: string,
  ): Promise<{ message: string }> {
    const res = await fetch(`${getBaseUrl()}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, username, password }),
    });
    if (!res.ok) {
      const data = await res
        .json()
        .catch(() => ({ message: "Registration failed" }));
      throw new Error(data.message || `Registration failed: ${res.status}`);
    }
    return res.json();
  },

  async getMe(
    token?: string,
  ): Promise<{
    id: string;
    email: string;
    username: string;
    is_admin: boolean;
    subscription: {
      plan: string;
      expires_at: string | null;
      is_pro: boolean;
    };
  }> {
    const headers: Record<string, string> = {};
    const t = token ?? _getToken();
    if (t) headers["Authorization"] = `Bearer ${t}`;
    const res = await fetch(`${getBaseUrl()}/api/auth/me`, { headers });
    if (!res.ok) throw new Error(`Failed to get user: ${res.status}`);
    return res.json();
  },

  // Subscription & Payment
  async getSubscription(): Promise<{
    plan: string;
    period: string | null;
    expires_at: string | null;
    is_pro: boolean;
  }> {
    const res = await fetch(`${getBaseUrl()}/api/subscription`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to get subscription: ${res.status}`);
    return res.json();
  },

  async createPayment(
    plan: string,
    channel: string,
  ): Promise<{ order_no: string; qr_url: string }> {
    const res = await fetch(`${getBaseUrl()}/api/payment/create`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ plan, channel }),
    });
    if (!res.ok) throw new Error(`Failed to create payment: ${res.status}`);
    return res.json();
  },

  async getPaymentStatus(
    orderNo: string,
  ): Promise<{ status: string; plan: string }> {
    const res = await fetch(
      `${getBaseUrl()}/api/payment/status/${orderNo}`,
      { headers: authHeaders() },
    );
    if (!res.ok)
      throw new Error(`Failed to get payment status: ${res.status}`);
    return res.json();
  },

  // Attachments
  async listAttachments(taskId: string): Promise<Attachment[]> {
    const res = await fetch(
      `${getBaseUrl()}/api/tasks/${taskId}/attachments`,
      { headers: authHeaders() },
    );
    if (!res.ok)
      throw new Error(`Failed to list attachments: ${res.status}`);
    return res.json();
  },

  async uploadAttachment(taskId: string, file: File): Promise<Attachment> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(
      `${getBaseUrl()}/api/tasks/${taskId}/attachments`,
      {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      },
    );
    if (!res.ok)
      throw new Error(`Failed to upload attachment: ${res.status}`);
    return res.json();
  },

  async deleteAttachment(id: string): Promise<void> {
    const res = await fetch(`${getBaseUrl()}/api/attachments/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok && res.status !== 204)
      throw new Error(`Failed to delete attachment: ${res.status}`);
  },
};
