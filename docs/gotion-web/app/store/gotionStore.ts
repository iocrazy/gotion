import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export type TaskStatus = 'not-started' | 'in-progress' | 'done' | 'on-hold' | 'waiting' | 'canceled';
export type TaskPriority = 'none' | 'low' | 'medium' | 'high';
export type GroupByOption = 'date' | 'status' | 'priority';

export interface Task {
  id: string;
  notion_id?: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string;
  created_at: number;
  updated_at: number;
  title_updated_at: number;
  status_updated_at: number;
  priority_updated_at: number;
  due_date_updated_at?: number;
  is_dirty: boolean;
}

export interface Block {
  id: string;
  task_id: string;
  notion_block_id?: string;
  type: string;
  content: string; // JSON string
  sort_order: number;
  updated_at: number;
  is_dirty: boolean;
}

export interface Settings {
  notionToken: string;
  notionDatabaseId: string;
  lastSyncAt: number;
}

interface GotionState {
  tasks: Task[];
  blocks: Record<string, Block[]>; // task_id -> blocks
  settings: Settings;
  groupBy: GroupByOption;
  
  // Actions
  setSettings: (settings: Partial<Settings>) => void;
  setGroupBy: (groupBy: GroupByOption) => void;
  addTask: (title: string, initialProps?: Partial<Task>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleTaskStatus: (id: string) => void;
  
  // Block Actions
  updateBlocks: (taskId: string, blocks: Block[]) => void;
  
  // Sync Actions (placeholders for now)
  markSynced: (taskId: string, notionId: string) => void;
  importTask: (task: Task) => void;
}

export const useGotionStore = create<GotionState>()(
  persist(
    (set, get) => ({
      tasks: [],
      blocks: {},
      settings: {
        notionToken: '',
        notionDatabaseId: '',
        lastSyncAt: 0,
      },
      groupBy: 'date',

      setSettings: (newSettings) =>
        set((state) => ({ settings: { ...state.settings, ...newSettings } })),

      setGroupBy: (groupBy) => set({ groupBy }),

      addTask: (title, initialProps = {}) => {
        const now = Date.now();
        const newTask: Task = {
          id: uuidv4(),
          title,
          status: 'not-started',
          priority: 'none',
          created_at: now,
          updated_at: now,
          title_updated_at: now,
          status_updated_at: now,
          priority_updated_at: now,
          is_dirty: true,
          ...initialProps,
        };
        set((state) => ({ tasks: [newTask, ...state.tasks] }));
      },

      updateTask: (id, updates) => {
        const now = Date.now();
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  ...updates,
                  updated_at: now,
                  title_updated_at: updates.title ? now : t.title_updated_at,
                  status_updated_at: updates.status ? now : t.status_updated_at,
                  priority_updated_at: updates.priority ? now : t.priority_updated_at,
                  due_date_updated_at: updates.due_date ? now : t.due_date_updated_at,
                  is_dirty: true,
                }
              : t
          ),
        }));
      },

      deleteTask: (id) => {
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
          blocks: (() => {
            const newBlocks = { ...state.blocks };
            delete newBlocks[id];
            return newBlocks;
          })(),
        }));
      },

      toggleTaskStatus: (id) => {
        const task = get().tasks.find((t) => t.id === id);
        if (task) {
          const isComplete = task.status === 'done' || task.status === 'canceled';
          get().updateTask(id, { status: isComplete ? 'not-started' : 'done' });
        }
      },

      updateBlocks: (taskId, newBlocks) => {
        set((state) => ({
          blocks: {
            ...state.blocks,
            [taskId]: newBlocks,
          },
        }));
      },

      markSynced: (taskId, notionId) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, notion_id: notionId, is_dirty: false } : t
          ),
        }));
      },

      importTask: (task: Task) => {
        set((state) => ({
          tasks: [task, ...state.tasks],
        }));
      },
    }),
    {
      name: 'gotion-storage',
      storage: createJSONStorage(() => localStorage), // Use localStorage for MVP
    }
  )
);
