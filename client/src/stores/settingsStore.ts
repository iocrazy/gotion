import { create } from "zustand";
import { isTauri, tauriInvoke } from "../lib/tauri";

interface SettingsState {
  serverUrl: string;
  bgOpacity: number;
  loaded: boolean;
  loadSettings: () => Promise<void>;
  setServerUrl: (url: string) => Promise<void>;
  setBgOpacity: (opacity: number) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  serverUrl: "http://localhost:3001",
  bgOpacity: 1.0,
  loaded: false,

  loadSettings: async () => {
    if (isTauri()) {
      try {
        const json = await tauriInvoke<string>("get_settings");
        const settings = JSON.parse(json);
        set({
          serverUrl: settings.server_url,
          bgOpacity: settings.bg_opacity ?? 1.0,
          loaded: true,
        });
      } catch {
        set({ loaded: true });
      }
    } else {
      set({ loaded: true });
    }
  },

  setServerUrl: async (url: string) => {
    const cleaned = url.replace(/\/+$/, "");
    set({ serverUrl: cleaned });
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
}));
