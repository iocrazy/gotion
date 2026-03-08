import { useSettingsStore } from "../stores/settingsStore";

function getBaseUrl(): string {
  return useSettingsStore.getState().serverUrl;
}

function getApiKey(): string {
  return useSettingsStore.getState().apiKey;
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const key = getApiKey();
  if (key) headers["X-API-Key"] = key;
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
};
