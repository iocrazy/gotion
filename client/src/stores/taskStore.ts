import { create } from "zustand";
import { api } from "../lib/api";
import type { Task } from "../lib/api";
import type { GroupBy } from "../components/TitleBar";
import { isTauri, tauriInvoke } from "../lib/tauri";

type StatusFilter = "all" | "todo" | "done";
type Priority = "none" | "low" | "medium" | "high";

interface TaskState {
  tasks: Task[];
  filter: StatusFilter;
  groupBy: GroupBy;
  selectedTaskId: string | null;
  selectedCategoryId: string | null;
  loading: boolean;
  error: string | null;

  // Actions
  fetchTasks: () => Promise<void>;
  setFilter: (filter: StatusFilter) => void;
  setGroupBy: (groupBy: GroupBy) => void;
  selectTask: (id: string | null) => void;
  setSelectedCategoryId: (id: string | null) => void;
  createTask: (title: string, opts?: { due_date?: string; priority?: Priority; category_id?: string | null; parent_id?: string | null }) => Promise<void>;
  updateTask: (
    id: string,
    data: {
      title?: string;
      status?: "todo" | "done";
      due_date?: string | null;
      category_id?: string | null;
      parent_id?: string | null;
      sort_order?: number;
      starred?: boolean;
    },
  ) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleTaskStatus: (id: string) => Promise<void>;
  toggleStar: (id: string) => Promise<void>;

  // For WebSocket updates
  upsertTask: (task: Task) => void;
  removeTask: (id: string) => void;
}

async function queueOfflineOp(entityType: string, entityId: string, action: string, payload: unknown) {
  if (isTauri()) {
    try {
      await tauriInvoke("queue_offline_op", {
        entityType,
        entityId,
        action,
        payload: JSON.stringify(payload),
      });
    } catch (e) {
      console.error("Failed to queue offline op:", e);
    }
  }
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  filter: "all",
  groupBy: "status",
  selectedTaskId: null,
  selectedCategoryId: null,
  loading: false,
  error: null,

  fetchTasks: async () => {
    set({ loading: true, error: null });
    try {
      const filter = get().filter;
      const status = filter === "all" ? undefined : filter;
      const tasks = await api.listTasks(status);
      set({ tasks, loading: false });
      // Cache to SQLite in background (fire-and-forget)
      if (isTauri()) {
        tauriInvoke("cache_tasks", { tasksJson: JSON.stringify(tasks) }).catch(console.error);
      }
    } catch (e) {
      // Fallback to SQLite cache
      if (isTauri()) {
        try {
          const cached = await tauriInvoke<string>("get_cached_tasks");
          const tasks = JSON.parse(cached);
          set({ tasks, loading: false, error: "Offline mode" });
          return;
        } catch {
          // SQLite also failed, fall through
        }
      }
      set({ error: String(e), loading: false });
    }
  },

  setFilter: (filter) => {
    set({ filter });
    get().fetchTasks();
  },

  setGroupBy: (groupBy) => set({ groupBy }),

  selectTask: (id) => set({ selectedTaskId: id }),

  setSelectedCategoryId: (id) => set({ selectedCategoryId: id }),

  createTask: async (title, opts) => {
    try {
      const task = await api.createTask({
        title,
        due_date: opts?.due_date,
        category_id: opts?.category_id,
        parent_id: opts?.parent_id,
      });
      // Use upsert logic to avoid duplicates (WebSocket may have already added it)
      set((state) => {
        const exists = state.tasks.find((t) => t.id === task.id);
        if (exists) {
          return { tasks: state.tasks.map((t) => (t.id === task.id ? task : t)) };
        }
        return { tasks: [task, ...state.tasks] };
      });
    } catch {
      // Offline: optimistic update + queue
      const tempTask: Task = {
        id: crypto.randomUUID(),
        notion_id: null,
        title,
        status: "todo",
        due_date: opts?.due_date ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        title_updated_at: new Date().toISOString(),
        status_updated_at: new Date().toISOString(),
        due_date_updated_at: opts?.due_date ? new Date().toISOString() : null,
        category_id: opts?.category_id ?? null,
        parent_id: opts?.parent_id ?? null,
        sort_order: 0,
        starred: false,
        starred_updated_at: null,
        notion_status: null,
      };
      set((state) => ({ tasks: [tempTask, ...state.tasks] }));
      await queueOfflineOp("task", tempTask.id, "create", {
        title,
        due_date: opts?.due_date,
        category_id: opts?.category_id,
        parent_id: opts?.parent_id,
      });
    }
  },

  updateTask: async (id, data) => {
    // Optimistic update first
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, ...data, updated_at: new Date().toISOString() } : t
      ),
    }));
    try {
      const updated = await api.updateTask(id, data);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? updated : t)),
      }));
    } catch {
      // Keep optimistic update, queue for later
      await queueOfflineOp("task", id, "update", data);
    }
  },

  deleteTask: async (id) => {
    // Optimistic delete
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
      selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId,
    }));
    try {
      await api.deleteTask(id);
    } catch {
      // Queue for later (item already removed from UI)
      await queueOfflineOp("task", id, "delete", {});
    }
  },

  toggleTaskStatus: async (id) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;
    const newStatus = task.status === "todo" ? "done" : "todo";
    await get().updateTask(id, { status: newStatus });
  },

  toggleStar: async (id) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;
    await get().updateTask(id, { starred: !task.starred });
  },

  // WebSocket handlers
  upsertTask: (task) => {
    set((state) => {
      const exists = state.tasks.find((t) => t.id === task.id);
      if (exists) {
        return {
          tasks: state.tasks.map((t) => (t.id === task.id ? task : t)),
        };
      }
      return { tasks: [task, ...state.tasks] };
    });
  },

  removeTask: (id) => {
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
      selectedTaskId:
        state.selectedTaskId === id ? null : state.selectedTaskId,
    }));
  },
}));
