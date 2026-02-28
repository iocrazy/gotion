import { create } from "zustand";
import { api } from "../lib/api";
import type { Category } from "../lib/api";

interface CategoryState {
  categories: Category[];
  loading: boolean;
  fetchCategories: () => Promise<void>;
  upsertCategory: (category: Category) => void;
  removeCategory: (id: string) => void;
}

export const useCategoryStore = create<CategoryState>((set) => ({
  categories: [],
  loading: false,

  fetchCategories: async () => {
    set({ loading: true });
    try {
      const categories = await api.listCategories();
      set({ categories, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  upsertCategory: (category) => {
    set((state) => {
      const exists = state.categories.find((c) => c.id === category.id);
      if (exists) {
        return { categories: state.categories.map((c) => (c.id === category.id ? category : c)) };
      }
      return { categories: [...state.categories, category] };
    });
  },

  removeCategory: (id) => {
    set((state) => ({
      categories: state.categories.filter((c) => c.id !== id),
    }));
  },
}));
