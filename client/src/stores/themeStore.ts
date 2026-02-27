import { create } from "zustand";

type Theme = "dark" | "glass";

interface ThemeState {
  theme: Theme;
  glassOpacity: number; // 0~100
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setGlassOpacity: (v: number) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "dark",
  glassOpacity: 10,
  setTheme: (theme) => set({ theme }),
  toggleTheme: () => set({ theme: get().theme === "dark" ? "glass" : "dark" }),
  setGlassOpacity: (v) => set({ glassOpacity: Math.max(0, Math.min(100, v)) }),
}));
