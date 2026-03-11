import { create } from "zustand";
import { isTauri, tauriInvoke } from "../lib/tauri";
import { getThemeById, applyTheme } from "../lib/themes";

interface SettingsState {
  serverUrl: string;
  bgOpacity: number;
  themeId: string;
  loaded: boolean;
  loadSettings: () => Promise<void>;
  setServerUrl: (url: string) => Promise<void>;
  setBgOpacity: (opacity: number) => Promise<void>;
  setTheme: (themeId: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  serverUrl: import.meta.env.VITE_SERVER_URL || "https://gotion.heygo.cn:88",
  bgOpacity: 1.0,
  themeId: "light",
  loaded: false,

  loadSettings: async () => {
    if (isTauri()) {
      try {
        const json = await tauriInvoke<string>("get_settings");
        const settings = JSON.parse(json);
        // Migration: support old "theme" field
        const themeId: string = settings.themeId ?? settings.theme ?? "light";
        const theme = getThemeById(themeId);
        applyTheme(theme);
        set({
          serverUrl: settings.server_url,
          bgOpacity: settings.bg_opacity ?? 1.0,
          themeId: theme.id,
          loaded: true,
        });
      } catch (e) {
        console.error("Failed to load settings:", e);
        applyTheme(getThemeById("light"));
        set({ loaded: true });
      }
    } else {
      const savedUrl = localStorage.getItem("gotion_serverUrl");
      const savedThemeId = localStorage.getItem("gotion_theme_id") ?? "light";
      const theme = getThemeById(savedThemeId);
      applyTheme(theme);
      set({
        themeId: theme.id,
        loaded: true,
        ...(savedUrl ? { serverUrl: savedUrl } : {}),
      });
    }
  },

  setServerUrl: async (url: string) => {
    const cleaned = url.replace(/\/+$/, "");
    set({ serverUrl: cleaned });
    if (!isTauri()) {
      localStorage.setItem("gotion_serverUrl", cleaned);
    }
    if (isTauri()) {
      try {
        await tauriInvoke("save_settings", {
          settingsJson: JSON.stringify({ server_url: cleaned }),
        });
      } catch (e) {
        console.error("Failed to save settings:", e);
      }
    }
  },

  setBgOpacity: async (opacity: number) => {
    set({ bgOpacity: opacity });
    if (isTauri()) {
      try {
        await tauriInvoke("save_settings", {
          settingsJson: JSON.stringify({ bg_opacity: opacity }),
        });
      } catch (e) {
        console.error("Failed to save settings:", e);
      }
    }
  },

  setTheme: async (themeId: string) => {
    const theme = getThemeById(themeId);
    applyTheme(theme);
    set({ themeId: theme.id });
    if (isTauri()) {
      try {
        await tauriInvoke("save_settings", {
          settingsJson: JSON.stringify({ themeId: theme.id }),
        });
      } catch (e) {
        console.error("Failed to save settings:", e);
      }
    } else {
      localStorage.setItem("gotion_theme_id", theme.id);
    }
  },
}));
