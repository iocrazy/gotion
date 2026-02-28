import { useSettingsStore } from "../stores/settingsStore";

function getBaseUrl(): string {
  return useSettingsStore.getState().serverUrl;
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

export interface CreateTaskRequest {
  title: string;
  status?: "todo" | "done";
  due_date?: string | null;
}

export interface UpdateTaskRequest {
  title?: string;
  status?: "todo" | "done";
  due_date?: string | null;
}

export const api = {
  async listTasks(status?: "todo" | "done"): Promise<Task[]> {
    const params = status ? `?status=${status}` : "";
    const res = await fetch(`${getBaseUrl()}/api/tasks${params}`);
    if (!res.ok) throw new Error(`Failed to list tasks: ${res.status}`);
    return res.json();
  },

  async createTask(data: CreateTaskRequest): Promise<Task> {
    const res = await fetch(`${getBaseUrl()}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to create task: ${res.status}`);
    return res.json();
  },

  async updateTask(id: string, data: UpdateTaskRequest): Promise<Task> {
    const res = await fetch(`${getBaseUrl()}/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to update task: ${res.status}`);
    return res.json();
  },

  async deleteTask(id: string): Promise<void> {
    const res = await fetch(`${getBaseUrl()}/api/tasks/${id}`, {
      method: "DELETE",
    });
    if (!res.ok && res.status !== 204)
      throw new Error(`Failed to delete task: ${res.status}`);
  },

  async getBlocks(taskId: string): Promise<Block[]> {
    const res = await fetch(`${getBaseUrl()}/api/tasks/${taskId}/blocks`);
    if (!res.ok) throw new Error(`Failed to get blocks: ${res.status}`);
    return res.json();
  },

  async updateBlocks(taskId: string, blocks: Block[]): Promise<Block[]> {
    const res = await fetch(`${getBaseUrl()}/api/tasks/${taskId}/blocks`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(blocks),
    });
    if (!res.ok) throw new Error(`Failed to update blocks: ${res.status}`);
    return res.json();
  },
};
