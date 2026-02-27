import { create } from "zustand";
import { api } from "../lib/api";
import type { Task } from "../lib/api";
import type { GroupBy } from "../components/TitleBar";

type StatusFilter = "all" | "todo" | "done";
type Priority = "none" | "low" | "medium" | "high";

interface TaskState {
  tasks: Task[];
  filter: StatusFilter;
  groupBy: GroupBy;
  selectedTaskId: string | null;
  loading: boolean;
  error: string | null;

  // Actions
  fetchTasks: () => Promise<void>;
  setFilter: (filter: StatusFilter) => void;
  setGroupBy: (groupBy: GroupBy) => void;
  selectTask: (id: string | null) => void;
  createTask: (title: string, opts?: { due_date?: string; priority?: Priority }) => Promise<void>;
  updateTask: (
    id: string,
    data: {
      title?: string;
      status?: "todo" | "done";
      due_date?: string | null;
    },
  ) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleTaskStatus: (id: string) => Promise<void>;

  // For WebSocket updates
  upsertTask: (task: Task) => void;
  removeTask: (id: string) => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  filter: "all",
  groupBy: "status",
  selectedTaskId: null,
  loading: false,
  error: null,

  fetchTasks: async () => {
    set({ loading: true, error: null });
    try {
      const filter = get().filter;
      const status = filter === "all" ? undefined : filter;
      const tasks = await api.listTasks(status);
      set({ tasks, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  setFilter: (filter) => {
    set({ filter });
    get().fetchTasks();
  },

  setGroupBy: (groupBy) => set({ groupBy }),

  selectTask: (id) => set({ selectedTaskId: id }),

  createTask: async (title, opts) => {
    try {
      const task = await api.createTask({
        title,
        due_date: opts?.due_date,
      });
      set((state) => ({ tasks: [task, ...state.tasks] }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  updateTask: async (id, data) => {
    try {
      const updated = await api.updateTask(id, data);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? updated : t)),
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  deleteTask: async (id) => {
    try {
      await api.deleteTask(id);
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
        selectedTaskId:
          state.selectedTaskId === id ? null : state.selectedTaskId,
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  toggleTaskStatus: async (id) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;
    const newStatus = task.status === "todo" ? "done" : "todo";
    await get().updateTask(id, { status: newStatus });
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
